import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Plus, Scissors } from "lucide-react";
import { DemoNote, PageHeader, SectionCard } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";
import { listServices } from "@/lib/dashboard-data";
import { formatDuration, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "services.manage")) notFound();
  const db = await ensureDb();
  const rows = await listServices(db, context.tenant.id);
  const active = rows.filter((row) => row.service.isActive);

  return (
    <div>
      <PageHeader
        eyebrow="Business"
        title="Treatments"
        description="The treatment menu that powers the storefront, booking engine and availability calculations."
        actions={<Link href="/dashboard/services/new" className="dash-btn dash-btn-primary"><Plus className="h-3.5 w-3.5" /> New treatment</Link>}
      />
      <DemoNote>Changes here affect the published storefront immediately, but existing bookings keep the name and price they were made with.</DemoNote>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="dash-card p-4"><p className="dash-label">Treatments</p><p className="font-display text-3xl text-forest">{rows.length}</p></div>
        <div className="dash-card p-4"><p className="dash-label">Visible</p><p className="font-display text-3xl text-forest">{active.length}</p></div>
        <div className="dash-card p-4"><p className="dash-label">Add-ons</p><p className="font-display text-3xl text-forest">{rows.reduce((sum, row) => sum + row.addons.filter((addon) => addon.isActive).length, 0)}</p></div>
        <div className="dash-card p-4"><p className="dash-label">From</p><p className="font-display text-3xl text-forest">{active.length ? formatMoney(Math.min(...active.map((row) => row.service.priceCents)), context.tenant.currency) : "—"}</p></div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map(({ service, addons, staff }) => (
          <SectionCard
            key={service.id}
            title={service.name}
            description={`${service.category} · ${formatDuration(service.durationMinutes)}`}
            action={
              <Link href={`/dashboard/services/${service.id}`} className="dash-btn dash-btn-ghost">
                Edit <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="max-w-md text-[11px] leading-relaxed text-muted">{service.shortDescription}</p>
                <span className="shrink-0 font-display text-xl text-forest">{formatMoney(service.priceCents, service.currency)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className={`dash-chip ${service.isActive ? "bg-[#e6efe7] text-[#2f5c42]" : "bg-[#f2f0ec] text-[#6f6a63]"}`}>{service.isActive ? "Visible" : "Hidden"}</span>
                <span className="dash-chip bg-[#efe9df] text-[#5d5448]">{service.bufferBeforeMinutes} min before</span>
                <span className="dash-chip bg-[#efe9df] text-[#5d5448]">{service.bufferAfterMinutes} min after</span>
                {addons.filter((addon) => addon.isActive).length > 0 && <span className="dash-chip bg-[#f7ecda] text-[#8e612f]">{addons.filter((addon) => addon.isActive).length} add-on{addons.filter((addon) => addon.isActive).length === 1 ? "" : "s"}</span>}
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                <Scissors className="h-3.5 w-3.5 text-muted" />
                <p className="text-[10px] text-muted">
                  {staff.length ? `Offered by ${staff.map((person) => person.name.split(" ")[0]).join(", ")}` : "No therapist assigned yet"}
                </p>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
      {rows.length === 0 && (
        <div className="dash-card p-10 text-center">
          <p className="text-sm font-medium">No treatments yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">Create a treatment, assign it to a therapist, and it will appear on the storefront and booking page.</p>
          <Link href="/dashboard/services/new" className="dash-btn dash-btn-primary mt-4"><Plus className="h-3.5 w-3.5" /> Create treatment</Link>
        </div>
      )}
    </div>
  );
}
