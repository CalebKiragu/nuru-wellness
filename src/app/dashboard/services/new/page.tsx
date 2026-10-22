import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ServiceForm } from "@/components/dashboard/service-form";
import { DemoNote, PageHeader, SectionCard } from "@/components/dashboard/ui";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewServicePage() {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "services.manage")) notFound();

  return (
    <div>
      <Link href="/dashboard/services" className="mb-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted hover:text-forest">
        <ArrowLeft className="h-3.5 w-3.5" /> Treatments
      </Link>
      <PageHeader eyebrow="Business" title="New treatment" description="Add a service to the menu. You can assign therapists and add-ons after saving." />
      <DemoNote>Demo prices are in Kenyan shillings and no payment is collected.</DemoNote>
      <div className="max-w-3xl">
        <SectionCard title="Treatment details">
          <div className="p-4 sm:p-5"><ServiceForm /></div>
        </SectionCard>
      </div>
    </div>
  );
}
