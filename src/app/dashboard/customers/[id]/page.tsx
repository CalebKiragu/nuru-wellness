import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { CustomerForm } from "@/components/dashboard/customer-form";
import { DemoNote, PageHeader, SectionCard, StatusBadge } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";
import { getCustomerDetail } from "@/lib/dashboard-data";
import { formatDate, formatMoney, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "customers.view")) notFound();
  const { id } = await params;
  const db = await ensureDb();
  const detail = await getCustomerDetail(db, context.tenant.id, id);
  if (!detail) notFound();
  const timezone = context.tenant.timezone;
  const marketing = detail.consents.find((entry) => entry.type === "marketing")?.granted ?? false;
  const completed = detail.history.filter((entry) => entry.booking.status === "completed");
  const spend = completed.reduce((sum, entry) => sum + entry.booking.priceCents, 0);
  const canManage = can(context.role, "customers.manage");

  return (
    <div>
      <Link href="/dashboard/customers" className="mb-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted hover:text-forest">
        <ArrowLeft className="h-3.5 w-3.5" /> All clients
      </Link>
      <PageHeader
        eyebrow="Client record"
        title={detail.customer.name}
        description={`${detail.history.length} appointment${detail.history.length === 1 ? "" : "s"} in this workspace · ${formatMoney(spend, context.tenant.currency)} completed value`}
        actions={<span className={`dash-chip ${marketing ? "bg-[#e6efe7] text-[#2f5c42]" : "bg-[#f2f0ec] text-[#6f6a63]"}`}>{marketing ? "Marketing opted in" : "Marketing not opted in"}</span>}
      />
      <DemoNote>This client record belongs only to {context.tenant.name}. It is never visible to another workspace.</DemoNote>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <SectionCard title="Appointment history" description="All appointments, including cancellations">
            {detail.history.length === 0 ? (
              <p className="px-4 py-8 text-center text-[11px] text-muted">No appointments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="dash-table w-full min-w-[34rem]">
                  <thead><tr><th>When</th><th>Treatment</th><th>Therapist</th><th>Value</th><th>Status</th></tr></thead>
                  <tbody>
                    {detail.history.map(({ booking, service, staff }) => (
                      <tr key={booking.id} className="hover:bg-[#faf6ef]">
                        <td className="whitespace-nowrap">
                          <Link href={`/dashboard/bookings/${booking.id}`} className="block">
                            <span className="text-[11px] font-medium">{formatDate(booking.startsAt, timezone, "d MMM yyyy")}</span>
                            <span className="block text-[10px] text-muted">{formatTime(booking.startsAt, timezone)}</span>
                          </Link>
                        </td>
                        <td><span className="text-[11px]">{service.name}</span></td>
                        <td><span className="text-[11px] text-muted">{staff.name.split(" ")[0]}</span></td>
                        <td><span className="text-[11px] tabular-nums">{formatMoney(booking.priceCents, booking.currency)}</span></td>
                        <td><StatusBadge status={booking.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Communication" description="Simulated or provider-accepted messages">
            {detail.messages.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-muted">No messages recorded for this client.</p>
            ) : (
              <ul className="divide-y divide-[#efeae1]">
                {detail.messages.map((message) => (
                  <li key={message.id} className="px-4 py-3 sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium">{message.subject ?? "Message"}</p>
                      <span className={`dash-chip ${message.status === "sent" ? "bg-[#e6efe7] text-[#2f5c42]" : message.status === "failed" ? "bg-[#f6e4df] text-[#8f4332]" : "bg-[#f7ecda] text-[#8e612f]"}`}>
                        {message.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted">{formatDate(message.createdAt, timezone, "d MMM yyyy, h:mm a")} · {message.channel} · {message.provider}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Contact details">
            <div className="space-y-3 p-4 sm:p-5">
              {detail.customer.email && <a href={`mailto:${detail.customer.email}`} className="flex items-center gap-2 text-xs hover:text-forest"><Mail className="h-3.5 w-3.5 text-muted" /> {detail.customer.email}</a>}
              {detail.customer.phone && <a href={`tel:${detail.customer.phone}`} className="flex items-center gap-2 text-xs hover:text-forest"><Phone className="h-3.5 w-3.5 text-muted" /> {detail.customer.phone}</a>}
              <p className="text-[10px] text-muted">Client since {formatDate(detail.customer.createdAt, timezone, "d MMM yyyy")}</p>
            </div>
          </SectionCard>

          {canManage ? (
            <SectionCard title="Edit client" description="Private to this workspace">
              <div className="p-4 sm:p-5"><CustomerForm customer={detail.customer} /></div>
            </SectionCard>
          ) : (
            <SectionCard title="Private note">
              <p className="p-4 text-xs leading-relaxed text-muted sm:p-5">{detail.customer.notes || "No note recorded."}</p>
            </SectionCard>
          )}

          <SectionCard title="Consent record">
            <ul className="divide-y divide-[#efeae1]">
              {detail.consents.map((consent) => (
                <li key={consent.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                  <div>
                    <p className="text-[11px] font-medium capitalize">{consent.type}</p>
                    <p className="text-[10px] text-muted">{consent.source} · {formatDate(consent.createdAt, timezone, "d MMM yyyy")}</p>
                  </div>
                  <span className={`dash-chip ${consent.granted ? "bg-[#e6efe7] text-[#2f5c42]" : "bg-[#f2f0ec] text-[#6f6a63]"}`}>{consent.granted ? "Granted" : "Declined"}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
