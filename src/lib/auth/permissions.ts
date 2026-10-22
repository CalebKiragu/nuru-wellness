import type { TenantRole } from "@/db/schema";

export type Permission =
  | "dashboard.view"
  | "bookings.view"
  | "bookings.manage"
  | "customers.view"
  | "customers.manage"
  | "services.manage"
  | "staff.manage"
  | "storefront.edit"
  | "storefront.publish"
  | "marketing.manage"
  | "ai.use"
  | "settings.manage";

const permissions: Record<TenantRole, Permission[]> = {
  owner: [
    "dashboard.view",
    "bookings.view",
    "bookings.manage",
    "customers.view",
    "customers.manage",
    "services.manage",
    "staff.manage",
    "storefront.edit",
    "storefront.publish",
    "marketing.manage",
    "ai.use",
    "settings.manage",
  ],
  manager: [
    "dashboard.view",
    "bookings.view",
    "bookings.manage",
    "customers.view",
    "customers.manage",
    "services.manage",
    "staff.manage",
    "storefront.edit",
    "storefront.publish",
    "marketing.manage",
    "ai.use",
  ],
  staff: ["dashboard.view", "bookings.view", "bookings.manage", "customers.view"],
};

export function can(role: TenantRole, permission: Permission): boolean {
  return permissions[role].includes(permission);
}

export function roleLabel(role: TenantRole): string {
  return role === "owner" ? "Owner" : role === "manager" ? "Manager" : "Staff";
}
