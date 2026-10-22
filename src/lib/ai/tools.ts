import "server-only";
import { and, asc, count, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db";
import {
  bookings,
  businessHours,
  campaigns,
  customerConsents,
  customers,
  services,
  staffProfiles,
  storefrontConfigs,
  type Tenant,
} from "@/db/schema";
import { can, type Permission } from "@/lib/auth/permissions";
import type { TenantRole } from "@/db/schema";
import { dayBounds, weekBounds } from "@/lib/dashboard";
import { getAvailabilityForSelection } from "@/lib/availability-service";
import { formatInTimeZone } from "date-fns-tz";
import { addDays } from "date-fns";
import type { StorefrontConfig } from "@/lib/storefront";

/**
 * Every tool receives the resolved tenant from the dashboard session. A tool
 * can never be pointed at another tenant by model output: tenantId is not part
 * of the model-facing input schema, and each handler filters by it explicitly.
 * Permissions are checked again inside the handler rather than trusting the
 * caller (defence in depth).
 */
type ToolContext = {
  db: Database;
  tenant: Tenant;
  role: TenantRole;
};

type ToolDefinition<Shape extends z.ZodTypeAny> = {
  name: string;
  description: string;
  permission: Permission;
  input: Shape;
  run: (context: ToolContext, input: z.infer<Shape>) => Promise<Record<string, unknown>>;
};

function assertPermission(context: ToolContext, permission: Permission) {
  if (!can(context.role, permission)) {
    throw new Error(`FORBIDDEN:${permission}`);
  }
}

export const toolDefinitions = {
  get_business_profile: {
    name: "get_business_profile",
    description: "Read the tenant's public business profile, location and opening hours.",
    permission: "ai.use",
    input: z.object({}),
    async run({ db, tenant }) {
      const [config] = await db.select().from(storefrontConfigs).where(eq(storefrontConfigs.tenantId, tenant.id)).limit(1);
      const hours = await db
        .select()
        .from(businessHours)
        .where(eq(businessHours.tenantId, tenant.id))
        .orderBy(asc(businessHours.weekday));
      const published = config?.published as unknown as StorefrontConfig | undefined;
      return {
        businessName: tenant.name,
        timezone: tenant.timezone,
        currency: tenant.currency,
        tagline: published?.content?.tagline ?? "",
        city: published?.content?.city ?? "",
        phone: published?.content?.phone ?? "",
        email: published?.content?.email ?? "",
        hours: hours.map((row) => ({
          weekday: row.weekday,
          opensAt: row.opensAt,
          closesAt: row.closesAt,
          isClosed: row.isClosed,
        })),
      };
    },
  },
  get_available_slots: {
    name: "get_available_slots",
    description: "Find genuine open appointment slots in the next seven days.",
    permission: "ai.use",
    input: z.object({ days: z.number().int().min(1).max(14).default(7) }),
    async run({ db, tenant }, input) {
      const [serviceRows, staffRows] = await Promise.all([
        db
          .select()
          .from(services)
          .where(and(eq(services.tenantId, tenant.id), eq(services.isActive, true)))
          .orderBy(asc(services.sortOrder))
          .limit(5),
        db
          .select()
          .from(staffProfiles)
          .where(and(eq(staffProfiles.tenantId, tenant.id), eq(staffProfiles.isActive, true)))
          .orderBy(asc(staffProfiles.sortOrder))
          .limit(4),
      ]);

      const open: { service: string; serviceId: string; staff: string; staffId: string; date: string; start: string; label: string }[] = [];
      for (let offset = 0; offset < input.days && open.length < 24; offset += 1) {
        const dateKey = formatInTimeZone(addDays(new Date(), offset), tenant.timezone, "yyyy-MM-dd");
        for (const service of serviceRows) {
          for (const staff of staffRows) {
            const result = await getAvailabilityForSelection(db, tenant, {
              serviceId: service.id,
              staffId: staff.id,
              dateKey,
            });
            for (const slot of result?.slots.slice(0, 3) ?? []) {
              open.push({
                service: service.name,
                serviceId: service.id,
                staff: staff.name,
                staffId: staff.id,
                date: dateKey,
                start: slot.start,
                label: slot.label,
              });
            }
          }
        }
      }
      return { days: input.days, openSlots: open.length, slots: open.slice(0, 18) };
    },
  },
  get_marketing_audience: {
    name: "get_marketing_audience",
    description: "Count clients who have explicitly consented to marketing, excluding unsubscribed contacts.",
    permission: "ai.use",
    input: z.object({}),
    async run({ db, tenant }) {
      const rows = await db
        .select({ customer: customers, consent: customerConsents })
        .from(customers)
        .leftJoin(
          customerConsents,
          and(
            eq(customerConsents.customerId, customers.id),
            eq(customerConsents.type, "marketing"),
            eq(customerConsents.tenantId, tenant.id),
          ),
        )
        .where(eq(customers.tenantId, tenant.id));
      const consented = rows.filter((row) => row.consent?.granted === true);
      return {
        totalCustomers: rows.length,
        consented: consented.length,
        sampleFirstNames: consented.slice(0, 5).map((row) => row.customer.name.split(" ")[0]),
        consentSource: "Explicit marketing consent recorded at booking or later update",
      };
    },
  },
  get_bookings_summary: {
    name: "get_bookings_summary",
    description: "Summarise today's appointments, pending requests and the week ahead.",
    permission: "ai.use",
    input: z.object({}),
    async run({ db, tenant }) {
      const { start, end } = dayBounds(tenant.timezone);
      const week = weekBounds(tenant.timezone);
      const [todayRows, pendingRows, weekRows, upcoming] = await Promise.all([
        db
          .select({ booking: bookings, service: services })
          .from(bookings)
          .innerJoin(services, eq(services.id, bookings.serviceId))
          .where(
            and(
              eq(bookings.tenantId, tenant.id),
              gte(bookings.startsAt, start),
              lt(bookings.startsAt, end),
              ne(bookings.status, "cancelled"),
            ),
          ),
        db
          .select({ value: count() })
          .from(bookings)
          .where(and(eq(bookings.tenantId, tenant.id), eq(bookings.status, "pending"))),
        db
          .select({ value: count() })
          .from(bookings)
          .where(
            and(
              eq(bookings.tenantId, tenant.id),
              gte(bookings.startsAt, week.start),
              lt(bookings.startsAt, week.end),
              ne(bookings.status, "cancelled"),
            ),
          ),
        db
          .select({ booking: bookings, service: services })
          .from(bookings)
          .innerJoin(services, eq(services.id, bookings.serviceId))
          .where(
            and(
              eq(bookings.tenantId, tenant.id),
              gte(bookings.startsAt, start),
              lt(bookings.startsAt, week.end),
              inArray(bookings.status, ["pending", "confirmed"]),
            ),
          )
          .orderBy(asc(bookings.startsAt))
          .limit(10),
      ]);
      return {
        todayCount: todayRows.length,
        pendingCount: Number(pendingRows[0]?.value ?? 0),
        nextSevenDays: Number(weekRows[0]?.value ?? 0),
        today: todayRows.map((row) => ({
          time: formatInTimeZone(row.booking.startsAt, tenant.timezone, "h:mm a"),
          service: row.service.name,
          status: row.booking.status,
        })),
        upcoming: upcoming.map((row) => ({
          date: formatInTimeZone(row.booking.startsAt, tenant.timezone, "EEE d MMM"),
          time: formatInTimeZone(row.booking.startsAt, tenant.timezone, "h:mm a"),
          service: row.service.name,
          status: row.booking.status,
        })),
      };
    },
  },
  get_storefront_config: {
    name: "get_storefront_config",
    description: "Read the current published storefront copy and section order.",
    permission: "ai.use",
    input: z.object({}),
    async run({ db, tenant }) {
      const [config] = await db.select().from(storefrontConfigs).where(eq(storefrontConfigs.tenantId, tenant.id)).limit(1);
      const published = config?.published as unknown as StorefrontConfig | undefined;
      if (!published) return { missing: true };
      return {
        content: published.content,
        sections: published.sections,
      };
    },
  },
  get_campaign_history: {
    name: "get_campaign_history",
    description: "Read recent campaign names, channels and delivery statuses.",
    permission: "ai.use",
    input: z.object({}),
    async run({ db, tenant }) {
      const rows = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.tenantId, tenant.id))
        .orderBy(asc(campaigns.createdAt))
        .limit(10);
      return {
        campaigns: rows.map((row) => ({
          name: row.name,
          channel: row.channel,
          status: row.status,
          isDemo: row.isDemo,
        })),
      };
    },
  },
} satisfies Record<string, ToolDefinition<z.ZodTypeAny>>;

export type ToolName = keyof typeof toolDefinitions;

export function toolCatalog() {
  return Object.values(toolDefinitions).map((tool) => ({
    name: tool.name,
    description: tool.description,
    permission: tool.permission,
    input: tool.input,
  }));
}

export async function runTool(
  db: Database,
  tenant: Tenant,
  role: TenantRole,
  name: ToolName,
  input: unknown,
): Promise<Record<string, unknown>> {
  const tool = toolDefinitions[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  assertPermission({ db, tenant, role }, tool.permission as Permission);
  const parsed = tool.input.safeParse(input ?? {});
  if (!parsed.success) throw new Error(`Invalid input for ${name}`);
  return tool.run({ db, tenant, role }, parsed.data);
}
