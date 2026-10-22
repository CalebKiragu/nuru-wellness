import type { CSSProperties } from "react";
import type { StorefrontTheme } from "@/lib/storefront";

export function storefrontStyle(theme: StorefrontTheme): CSSProperties {
  const radius =
    theme.radius === "none" ? "0px" : theme.radius === "soft" ? "0.45rem" : "1rem";
  const buttonRadius =
    theme.buttonStyle === "pill" ? "999px" : theme.buttonStyle === "outline" ? "0px" : radius;
  const spacing =
    theme.spacing === "compact" ? "4.5rem" : theme.spacing === "airy" ? "8.5rem" : "6.5rem";
  const width =
    theme.width === "narrow" ? "68rem" : theme.width === "wide" ? "84rem" : "76rem";
  const display =
    theme.displayFont === "modern"
      ? "var(--font-dm-sans), sans-serif"
      : theme.displayFont === "classic"
        ? "Georgia, 'Times New Roman', serif"
        : "var(--font-cormorant), Georgia, serif";

  return {
    "--color-brand": theme.colors.brand,
    "--color-brand-deep": theme.colors.brandDeep,
    "--color-accent": theme.colors.accent,
    "--color-canvas": theme.colors.canvas,
    "--color-surface": theme.colors.surface,
    "--color-tenant-ink": theme.colors.ink,
    "--color-tenant-muted": theme.colors.muted,
    "--color-tenant-border": theme.colors.border,
    "--color-on-brand": theme.colors.onBrand,
    "--color-soft": theme.colors.soft,
    "--tenant-radius": radius,
    "--tenant-button-radius": buttonRadius,
    "--tenant-section-y": spacing,
    "--tenant-container": width,
    "--tenant-display": display,
  } as CSSProperties;
}

export function cardClass(theme: StorefrontTheme) {
  if (theme.cardStyle === "elevated") return "sf-card sf-card-elevated";
  if (theme.cardStyle === "outline") return "border bg-transparent";
  return "sf-card";
}

export function fontClass(theme: StorefrontTheme) {
  if (theme.displayFont === "modern") return "font-sans";
  if (theme.displayFont === "classic") return "font-serif";
  return "font-display";
}
