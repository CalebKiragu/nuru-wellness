import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { AddonForm, ServiceForm } from "@/components/dashboard/service-form";
import { DemoNote, PageHeader, SectionCard } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import { serviceAddons, services, staffProfiles, staffServices } from "@/db/schema";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "services.manage")) notFound();
  const { id } = await params;
  const db = await ensureDb();
  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, id), eq(services.tenantId, context.tenant.id)))
    .limit(1);
  if (!service) notFound();

  const [addons, links, staff] = await Promise.all([
    db
      .select()
      .from(serviceAddons)
      .where(and(eq(serviceAddons.tenantId, context.tenant.id), eq(serviceAddons.serviceId, id)))
      .orderBy(asc(serviceAddons.name)),
    db.select().from(staffServices).where(and(eq(staffServices.tenantId, context.tenant.id), eq(staffServices.serviceId, id))),
    db
      .select()
      .from(staffProfiles)
      .where(and(eq(staffProfiles.tenantId, context.tenant.id), eq(staffProfiles.isActive, true)))
      .orderBy(asc(staffProfiles.sortOrder)),
  ]);

  return (
    <div>
      <Link href="/dashboard/services" className="mb-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted hover:text-forest">
        <ArrowLeft className="h-3.5 w-3.5" /> Treatments
      </Link>
      <PageHeader
        eyebrow="Treatment"
        title={service.name}
        description={`${formatMoney(service.priceCents, service.currency)} · ${service.durationMinutes} minutes${service.isActive ? "" : " · currently hidden"}`}
        actions={<Link href="/dashboard/staff" className="dash-btn dash-btn-secondary">Assign therapists</Link>}
      />
      <DemoNote>Changes to price and duration apply to new bookings. Existing appointments retain their original value.</DemoNote>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <SectionCard title="Treatment details">
          <div className="p-4 sm:p-5"><ServiceForm service={service} /></div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Add-ons" description="Optional extras offered during booking">
            <div className="p-4 sm:p-5">
              <AddonForm serviceId={service.id} addons={addons.filter((addon) => addon.isActive)} />
            </div>
          </SectionCard>

          <SectionCard title="Therapists" description="Who can perform this treatment">
            <ul className="divide-y divide-[#efeae1]">
              {staff.map((person) => {
                const assigned = links.some((link) => link.staffId === person.id);
                return (
                  <li key={person.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                    <span className="inline-flex items-center gap-2 text-[11px]"><span className="h-2 w-2 rounded-full" style={{ background: person.color }} /> {person.name}</span>
                    <span className={`dash-chip ${assigned ? "bg-[#e6efe7] text-[#2f5c42]" : "bg-[#f2f0ec] text-[#6f6a63]"}`}>{assigned ? "Assigned" : "Not assigned"}</span>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
