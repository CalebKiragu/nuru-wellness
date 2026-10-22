import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, Users } from "lucide-react";
import { DemoNote, EmptyState, PageHeader, SectionCard } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";
import { listCustomers } from "@/lib/dashboard-data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "customers.view")) notFound();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 80);
  const db = await ensureDb();
  const rows = await listCustomers(db, context.tenant.id, query || undefined);
  const consented = rows.filter((row) => row.marketingConsent).length;

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Clients"
        description="People who have booked with this business. Studio notes stay private; marketing consent is recorded explicitly."
        actions={<span className="dash-chip bg-[#e6efe7] text-[#2f5c42]"><Users className="h-3 w-3" /> {rows.length} records</span>}
      />
      <DemoNote>Client records are demonstration data, with no real personal information. Consent shown here is sample data recorded at booking.</DemoNote>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="dash-card p-4"><p className="dash-label">Clients</p><p className="font-display text-3xl text-forest">{rows.length}</p></div>
        <div className="dash-card p-4"><p className="dash-label">Marketing consent</p><p className="font-display text-3xl text-forest">{consented}</p></div>
        <div className="dash-card col-span-2 p-4 sm:col-span-1"><p className="dash-label">Upcoming appointments</p><p className="font-display text-3xl text-forest">{rows.reduce((sum, row) => sum + row.upcoming, 0)}</p></div>
      </div>

      <form method="get" className="dash-card mb-4 flex gap-2 p-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={query} className="dash-input pl-8" placeholder="Search by name, email or phone" />
        </div>
        <button type="submit" className="dash-btn dash-btn-primary">Search</button>
        {query && <Link href="/dashboard/customers" className="dash-btn dash-btn-secondary">Reset</Link>}
      </form>

      <SectionCard title="Client directory" description="Newest records first by appointment activity">
        {rows.length === 0 ? (
          <EmptyState title="No clients found" description="Try a different search, or wait for the first storefront booking." />
        ) : (
          <div className="overflow-x-auto">
            <table className="dash-table w-full min-w-[42rem]">
              <thead><tr><th>Client</th><th>Contact</th><th>Visits</th><th>Upcoming</th><th>Last visit</th><th>Marketing</th></tr></thead>
              <tbody>
                {rows.map(({ customer, visits, upcoming, lastVisit, marketingConsent }) => (
                  <tr key={customer.id} className="hover:bg-[#faf6ef]">
                    <td>
                      <Link href={`/dashboard/customers/${customer.id}`} className="block">
                        <span className="text-xs font-medium">{customer.name}</span>
                        {customer.notes && <span className="mt-0.5 block max-w-[18rem] truncate text-[10px] text-muted">{customer.notes}</span>}
                      </Link>
                    </td>
                    <td>
                      <span className="block text-[11px]">{customer.email ?? "—"}</span>
                      <span className="block text-[10px] text-muted">{customer.phone ?? ""}</span>
                    </td>
                    <td><span className="text-xs tabular-nums">{visits}</span></td>
                    <td><span className="text-xs tabular-nums">{upcoming}</span></td>
                    <td><span className="text-[11px] text-muted">{lastVisit ? formatDate(lastVisit, context.tenant.timezone, "d MMM yyyy") : "—"}</span></td>
                    <td>
                      <span className={`dash-chip ${marketingConsent ? "bg-[#e6efe7] text-[#2f5c42]" : "bg-[#f2f0ec] text-[#6f6a63]"}`}>
                        {marketingConsent ? "Opted in" : "Not opted in"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
