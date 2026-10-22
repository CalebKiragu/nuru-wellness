"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function MobileNav({
  businessName,
  links,
}: {
  businessName: string;
  links: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-tenant-border)] text-[var(--color-brand)] lg:hidden"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-40 border-b border-[var(--color-tenant-border)] bg-[var(--color-canvas)] px-5 pb-6 pt-3 shadow-xl lg:hidden">
          <nav className="flex flex-col" aria-label="Mobile navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-[var(--color-tenant-border)] py-4 font-display text-2xl text-[var(--color-tenant-ink)]"
              >
                {link.label}
              </Link>
            ))}
            <Link href="/book" onClick={() => setOpen(false)} className="sf-btn sf-btn-primary mt-5">
              Book a treatment
            </Link>
            <p className="mt-4 text-center text-xs text-[var(--color-tenant-muted)]">{businessName}</p>
          </nav>
        </div>
      )}
    </>
  );
}
