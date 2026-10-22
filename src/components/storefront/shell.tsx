import Link from "next/link";
import { ArrowUpRight, Clock, Instagram, MapPin, Phone } from "lucide-react";
import type { StorefrontData } from "@/lib/tenant";
import { env } from "@/lib/env";
import { storefrontStyle } from "./theme";
import { MobileNav } from "./mobile-nav";

const navLinks = [
  { href: "/#services", label: "Treatments" },
  { href: "/#about", label: "Studio" },
  { href: "/#team", label: "Therapists" },
  { href: "/#gallery", label: "Gallery" },
  { href: "/#visit", label: "Visit" },
];

function TenantMark({ color }: { color: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 33V20" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20 33c0-8 3.6-13 11.5-15-.7 8.7-4.3 13-11.5 15Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M20 33c0-5-2.2-8.6-7.2-10 .1 5.8 2.9 8.6 7.2 10Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" opacity="0.5" />
      <circle cx="22" cy="13.5" r="2.6" fill={color} opacity="0.9" />
    </svg>
  );
}

export function StorefrontShell({
  data,
  children,
  preview = false,
}: {
  data: StorefrontData;
  children: React.ReactNode;
  preview?: boolean;
}) {
  const { config, tenant } = data;
  const content = config.content;
  const demo = tenant.isDemo || env.demoMode;

  return (
    <div className="sf-root min-h-screen" style={storefrontStyle(config.theme)} data-tenant={tenant.slug}>
      {demo && (
        <div className="relative z-50 bg-[var(--color-brand-deep)] px-4 py-1.5 text-center text-[10px] font-medium tracking-[0.16em] text-[var(--color-on-brand)]/90 uppercase">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] align-middle" />
          Demonstration storefront · bookings are saved in a demo database
          <Link href={`${env.appUrl}/login`} className="ml-3 hidden text-[var(--color-on-brand)] underline underline-offset-2 sm:inline">
            Dashboard
          </Link>
        </div>
      )}
      {preview && (
        <div className="relative z-50 bg-[#B97861] px-4 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
          Draft preview — not visible to customers
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-[var(--color-tenant-border)]/80 bg-[var(--color-canvas)]/92 backdrop-blur-md">
        <div className="sf-container relative flex h-[74px] items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 text-[var(--color-brand)]" aria-label={`${content.businessName} home`}>
            <TenantMark color="var(--color-brand)" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[1.55rem] leading-none tracking-[0.01em]">{content.businessName}</span>
              <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.28em] text-[var(--color-tenant-muted)]">
                {tenant.slug === "bahari" ? "Mombasa" : "Nairobi"}
              </span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-tenant-muted)] transition-colors hover:text-[var(--color-brand)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/book" className="sf-btn sf-btn-primary hidden sm:inline-flex">
              Book a treatment
            </Link>
            <MobileNav businessName={content.businessName} links={navLinks} />
          </div>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="border-t border-[var(--color-tenant-border)] bg-[var(--color-canvas)]">
        <div className="sf-container grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5 text-[var(--color-brand)]">
              <TenantMark color="var(--color-brand)" />
              <span className="font-display text-3xl">{content.businessName}</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--color-tenant-muted)]">{content.tagline}</p>
            <p className="mt-6 text-[10px] uppercase tracking-[0.18em] text-[var(--color-tenant-muted)]">
              {demo ? "Demonstration business" : "Independent studio"}
            </p>
          </div>

          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-tenant-ink)]">Visit</h2>
            <address className="mt-4 space-y-2 text-sm not-italic leading-relaxed text-[var(--color-tenant-muted)]">
              <p className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {content.address}
                  <br />
                  {content.city}
                </span>
              </p>
              <p className="flex gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <a href={`tel:${content.phone}`} className="hover:text-[var(--color-brand)]">{content.phone}</a>
              </p>
              <p className="flex gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{content.hours[1]?.hours ?? "By appointment"}</span>
              </p>
            </address>
          </div>

          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-tenant-ink)]">Explore</h2>
            <ul className="mt-4 space-y-2 text-sm text-[var(--color-tenant-muted)]">
              <li><Link href="/#services" className="hover:text-[var(--color-brand)]">Treatment menu</Link></li>
              <li><Link href="/book" className="hover:text-[var(--color-brand)]">Book online</Link></li>
              <li><Link href="/policies" className="hover:text-[var(--color-brand)]">Booking policies</Link></li>
              <li>
                <a href={`mailto:${content.email}`} className="inline-flex items-center gap-1 hover:text-[var(--color-brand)]">
                  Contact <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </a>
              </li>
              {content.instagramUrl && (
                <li>
                  <a href={content.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-[var(--color-brand)]">
                    <Instagram className="h-3.5 w-3.5" aria-hidden="true" /> {content.instagram ?? "Instagram"}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-[var(--color-tenant-border)]">
          <div className="sf-container flex flex-col gap-3 py-6 text-[10px] uppercase tracking-[0.14em] text-[var(--color-tenant-muted)] sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {content.businessName}. All rights reserved.</p>
            <p className="normal-case tracking-normal">
              {content.footerNote}{" "}
              <a href={env.appUrl} className="underline underline-offset-2 hover:text-[var(--color-brand)]">
                Nuru Wellness
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
