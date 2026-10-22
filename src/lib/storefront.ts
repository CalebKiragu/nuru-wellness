export type StorefrontTheme = {
  preset: "botanical" | "coastal" | "earth" | "custom";
  colors: {
    brand: string;
    brandDeep: string;
    accent: string;
    canvas: string;
    surface: string;
    ink: string;
    muted: string;
    border: string;
    onBrand: string;
    soft: string;
  };
  displayFont: "editorial" | "modern" | "classic";
  radius: "none" | "soft" | "rounded";
  buttonStyle: "solid" | "outline" | "pill";
  cardStyle: "flat" | "elevated" | "outline";
  width: "narrow" | "standard" | "wide";
  spacing: "compact" | "balanced" | "airy";
};

export type StorefrontSection = {
  key: "hero" | "services" | "about" | "team" | "gallery" | "testimonials" | "location";
  label: string;
  visible: boolean;
  sortOrder: number;
};

export type StorefrontContent = {
  businessName: string;
  tagline: string;
  heroEyebrow: string;
  heroTitle: string;
  heroText: string;
  heroImage: string;
  heroImageAlt: string;
  heroFocal: string;
  primaryCta: string;
  secondaryCta: string;
  servicesEyebrow: string;
  servicesTitle: string;
  servicesText: string;
  aboutTitle: string;
  aboutText: string;
  aboutImage: string;
  aboutImageAlt: string;
  aboutHighlights: string[];
  teamTitle: string;
  teamText: string;
  galleryTitle: string;
  galleryText: string;
  galleryImages: { url: string; alt: string }[];
  testimonialsTitle: string;
  testimonialsText: string;
  testimonials: { quote: string; author: string; service: string }[];
  locationTitle: string;
  locationText: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  hours: { day: string; hours: string }[];
  instagram?: string;
  instagramUrl?: string;
  footerNote: string;
  cancellationPolicy: string;
  depositPolicy: string;
  arrivalPolicy: string;
  seoTitle: string;
  seoDescription: string;
};

export type StorefrontConfig = {
  theme: StorefrontTheme;
  content: StorefrontContent;
  sections: StorefrontSection[];
  version?: number;
  updatedAt?: string;
};

export const defaultSections: StorefrontSection[] = [
  { key: "hero", label: "Hero", visible: true, sortOrder: 0 },
  { key: "services", label: "Services", visible: true, sortOrder: 1 },
  { key: "about", label: "About", visible: true, sortOrder: 2 },
  { key: "team", label: "Team", visible: true, sortOrder: 3 },
  { key: "gallery", label: "Gallery", visible: true, sortOrder: 4 },
  { key: "testimonials", label: "Testimonials", visible: true, sortOrder: 5 },
  { key: "location", label: "Location & contact", visible: true, sortOrder: 6 },
];

export const themePresets: { id: StorefrontTheme["preset"]; name: string; description: string; theme: StorefrontTheme }[] = [
  {
    id: "botanical",
    name: "Botanical Luxury",
    description: "Forest, ivory and restrained brass. Warm, grounded and quietly premium.",
    theme: {
      preset: "botanical",
      colors: {
        brand: "#24483D",
        brandDeep: "#18332A",
        accent: "#B08D5B",
        canvas: "#F5F0E7",
        surface: "#FFFFFF",
        ink: "#28352F",
        muted: "#657067",
        border: "#E4DED3",
        onBrand: "#F8F4EC",
        soft: "#E8EDE4",
      },
      displayFont: "editorial",
      radius: "soft",
      buttonStyle: "solid",
      cardStyle: "flat",
      width: "standard",
      spacing: "airy",
    },
  },
  {
    id: "coastal",
    name: "Coastal Calm",
    description: "Sea glass, sand and soft blue. Luminous and easy, with generous space.",
    theme: {
      preset: "coastal",
      colors: {
        brand: "#2E5560",
        brandDeep: "#1E3C45",
        accent: "#C08C6B",
        canvas: "#F4EFE6",
        surface: "#FFFDF8",
        ink: "#24383C",
        muted: "#67787A",
        border: "#E1DBD0",
        onBrand: "#F9F7F1",
        soft: "#DCE7E4",
      },
      displayFont: "editorial",
      radius: "soft",
      buttonStyle: "solid",
      cardStyle: "elevated",
      width: "wide",
      spacing: "airy",
    },
  },
  {
    id: "earth",
    name: "Warm Earth",
    description: "Clay, cream and deep umber. Tactile and intimate, inspired by natural textures.",
    theme: {
      preset: "earth",
      colors: {
        brand: "#5B3A2E",
        brandDeep: "#42281F",
        accent: "#A96D52",
        canvas: "#F7EFE3",
        surface: "#FFFBF4",
        ink: "#2F2621",
        muted: "#75685F",
        border: "#E6DACB",
        onBrand: "#FBF5EA",
        soft: "#EFE4D5",
      },
      displayFont: "editorial",
      radius: "rounded",
      buttonStyle: "pill",
      cardStyle: "outline",
      width: "standard",
      spacing: "balanced",
    },
  },
];

export function presetTheme(id: StorefrontTheme["preset"]): StorefrontTheme {
  return structuredClone(themePresets.find((p) => p.id === id)?.theme ?? themePresets[0].theme);
}

export const sectionLabels: Record<StorefrontSection["key"], string> = {
  hero: "Hero",
  services: "Services",
  about: "About the studio",
  team: "Therapist / team",
  gallery: "Gallery",
  testimonials: "Testimonials",
  location: "Location & contact",
};

export function sortedVisibleSections(config: StorefrontConfig): StorefrontSection[] {
  return [...config.sections].filter((s) => s.visible).sort((a, b) => a.sortOrder - b.sortOrder);
}
