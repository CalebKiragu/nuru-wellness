import { notFound } from "next/navigation";
import { CalendarClock, Clock, Users } from "lucide-react";
import { NewStaffForm } from "@/components/dashboard/new-staff-form";
import { StaffEditor } from "@/components/dashboard/staff-editor";
import { HoursForm } from "@/components/dashboard/hours-form";
import { DemoNote, EmptyState, PageHeader, SectionCard } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";
import { getBusinessHours, listStaff } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "staff.manage")) notFound();

  const db = await ensureDb();
  const [{ staff, allServices }, hours] = await Promise.all([
    listStaff(db, context.tenant.id),
    getBusinessHours(db, context.tenant.id),
  ]);

  const active = staff.filter((row) => row.person.isActive);
  const openDays = hours.filter((row) => !row.isClosed);
  const upcomingTimeOff = staff.reduce((sum, row) => sum + row.timeOff.length, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Business"
        title="Team & hours"
        description="Who works here, which treatments they offer, their weekly availability, and the studio's opening hours."
        actions={<NewStaffForm services={allServices.map((service) => ({ id: service.id, name: service.name }))} />}
      />
      <DemoNote>Availability is calculated from opening hours, therapist schedules, time off and existing bookings. Changes apply to new bookings only; existing appointments are never moved automatically.</DemoNote>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="dash-card p-4"><p className="dash-label">Team members</p><p className="font-display text-3xl text-forest">{staff.length}</p></div>
        <div className="dash-card p-4"><p className="dash-label">Active</p><p className="font-display text-3xl text-forest">{active.length}</p></div>
        <div className="dash-card p-4"><p className="dash-label">Open days</p><p className="font-display text-3xl text-forest">{openDays.length}</p></div>
        <div className="dash-card p-4"><p className="dash-label">Upcoming time off</p><p className="font-display text-3xl text-forest">{upcomingTimeOff}</p></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          {staff.length === 0 && (
            <div className="dash-card">
              <EmptyState
                title="No team members yet"
                description="Add a therapist and assign treatments so clients can book with them."
              />
            </div>
          )}
          {staff.map(({ person, availability, timeOff, services }) => (
            <SectionCard
              key={person.id}
              title={person.name}
              description={`${person.title} · ${services.length} treatment${services.length === 1 ? "" : "s"}${person.isActive ? "" : " · hidden from storefront"}`}
            >
              <div className="p-4 sm:p-5">
                <StaffEditor
                  person={{
                    id: person.id,
                    name: person.name,
                    title: person.title,
                    bio: person.bio,
                    email: person.email,
                    phone: person.phone,
                    color: person.color,
                    isActive: person.isActive,
                  }}
                  availability={availability.map((row) => ({ weekday: row.weekday, startTime: row.startTime, endTime: row.endTime }))}
                  timeOff={timeOff.map((row) => ({ id: row.id, startsAt: row.startsAt, endsAt: row.endsAt, reason: row.reason }))}
                  services={services.map((service) => ({ id: service.id, name: service.name }))}
                  allServices={allServices.map((service) => ({ id: service.id, name: service.name }))}
                  timezone={context.tenant.timezone}
                />
              </div>
            </SectionCard>
          ))}
        </div>

        <div className="space-y-5">
          <SectionCard title="Studio opening hours" description="The outer boundary for every bookable slot">
            <div className="p-4 sm:p-5">
              <HoursForm hours={hours.map((row) => ({ weekday: row.weekday, opensAt: row.opensAt, closesAt: row.closesAt, isClosed: row.isClosed }))} />
            </div>
          </SectionCard>

          <SectionCard title="How availability works">
            <div className="space-y-4 p-4 text-[11px] leading-relaxed text-muted sm:p-5">
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />
                <p>A slot must fit inside both the studio&apos;s opening hours and the therapist&apos;s working hours for that weekday.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />
                <p>Service buffers, existing bookings and time off are subtracted before a time is offered to a client.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />
                <p>The server recalculates availability inside the booking transaction, so two clients cannot take the same slot.</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
