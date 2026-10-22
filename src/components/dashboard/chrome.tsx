"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  CircleUserRound,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Scissors,
  Settings,
  Sparkles,
  Store,
  Users,
  X,
} from "lucide-react";
import { NuruMark } from "@/components/brand/logo";
import type { TenantRole } from "@/db/schema";
import { roleLabel } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";

const icons = {
  overview: LayoutDashboard,
  calendar: CalendarDays,
  bookings: CalendarDays,
  customers: Users,
  services: Scissors,
  staff: CircleUserRound,
  storefront: Store,
  assistant: Sparkles,
  marketing: Megaphone,
  settings: Settings,
};

export type NavItem = { href: string; label: string; icon: keyof typeof icons; exact?: boolean; group: "workspace" | "business" | "growth" | "account" };

export function DashboardChrome({
  children,
  tenantName,
  tenantSlug,
  role,
  userName,
  userEmail,
  memberships,
  unreadCount,
  isDemo,
  autoLogin,
  navItems,
}: {
  children: React.ReactNode;
  tenantName: string;
  tenantSlug: string;
  role: TenantRole;
  userName: string;
  userEmail: string;
  memberships: { id: string; name: string }[];
  unreadCount: number;
  isDemo: boolean;
  autoLogin: boolean;
  navItems: NavItem[];
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);

  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-5 pt-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-ivory" onClick={() => setMobileOpen(false)}>
          <NuruMark size={30} />
          <span className="font-display text-2xl leading-none">Nuru</span>
        </Link>
        <button type="button" className="p-2 text-ivory/60 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setTenantOpen((value) => !value)}
            className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/8"
            aria-expanded={tenantOpen}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sage/20 font-display text-base text-ivory">
              {tenantName.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-ivory">{tenantName}</span>
              <span className="block text-[9px] uppercase tracking-[0.1em] text-ivory/45">{roleLabel(role)} workspace</span>
            </span>
            {memberships.length > 1 && <ChevronDown className="h-3.5 w-3.5 text-ivory/40" />}
          </button>
          {tenantOpen && memberships.length > 1 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-white/10 bg-[#1f3c32] p-1 shadow-xl">
              {memberships.map((membership) => (
                <form key={membership.id} action="/api/tenant/switch" method="post">
                  <input type="hidden" name="tenantId" value={membership.id} />
                  <button
                    type="submit"
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs",
                      membership.name === tenantName ? "bg-white/10 text-white" : "text-ivory/70 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {membership.name}
                    {membership.name === tenantName && <span className="text-[9px] uppercase tracking-wide text-brass">Current</span>}
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-1 overflow-y-auto px-3" aria-label="Dashboard navigation">
        {([
          ["workspace", "Workspace"],
          ["business", "Business"],
          ["growth", "Growth"],
          ["account", "Account"],
        ] as const).map(([group, label]) => {
          const items = navItems.filter((item) => item.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <p className="px-3 pb-1.5 pt-4 text-[8px] font-semibold uppercase tracking-[0.18em] text-ivory/35 first:pt-2">{label}</p>
              {items.map((item) => {
                const Icon = icons[item.icon];
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="dash-nav-item" data-active={isActive(item)}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                    {item.label === "Bookings" && unreadCount > 0 && (
                      <span className="ml-auto rounded-full bg-brass px-1.5 py-0.5 text-[9px] font-semibold text-forest">{unreadCount}</span>
                    )}
                    {item.label === "AI assistant" && (
                      <span className="ml-auto rounded-full border border-brass/40 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-brass">New</span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brass/20 text-xs font-semibold text-brass">
            {userName.split(" ").map((part) => part[0]).slice(0, 2).join("")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-ivory">{userName}</span>
            <span className="block truncate text-[9px] text-ivory/45">{userEmail}</span>
          </span>
          <form action="/api/auth/logout" method="post">
            <button type="submit" aria-label="Sign out" className="p-1.5 text-ivory/45 transition-colors hover:text-ivory">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f3eb]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] bg-forest lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-forest-deep/55 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-[280px] bg-forest shadow-2xl">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-30 border-b border-line bg-[#f7f3eb]/92 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-md border border-line bg-paper p-2 text-ink lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.13em] text-muted sm:flex">
                <span>Workspace</span>
                <span className="text-line">/</span>
                <span className="font-semibold text-ink">{tenantName}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isDemo && (
                <span className="hidden items-center gap-1.5 rounded-full border border-brass/40 bg-[#f4ecdc] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8a6535] sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-brass" /> Demo workspace
                </span>
              )}
              <form action="/api/demo/switch" method="post" target="_blank">
                <input type="hidden" name="tenant" value={tenantSlug} />
                <input type="hidden" name="next" value="/" />
                <button type="submit" className="dash-btn dash-btn-secondary">
                  <ExternalLink className="h-3.5 w-3.5" /> View storefront
                </button>
              </form>
              <Link href="/dashboard/settings" className="hidden h-8 w-8 items-center justify-center rounded-full border border-line bg-paper text-[10px] font-semibold text-forest sm:flex">
                {userName.split(" ").map((part) => part[0]).slice(0, 2).join("")}
              </Link>
            </div>
          </div>
        </header>
        {autoLogin && (
          <div className="border-b border-brass/25 bg-[#f4ecdc] px-4 py-1.5 text-center text-[10px] text-[#8a6535] sm:px-6">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brass align-middle" />
            Demo auto-login is on — browsing as <strong className="font-semibold">{userName}</strong>. No credentials required.
          </div>
        )}
        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
