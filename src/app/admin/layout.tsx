import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { NuruMark } from "@/components/brand/logo";
import { getAdminUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect("/login");
  if (!user.isPlatformAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#f7f3eb]">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2 text-forest">
              <NuruMark size={26} />
              <span className="font-display text-xl leading-none">Nuru</span>
            </Link>
            <span className="hidden h-4 w-px bg-line sm:block" />
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-muted sm:block">Platform admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[11px] text-muted sm:block">{user.name} · {user.email}</span>
            <Link href="/" className="dash-btn dash-btn-secondary"><ExternalLink className="h-3.5 w-3.5" /> Public site</Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="dash-btn dash-btn-ghost">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <p className="flex items-center gap-1.5 text-[10px] text-muted">
          <ShieldCheck className="h-3 w-3" /> Platform administration is separate from tenant membership. This page never exposes tenant private data to the public.
        </p>
      </footer>
    </div>
  );
}
