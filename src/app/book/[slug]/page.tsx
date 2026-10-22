import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { BookingFlow } from "@/components/storefront/booking-flow";
import { StorefrontShell } from "@/components/storefront/shell";
import { getPublicTenant, getStorefrontData } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ staff?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getPublicTenant();
  if (!tenant) return {};
  const data = await getStorefrontData(tenant);
  const service = data?.services.find((entry) => entry.slug === slug);
  return { title: service ? `Book ${service.name} — ${tenant.name}` : "Book a treatment" };
}

export default async function BookServicePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { staff: initialStaffId } = await searchParams;
  const tenant = await getPublicTenant();
  if (!tenant) notFound();
  const data = await getStorefrontData(tenant);
  if (!data) notFound();
  const service = data.services.find((entry) => entry.slug === slug);
  if (!service) notFound();

  const closedWeekdays = new Set(data.hours.filter((hour) => hour.isClosed).map((hour) => hour.weekday));
  const dates = Array.from({ length: 21 }, (_, offset) => {
    const date = addDays(new Date(), offset);
    const key = formatInTimeZone(date, tenant.timezone, "yyyy-MM-dd");
    const weekday = formatInTimeZone(date, tenant.timezone, "EEE");
    const weekdayNumber = Number(formatInTimeZone(date, tenant.timezone, "i")) % 7;
    return {
      key,
      weekday,
      day: formatInTimeZone(date, tenant.timezone, "d"),
      month: formatInTimeZone(date, tenant.timezone, "MMM"),
      closed: closedWeekdays.has(weekdayNumber),
    };
  });

  return (
    <StorefrontShell data={data}>
      <div className="bg-[color-mix(in_srgb,var(--color-soft)_24%,var(--color-canvas))]">
        <div className="sf-container py-7">
          <p className="sf-eyebrow">Book online</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">{service.name}</h1>
        </div>
      </div>
      <BookingFlow
        businessName={data.config.content.businessName}
        timezone={tenant.timezone}
        currency={service.currency}
        service={{
          id: service.id,
          slug: service.slug,
          name: service.name,
          shortDescription: service.shortDescription,
          durationMinutes: service.durationMinutes,
          priceCents: service.priceCents,
        }}
        staff={service.staff.map((person) => ({
          id: person.id,
          name: person.name,
          title: person.title,
          imageUrl: person.imageUrl,
        }))}
        addons={service.addons}
        dates={dates}
        initialStaffId={initialStaffId}
      />
      <div className="h-20 lg:hidden" />
    </StorefrontShell>
  );
}
