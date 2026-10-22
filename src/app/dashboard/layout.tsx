import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { DashboardChrome, type NavItem } from "@/components/dashboard/chrome";
import { ensureDb } from "@/db";
import { dashboardNotifications } from "@/db/schema";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser, getDashboardContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const context = await getDashboardContext();
  if (!context) redirect("/login");

  const db = await ensureDb();
  const [unread] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(dashboardNotifications)
    .where(and(eq(dashboardNotifications.tenantId, context.tenant.id), sql`${dashboardNotifications.readAt} is null`));

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: "overview", exact: true, group: "workspace" },
    { href: "/dashboard/calendar", label: "Calendar", icon: "calendar", group: "workspace" },
    { href: "/dashboard/bookings", label: "Bookings", icon: "bookings", group: "workspace" },
    { href: "/dashboard/customers", label: "Clients", icon: "customers", group: "workspace" },
  ];
  if (can(context.role, "services.manage")) {
    navItems.push(
      { href: "/dashboard/services", label: "Services", icon: "services", group: "business" },
      { href: "/dashboard/staff", label: "Team & hours", icon: "staff", group: "business" },
    );
  }
  if (can(context.role, "storefront.edit")) {
    navItems.push({ href: "/dashboard/storefront", label: "Storefront", icon: "storefront", group: "growth" });
  }
  if (can(context.role, "ai.use")) {
    navItems.push({ href: "/dashboard/assistant", label: "AI assistant", icon: "assistant", group: "growth" });
  }
  if (can(context.role, "marketing.manage")) {
    navItems.push({ href: "/dashboard/marketing", label: "Marketing", icon: "marketing", group: "growth" });
  }
  if (can(context.role, "settings.manage")) {
    navItems.push({ href: "/dashboard/settings", label: "Settings", icon: "settings", group: "account" });
  }

  return (
    <DashboardChrome
      tenantName={context.tenant.name}
      tenantSlug={context.tenant.slug}
      role={context.role}
      userName={context.user.name}
      userEmail={context.user.email}
      memberships={context.memberships.map((membership) => ({ id: membership.tenant.id, name: membership.tenant.name }))}
      navItems={navItems}
      unreadCount={Number(unread?.value ?? 0)}
      isDemo={context.tenant.isDemo}
    >
      {children}
    </DashboardChrome>
  );
}
