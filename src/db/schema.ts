import {
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * All tenant-owned tables carry an explicit `tenant_id`. Queries in the
 * application layer always filter by the resolved tenant, and authorization is
 * checked before a tenant id is handed to a query.
 */

const id = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export type TenantRole = "owner" | "manager" | "staff";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
export type AgentStatus = "queued" | "running" | "awaiting_approval" | "completed" | "failed" | "cancelled";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "executed";

// ── Identity and tenancy ─────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const tenants = pgTable(
  "tenants",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    status: text("status").$type<"active" | "suspended" | "draft">().notNull().default("active"),
    timezone: text("timezone").notNull().default("Africa/Nairobi"),
    currency: text("currency").notNull().default("KES"),
    locale: text("locale").notNull().default("en-KE"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("tenants_slug_idx").on(t.slug)],
);

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<TenantRole>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("membership_tenant_user_idx").on(t.tenantId, t.userId),
    index("membership_user_idx").on(t.userId),
  ],
);

export const tenantDomains = pgTable(
  "tenant_domains",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("tenant_domain_unique").on(t.hostname)],
);

export const tenantSubscriptions = pgTable("tenant_subscriptions", {
  id: id(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("studio"),
  status: text("status").notNull().default("trialing"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_tenant_idx").on(t.tenantId, t.createdAt)],
);

// ── Storefront ───────────────────────────────────────────────────────────────

export const storefrontConfigs = pgTable(
  "storefront_configs",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    draft: jsonb("draft").$type<Record<string, unknown>>().notNull(),
    published: jsonb("published").$type<Record<string, unknown>>().notNull(),
    updatedAt: updatedAt(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("storefront_tenant_unique").on(t.tenantId)],
);

export const storefrontSections = pgTable(
  "storefront_sections",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    visible: boolean("visible").notNull().default(true),
    content: jsonb("content").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [uniqueIndex("section_tenant_key_unique").on(t.tenantId, t.key)],
);

export const publishedVersions = pgTable(
  "published_versions",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("published_tenant_version_unique").on(t.tenantId, t.version)],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    url: text("url").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
    altText: text("alt_text").notNull().default(""),
    kind: text("kind").notNull().default("image"),
    isDemo: boolean("is_demo").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("media_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const pages = pgTable(
  "pages",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("published"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("page_tenant_slug_unique").on(t.tenantId, t.slug)],
);

// ── Business operations ──────────────────────────────────────────────────────

export const locations = pgTable(
  "locations",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    city: text("city").notNull(),
    country: text("country").notNull().default("Kenya"),
    phone: text("phone"),
    email: text("email"),
    timezone: text("timezone").notNull().default("Africa/Nairobi"),
    isPrimary: boolean("is_primary").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("location_tenant_idx").on(t.tenantId)],
);

export const staffProfiles = pgTable(
  "staff_profiles",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    title: text("title").notNull(),
    bio: text("bio").notNull().default(""),
    imageUrl: text("image_url"),
    email: text("email"),
    phone: text("phone"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    color: text("color").notNull().default("#24483D"),
    createdAt: createdAt(),
  },
  (t) => [index("staff_tenant_idx").on(t.tenantId, t.isActive)],
);

export const services = pgTable(
  "services",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortDescription: text("short_description").notNull(),
    description: text("description").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(10),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(10),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("KES"),
    imageUrl: text("image_url"),
    category: text("category").notNull().default("Massage"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("service_tenant_slug_unique").on(t.tenantId, t.slug),
    index("service_tenant_active_idx").on(t.tenantId, t.isActive),
  ],
);

export const serviceAddons = pgTable(
  "service_addons",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("addon_tenant_idx").on(t.tenantId)],
);

export const staffServices = pgTable(
  "staff_services",
  {
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.staffId, t.serviceId] }),
    index("staff_service_tenant_idx").on(t.tenantId),
  ],
);

export const businessHours = pgTable(
  "business_hours",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(), // 0 = Sunday
    opensAt: text("opens_at").notNull().default("09:00"),
    closesAt: text("closes_at").notNull().default("19:00"),
    isClosed: boolean("is_closed").notNull().default(false),
  },
  (t) => [uniqueIndex("hours_tenant_weekday_unique").on(t.tenantId, t.weekday)],
);

export const staffAvailability = pgTable(
  "staff_availability",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startTime: text("start_time").notNull().default("09:00"),
    endTime: text("end_time").notNull().default("18:00"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("availability_tenant_staff_idx").on(t.tenantId, t.staffId, t.weekday)],
);

export const timeOff = pgTable(
  "time_off",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason").notNull().default("Unavailable"),
    createdAt: createdAt(),
  },
  (t) => [index("timeoff_tenant_staff_idx").on(t.tenantId, t.staffId, t.startsAt)],
);

// ── Customers and bookings ───────────────────────────────────────────────────

export const customers = pgTable(
  "customers",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("customer_tenant_idx").on(t.tenantId, t.name)],
);

export const customerConsents = pgTable(
  "customer_consents",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    type: text("type").$type<"transactional" | "marketing">().notNull(),
    granted: boolean("granted").notNull(),
    source: text("source").notNull().default("booking"),
    createdAt: createdAt(),
  },
  (t) => [index("consent_tenant_customer_idx").on(t.tenantId, t.customerId, t.type)],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    transactionalEmail: boolean("transactional_email").notNull().default(true),
    marketingEmail: boolean("marketing_email").notNull().default(false),
    marketingSms: boolean("marketing_sms").notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("notification_pref_customer_unique").on(t.tenantId, t.customerId)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    reference: text("reference").notNull().unique(),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    staffId: uuid("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "restrict" }),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
    status: text("status").$type<BookingStatus>().notNull().default("confirmed"),
    source: text("source").notNull().default("storefront"),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("KES"),
    customerNote: text("customer_note"),
    internalNote: text("internal_note"),
    idempotencyKey: text("idempotency_key"),
    isDemo: boolean("is_demo").notNull().default(true),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("booking_tenant_idempotency_unique").on(t.tenantId, t.idempotencyKey),
    index("booking_tenant_start_idx").on(t.tenantId, t.startsAt),
    index("booking_tenant_staff_start_idx").on(t.tenantId, t.staffId, t.startsAt),
    index("booking_tenant_status_idx").on(t.tenantId, t.status),
  ],
);

export const bookingItems = pgTable(
  "booking_items",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    addonId: uuid("addon_id").references(() => serviceAddons.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCents: integer("price_cents").notNull(),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [index("booking_item_tenant_idx").on(t.tenantId, t.bookingId)],
);

export const bookingStatusHistory = pgTable(
  "booking_status_history",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").$type<BookingStatus>(),
    toStatus: text("to_status").$type<BookingStatus>().notNull(),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("booking_history_booking_idx").on(t.tenantId, t.bookingId, t.createdAt)],
);

export const bookingHolds = pgTable(
  "booking_holds",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("hold_tenant_staff_start_idx").on(t.tenantId, t.staffId, t.startsAt)],
);

// ── AI, approvals, marketing and integrations ───────────────────────────────

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    task: text("task").notNull(),
    prompt: text("prompt").notNull(),
    status: text("status").$type<AgentStatus>().notNull().default("queued"),
    provider: text("provider").notNull().default("mock"),
    model: text("model").notNull().default("nuru-mock-1"),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("agent_run_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const agentSteps = pgTable(
  "agent_steps",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    runId: uuid("run_id").notNull().references(() => agentRuns.id, { onDelete: "cascade" }),
    stepIndex: integer("step_index").notNull(),
    kind: text("kind").$type<"message" | "tool" | "approval" | "error">().notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("completed"),
    input: jsonb("input").$type<Record<string, unknown>>(),
    output: jsonb("output").$type<Record<string, unknown>>(),
    error: text("error"),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("agent_step_run_idx").on(t.tenantId, t.runId, t.stepIndex)],
);

export const agentArtifacts = pgTable(
  "agent_artifacts",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    runId: uuid("run_id").notNull().references(() => agentRuns.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: createdAt(),
  },
  (t) => [index("artifact_tenant_idx").on(t.tenantId, t.runId)],
);

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => agentRuns.id, { onDelete: "cascade" }),
    artifactId: uuid("artifact_id").references(() => agentArtifacts.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: text("status").$type<ApprovalStatus>().notNull().default("pending"),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    result: jsonb("result").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("approval_tenant_idx").on(t.tenantId, t.status, t.createdAt)],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    channel: text("channel").notNull().default("email"),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    audience: jsonb("audience").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("draft"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(true),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("campaign_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    email: text("email"),
    status: text("status").notNull().default("pending"),
    messageId: uuid("message_id"),
    createdAt: createdAt(),
  },
  (t) => [index("campaign_recipient_tenant_idx").on(t.tenantId, t.campaignId)],
);

export const outboundMessages = pgTable(
  "outbound_messages",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    channel: text("channel").notNull().default("email"),
    toAddress: text("to_address"),
    subject: text("subject"),
    body: text("body").notNull(),
    status: text("status").$type<"draft" | "simulated" | "sent" | "failed">().notNull().default("draft"),
    provider: text("provider").notNull().default("demo"),
    providerMessageId: text("provider_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("outbound_idempotency_unique").on(t.tenantId, t.idempotencyKey),
    index("outbound_tenant_idx").on(t.tenantId, t.createdAt),
  ],
);

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("demo"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("integration_tenant_provider_unique").on(t.tenantId, t.provider)],
);

export const externalOperations = pgTable(
  "external_operations",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull(),
    requestHash: text("request_hash").notNull(),
    response: jsonb("response").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("external_op_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const scheduledJobs = pgTable(
  "scheduled_jobs",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    runAt: timestamp("run_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [index("job_run_at_idx").on(t.status, t.runAt)],
);

export const dashboardNotifications = pgTable(
  "dashboard_notifications",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_tenant_idx").on(t.tenantId, t.createdAt)],
);

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Membership = typeof tenantMemberships.$inferSelect;
export type Service = typeof services.$inferSelect;
export type StaffProfile = typeof staffProfiles.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type AgentStep = typeof agentSteps.$inferSelect;
export type AgentArtifact = typeof agentArtifacts.$inferSelect;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type StorefrontConfig = typeof storefrontConfigs.$inferSelect;
