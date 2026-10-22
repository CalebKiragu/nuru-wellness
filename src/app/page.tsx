import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontHome } from "@/components/storefront/home";
import { StorefrontShell } from "@/components/storefront/shell";
import { PlatformLanding } from "@/components/platform/landing";
import { getPublicTenant, getStorefrontConfig, getStorefrontData } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getPublicTenant();
  if (!tenant) {
    return {
      title: "Nuru Wellness — Make room for well-being",
      description:
        "A white-label storefront, booking and business platform for massage therapists and boutique spas.",
    };
  }
  const config = await getStorefrontConfig(tenant.id, "published");
  if (!config) return { title: tenant.name };
  return {
    title: config.content.seoTitle || config.content.businessName,
    description: config.content.seoDescription,
    openGraph: {
      title: config.content.seoTitle || config.content.businessName,
      description: config.content.seoDescription,
      images: [{ url: config.content.heroImage }],
      type: "website",
    },
    alternates: { canonical: "/" },
    robots: tenant.isDemo ? { index: false, follow: false } : undefined,
  };
}

export default async function HomePage() {
  const tenant = await getPublicTenant();
  if (!tenant) return <PlatformLanding />;

  const data = await getStorefrontData(tenant, "published");
  if (!data) notFound();

  return (
    <StorefrontShell data={data}>
      <StorefrontHome data={data} />
    </StorefrontShell>
  );
}
