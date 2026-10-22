import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CreditCard, Database, Globe2, HardDrive, KeyRound, Mail, ShieldCheck, Sparkles, Users } from "lucide-react";
import { HoursForm } from "@/components/dashboard/hours-form";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { DemoNote, PageHeader, SectionCard } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import { locations, tenantDomains, tenantMemberships, users } from "@/db/schema";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";
import { getProvider } from "@/lib/ai/providers";
import { getBusinessHours, getIntegrationConnections } from "@/lib/dashboard-data";
import { env } from "@/lib/env";
import { roleLabel } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

const integrationIcons: Record<string, typeof Mail> = {
  email: Mail,
  payments: CreditCard,
  storage: HardDrive,
  calendar: Globe2,
};

const integrationLabels: Record<string, string> = {
  email: "Email delivery",
  payments: "Payments",
  storage: "Media storage",
  calendar: "Calendar sync",
};

export default async function SettingsPage() {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "settings.manage")) notFound();

  const db = await ensureDb();
  const [locationRows, hours, integrations, members, domains] = await Promise.all([
    db.select().from(locations).where(eq(locations.tenantId, context.tenant.id)).limit(1),
    getBusinessHours(db, context.tenant.id),
    getIntegrationConnections(db, context.tenant.id),
    db
      .select({ membership: tenantMemberships, user: users })
      .from(tenantMemberships)
      .innerJoin(users, eq(users.id, tenantMemberships.userId))
      .where(eq(tenantMemberships.tenantId, context.tenant.id)),
    db.select().from(tenantDomains).where(eq(tenantDomains.tenantId, context.tenant.id)),
  ]);
  const location = locationRows[0] ?? null;
  const provider = getProvider();

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Business identity, location, opening hours, team access and the honest state of every integration."
      />
      <DemoNote>This workspace is a demo tenant. Saving business details updates the real demo record and storefront, but no billing, domain verification or external connection is performed.</DemoNote>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <SectionCard title="Business profile" description="Shown on the storefront, booking pages and client emails">
            <div className="p-4 sm:p-5">
              <SettingsForm
                tenant={{ name: context.tenant.name, timezone: context.tenant.timezone, currency: context.tenant.currency }}
                location={
                  location
                    ? {
                        name: location.name,
                        addressLine1: location.addressLine1,
                        addressLine2: location.addressLine2,
                        city: location.city,
                        phone: location.phone,
                        email: location.email,
                      }
                    : null
                }
              />
            </div>
          </SectionCard>

          <SectionCard title="Studio opening hours" description="The storefront and booking engine treat these as outer bounds">
            <div className="p-4 sm:p-5">
              <HoursForm hours={hours.map((row) => ({ weekday: row.weekday, opensAt: row.opensAt, closesAt: row.closesAt, isClosed: row.isClosed }))} />
            </div>
          </SectionCard>

          <SectionCard title="Integrations" description="No integration claims more than it actually did">
            <div className="divide-y divide-[#efeae1]">
              {integrations.length === 0 && <p className="px-4 py-4 text-[11px] text-muted sm:px-5">No integrations are configured.</p>}
              {integrations.map((integration) => {
                const Icon = integrationIcons[integration.provider] ?? Database;
                const note = typeof integration.config.note === "string" ? integration.config.note : null;
                return (
                  <div key={integration.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#efe9df] text-forest"><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-ink">{integrationLabels[integration.provider] ?? integration.provider}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{note ?? "Demonstration connection. No external calls are made."}</p>
                    </div>
                    <span className={`dash-chip shrink-0 ${integration.status === "connected" ? "bg-[#e6efe7] text-[#2f5c42]" : "bg-[#f7ecda] text-[#8e612f]"}`}>
                      {integration.status === "connected" ? "Connected" : "Demo"}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-line bg-[#faf6ef] px-4 py-3 text-[10px] leading-relaxed text-muted sm:px-5">
              Email becomes live only when <code className="rounded bg-[#efe9df] px-1">RESEND_API_KEY</code> is set. Payments are not collected in this MVP: the demo records pay-at-appointment only. Media uses bundled local files.
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Workspace identity">
            <div className="divide-y divide-[#efeae1] text-[11px]">
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"><span className="text-muted">Business</span><span className="text-right font-medium text-ink">{context.tenant.name}</span></div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"><span className="text-muted">Slug</span><span className="font-mono text-[10px] text-ink">{context.tenant.slug}</span></div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"><span className="text-muted">Hostname</span><span className="font-mono text-[10px] text-ink">{domains[0]?.hostname ?? `${context.tenant.slug}.localhost`}</span></div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"><span className="text-muted">Timezone</span><span className="text-ink">{context.tenant.timezone}</span></div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"><span className="text-muted">Currency</span><span className="text-ink">{context.tenant.currency}</span></div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"><span className="text-muted">Environment</span><span className="dash-chip bg-[#f7ecda] text-[#8e612f]">Demo tenant</span></div>
            </div>
          </SectionCard>

          <SectionCard title="Team access" description="Roles are enforced on the server, not just hidden in navigation">
            <div className="divide-y divide-[#efeae1]">
              {members.map(({ membership, user }) => (
                <div key={membership.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#efe9df] text-[10px] font-semibold text-forest">
                    {user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-ink">{user.name}</p>
                    <p className="truncate text-[9px] text-muted">{user.email}</p>
                  </div>
                  <span className="dash-chip bg-[#e6efe7] text-[#2f5c42]">{roleLabel(membership.role)}</span>
                </div>
              ))}
            </div>
            <p className="border-t border-line px-4 py-2.5 text-[10px] text-muted sm:px-5"><Users className="mr-1 inline h-3 w-3" /> Membership is the only source of dashboard access. A slug or hostname never grants it.</p>
          </SectionCard>

          <SectionCard title="Runtime">
            <div className="space-y-2.5 p-4 text-[11px] sm:p-5">
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-muted"><Database className="h-3 w-3" /> Database</span><span className="text-ink">{env.databaseUrl ? "PostgreSQL" : "Embedded PGlite"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-muted"><Sparkles className="h-3 w-3" /> AI provider</span><span className="text-ink">{provider.info.live ? "Live" : "Mock"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-muted"><HardDrive className="h-3 w-3" /> Storage</span><span className="text-ink">{env.storageProvider}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-muted"><ShieldCheck className="h-3 w-3" /> Demo mode</span><span className="text-ink">{env.demoMode ? "On" : "Off"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-muted"><KeyRound className="h-3 w-3" /> Session secret</span><span className="text-ink">{env.sessionSecret.startsWith("nuru-local") ? "Development default" : "Configured"}</span></div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
