import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/brand/logo";
import { DEMO_CREDENTIALS } from "@/db/seed";
import { env } from "@/lib/env";
import { getSessionUser, getDashboardContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    const context = await getDashboardContext();
    if (context) redirect("/dashboard");
    if (user.isPlatformAdmin) redirect("/admin");
  }

  return (
    <div className="grid min-h-screen bg-ivory lg:grid-cols-[1.02fr_0.98fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <Image src="/media/amani/hero.jpg" alt="" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#14211b]/85 via-[#14211b]/35 to-[#14211b]/20" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-8">
          <Logo variant="light" href="/" />
          <Link href="/" className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-10 text-ivory">
          <p className="text-[10px] uppercase tracking-[0.2em] text-brass">A calmer operating system</p>
          <blockquote className="mt-4 max-w-xl font-display text-[2.6rem] leading-[1.06]">
            “Spend less time managing your business, and more time caring for your clients.”
          </blockquote>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[10px] uppercase tracking-[0.13em] text-white/65">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-brass" /> Live booking data</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-brass" /> Tenant isolation</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-brass" /> Clear demo labels</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="mt-10 lg:mt-0">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-brass">
              <Sparkles className="h-3.5 w-3.5" /> Business dashboard
            </p>
            <h1 className="mt-3 font-display text-[2.7rem] leading-none text-forest">Welcome back.</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Sign in to manage appointments, your storefront and the Nuru assistant.
            </p>
          </div>

          <div className="mt-8">
            <LoginForm
              demoMode={env.demoMode}
              accounts={env.demoMode ? DEMO_CREDENTIALS.accounts.map(({ email, label }) => ({ email, label })) : []}
              demoPassword={env.demoMode ? DEMO_CREDENTIALS.password : undefined}
            />
          </div>

          <p className="mt-8 text-center text-[10px] leading-relaxed text-muted">
            Protected by secure, HTTP-only sessions. Nuru never stores payment card details.
          </p>
        </div>
      </div>
    </div>
  );
}
