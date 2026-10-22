import { notFound, redirect } from "next/navigation";
import { StorefrontShell } from "@/components/storefront/shell";
import { StorefrontHome } from "@/components/storefront/home";
import { getDashboardContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getStorefrontData } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Draft storefront preview",
  robots: { index: false, follow: false },
};

export default async function PreviewStorefrontPage() {
  const context = await getDashboardContext();
  if (!context) redirect("/login");
  if (!can(context.role, "storefront.edit")) redirect("/dashboard");
  const data = await getStorefrontData(context.tenant, "draft");
  if (!data) notFound();

  return (
    <StorefrontShell data={data} preview>
      <StorefrontHome data={data} />
    </StorefrontShell>
  );
}
