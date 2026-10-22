import { addDays, format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { eq, sql } from "drizzle-orm";
import type { Database } from "./index";
import * as s from "./schema";
import { hashPassword } from "@/lib/auth/password";
import { hashPayload } from "@/lib/hash";
import { defaultSections, presetTheme, type StorefrontContent, type StorefrontConfig } from "@/lib/storefront";

const TZ = "Africa/Nairobi";

const IMG = {
  amani: {
    hero: "/media/amani/hero.jpg",
    oil: "/media/amani/oil.jpg",
    stones: "/media/amani/stones.jpg",
    hands: "/media/amani/hands.jpg",
    detail: "/media/amani/detail.jpg",
    sauna: "/media/amani/sauna.jpg",
    zawadi: "/media/amani/zawadi.jpg",
    jabari: "/media/amani/jabari.jpg",
  },
  bahari: {
    hero: "/media/bahari/hero.jpg",
    pool: "/media/bahari/pool.jpg",
    wave: "/media/bahari/wave.jpg",
    beach: "/media/bahari/beach.jpg",
    stones: "/media/bahari/stones.jpg",
    neema: "/media/bahari/neema.jpg",
    leila: "/media/bahari/leila.jpg",
  },
};

const DEMO_PASSWORD = "NuruDemo2026!";

function localDateString(offsetDays: number) {
  return format(addDays(new Date(), offsetDays), "yyyy-MM-dd");
}

function at(dateKey: string, time: string) {
  return fromZonedTime(`${dateKey}T${time}:00`, TZ);
}

function bookingReference(prefix: string, index: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "";
  let seed = index * 7919 + prefix.length * 104729;
  for (let i = 0; i < 4; i += 1) {
    value += alphabet[seed % alphabet.length];
    seed = Math.floor(seed / 7) + 31;
  }
  return `${prefix}-${value}`;
}

function dateForWeekday(startOffset: number, weekdays: number[]) {
  for (let i = startOffset; i < startOffset + 14; i += 1) {
    const key = localDateString(i);
    const weekday = Number(formatInTimeZone(fromZonedTime(`${key}T12:00:00`, TZ), TZ, "i")) % 7;
    if (weekdays.includes(weekday)) return key;
  }
  return localDateString(startOffset);
}

const amaniContent: StorefrontContent = {
  businessName: "Amani Bodywork",
  tagline: "Make room for well-being.",
  heroEyebrow: "Kilimani, Nairobi · By appointment",
  heroTitle: "A quieter way to come back to yourself.",
  heroText:
    "Thoughtful therapeutic massage in a calm, sunlit studio. Every session begins with listening, and ends with a little more room to breathe.",
  heroImage: IMG.amani.hero,
  heroImageAlt: "A therapist working slowly and attentively across a client's shoulders",
  heroFocal: "center",
  primaryCta: "Book a treatment",
  secondaryCta: "Explore services",
  servicesEyebrow: "The treatment menu",
  servicesTitle: "Time that is entirely your own.",
  servicesText:
    "Each treatment is adapted to you on the day. Pressure, pace and focus are always discussed before we begin.",
  aboutTitle: "A small studio with a generous pace.",
  aboutText:
    "Amani is an independent bodywork studio in Kilimani. We keep our diary spacious, our rooms quiet and our approach unhurried. Warm oils are blended locally, linens are changed between every guest, and nothing is rushed. Whether you are here for recovery, rest or simply an hour away from a full calendar, the intention is the same: care that feels personal.",
  aboutImage: IMG.amani.detail,
  aboutImageAlt: "A calm treatment detail with rolled towels, a candle and a diffuser",
  aboutHighlights: [
    "Two experienced therapists",
    "Private, quiet treatment rooms",
    "Locally blended massage oils",
    "Evening appointments Tuesday to Friday",
  ],
  teamTitle: "The hands behind Amani.",
  teamText:
    "Our therapists are experienced, insured and committed to ongoing professional development. You can request the same therapist each visit, or let us match you with the right person for your treatment.",
  galleryTitle: "A look inside the studio.",
  galleryText:
    "Natural light, warm wood and quiet corners. Demonstration imagery shown until the studio's own photographs are added.",
  galleryImages: [
    { url: IMG.amani.oil, alt: "Warm oil being poured during a massage" },
    { url: IMG.amani.hero, alt: "A therapist working with focused, gentle pressure" },
    { url: IMG.amani.sauna, alt: "Warm cedar treatment room with soft lighting" },
    { url: IMG.amani.stones, alt: "Hot stone treatment with white orchid detail" },
    { url: IMG.amani.hands, alt: "Close-up of a therapeutic back massage" },
    { url: IMG.amani.detail, alt: "Treatment room still life with towels and candlelight" },
  ],
  testimonialsTitle: "In their words.",
  testimonialsText: "Illustrative testimonials for this demonstration storefront. They are not real customer reviews.",
  testimonials: [
    {
      quote:
        "The studio feels like a deep breath. Zawadi listened carefully, adjusted the pressure exactly as I asked, and I left feeling like myself again.",
      author: "Wanjiru K.",
      service: "Deep Tissue Reset",
    },
    {
      quote:
        "Beautiful space, thoughtful details, and none of the usual rush. The hot stone ritual was the best ninety minutes of my month.",
      author: "Amina M.",
      service: "Hot Stone Ritual",
    },
    {
      quote:
        "I booked for a stiff shoulder and stayed for the calm. Jabari is skilled, kind and completely professional.",
      author: "David O.",
      service: "Head & Shoulder Release",
    },
  ],
  locationTitle: "Find us in Kilimani.",
  locationText:
    "The studio is a short walk from Yaya Centre, with secure parking on site. Please arrive ten minutes early so you can settle in.",
  address: "Riverside Drive, Kilimani",
  city: "Nairobi, Kenya",
  phone: "+254 712 000 145",
  email: "hello@amanibodywork.demo",
  hours: [
    { day: "Monday", hours: "Closed" },
    { day: "Tuesday – Friday", hours: "9:00 am – 7:00 pm" },
    { day: "Saturday", hours: "9:00 am – 5:00 pm" },
    { day: "Sunday", hours: "Closed" },
  ],
  instagram: "@amanibodywork",
  instagramUrl: "https://instagram.com",
  footerNote: "Amani Bodywork is a demonstration business powered by Nuru Wellness.",
  cancellationPolicy:
    "We ask for at least 24 hours' notice to cancel or reschedule. Late cancellations may be charged at 50% of the treatment price. In this demonstration, no payment is collected.",
  depositPolicy:
    "No deposit is required to book in this demonstration. A production studio can choose to require a deposit through its payment provider.",
  arrivalPolicy:
    "Please arrive ten minutes before your appointment. If you are running late, call us and we will do what we can to preserve your full treatment time.",
  seoTitle: "Amani Bodywork — Therapeutic massage in Kilimani, Nairobi",
  seoDescription:
    "Thoughtful therapeutic massage in a calm Kilimani studio. Deep tissue, restorative Swedish, hot stone and prenatal treatments. Book online.",
};

const bahariContent: StorefrontContent = {
  businessName: "Bahari House",
  tagline: "Room to exhale.",
  heroEyebrow: "Nyali, Mombasa · Steps from the sea",
  heroTitle: "Where the coast slows you down.",
  heroText:
    "A garden spa in Nyali with open-air treatment rooms, salt air and a deliberately unhurried approach. Come for the treatment; stay for the quiet.",
  heroImage: IMG.bahari.hero,
  heroImageAlt: "A tranquil coastal garden walkway leading toward the ocean",
  heroFocal: "center",
  primaryCta: "Reserve a ritual",
  secondaryCta: "View the menu",
  servicesEyebrow: "Rituals of the coast",
  servicesTitle: "Salt, warmth and time.",
  servicesText:
    "Our therapists blend coastal botanicals with considered bodywork. Every ritual includes a consultation and time to settle before we begin.",
  aboutTitle: "A garden between the city and the sea.",
  aboutText:
    "Bahari House began as a private garden shaded by palms and frangipani. Today it is a small day spa with three open-air rooms, a plunge pool and a team that understands the pace of the coast. We use reef-safe oils, line-dried linen and a simple rule: never rush a guest from one thing to the next.",
  aboutImage: IMG.bahari.pool,
  aboutImageAlt: "A calm resort pool framed by palm trees and loungers",
  aboutHighlights: [
    "Open-air treatment rooms",
    "Reef-safe botanical oils",
    "Garden plunge pool",
    "Couples' rituals by arrangement",
  ],
  teamTitle: "Your hosts at Bahari.",
  teamText:
    "Neema founded Bahari House after a decade in hospitality. Leila leads our bodywork team and is known for deep, grounding pressure delivered at an easy pace.",
  galleryTitle: "The house and gardens.",
  galleryText:
    "Demonstration imagery from the Kenyan coast until Bahari House's own photography is added.",
  galleryImages: [
    { url: IMG.bahari.hero, alt: "Palm-lined walkway at a coastal spa" },
    { url: IMG.bahari.pool, alt: "Pool deck with loungers and palms" },
    { url: IMG.bahari.wave, alt: "A wave breaking in warm evening light" },
    { url: IMG.bahari.beach, alt: "White sand and turquoise water" },
    { url: IMG.bahari.stones, alt: "Hot stone massage detail with orchid" },
    { url: IMG.bahari.stones, alt: "Therapeutic massage in progress" },
  ],
  testimonialsTitle: "Notes from the guest book.",
  testimonialsText: "Illustrative testimonials for this demonstration storefront. They are not real customer reviews.",
  testimonials: [
    {
      quote:
        "I arrived wound up from a week of meetings and left feeling like I'd been away for a fortnight. The garden alone is worth the visit.",
      author: "Fatuma A.",
      service: "Ocean Flow Massage",
    },
    {
      quote:
        "Neema has created somewhere genuinely special. The sandstone warmth ritual was grounding, warm and deeply relaxing.",
      author: "Peter N.",
      service: "Sandstone Warmth",
    },
  ],
  locationTitle: "Nyali, on the north coast.",
  locationText:
    "We are five minutes from Nyali Beach and ten minutes from the Mombasa road. Parking is available in the garden.",
  address: "Links Road, Nyali",
  city: "Mombasa, Kenya",
  phone: "+254 722 000 318",
  email: "stay@baharihouse.demo",
  hours: [
    { day: "Monday – Tuesday", hours: "9:00 am – 6:00 pm" },
    { day: "Wednesday", hours: "Closed" },
    { day: "Thursday – Sunday", hours: "9:00 am – 7:00 pm" },
  ],
  instagram: "@bahari.house",
  instagramUrl: "https://instagram.com",
  footerNote: "Bahari House is a demonstration business powered by Nuru Wellness.",
  cancellationPolicy:
    "Please give us 24 hours' notice to change or cancel a reservation. No payment is collected in this demonstration.",
  depositPolicy:
    "No deposit is required in this demonstration. Bahari House would normally request a 25% deposit for couples' rituals.",
  arrivalPolicy:
    "Arrive fifteen minutes early to enjoy the garden and complete a short consultation before your ritual.",
  seoTitle: "Bahari House — Coastal day spa in Nyali, Mombasa",
  seoDescription:
    "A quiet garden spa in Nyali, Mombasa. Coastal massage rituals, open-air treatment rooms and time to exhale. Reserve online.",
};

function configFor(themeId: StorefrontConfig["theme"]["preset"], content: StorefrontContent): StorefrontConfig {
  return { theme: presetTheme(themeId), content, sections: structuredClone(defaultSections) };
}

async function createTenantData(tx: Database, opts: {
  slug: string;
  name: string;
  themeId: StorefrontConfig["theme"]["preset"];
  content: StorefrontContent;
  timezone: string;
  isDemo: boolean;
  ownerId: string;
}) {
  const [tenant] = await tx
    .insert(s.tenants)
    .values({
      slug: opts.slug,
      name: opts.name,
      status: "active",
      timezone: opts.timezone,
      currency: "KES",
      locale: "en-KE",
      isDemo: opts.isDemo,
    })
    .returning();

  await tx.insert(s.tenantMemberships).values({ tenantId: tenant.id, userId: opts.ownerId, role: "owner" });
  await tx.insert(s.tenantDomains).values([
    { tenantId: tenant.id, hostname: `${opts.slug}.localhost`, isPrimary: true },
    { tenantId: tenant.id, hostname: `${opts.slug}.nuruwellness.test`, isPrimary: false },
  ]);
  await tx.insert(s.tenantSubscriptions).values({ tenantId: tenant.id, plan: "studio", status: "trialing" });

  const config = configFor(opts.themeId, opts.content);
  await tx.insert(s.storefrontConfigs).values({
    tenantId: tenant.id,
    draft: config as unknown as Record<string, unknown>,
    published: config as unknown as Record<string, unknown>,
    updatedBy: opts.ownerId,
  });
  await tx.insert(s.storefrontSections).values(
    config.sections.map((section) => ({
      tenantId: tenant.id,
      key: section.key,
      label: section.label,
      sortOrder: section.sortOrder,
      visible: section.visible,
      content: {},
    })),
  );
  await tx.insert(s.publishedVersions).values({
    tenantId: tenant.id,
    version: 1,
    snapshot: config as unknown as Record<string, unknown>,
    note: "Initial publication",
    createdBy: opts.ownerId,
  });
  await tx.insert(s.pages).values({
    tenantId: tenant.id,
    slug: "policies",
    title: "Booking policies",
    content: {
      cancellation: opts.content.cancellationPolicy,
      deposit: opts.content.depositPolicy,
      arrival: opts.content.arrivalPolicy,
    },
    status: "published",
  });

  for (const [key, url] of Object.entries(
    opts.slug === "amani"
      ? IMG.amani
      : IMG.bahari,
  )) {
    await tx.insert(s.mediaAssets).values({
      tenantId: tenant.id,
      objectKey: `seed/${opts.slug}/${key}.jpg`,
      url,
      mimeType: "image/jpeg",
      altText: `${opts.name} demonstration imagery`,
      kind: key === "zawadi" || key === "jabari" || key === "neema" || key === "leila" ? "portrait" : "gallery",
      isDemo: true,
    });
  }

  return tenant;
}

export async function seedIfEmpty(db: Database): Promise<void> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(s.tenants);
  if (count > 0) return;
  await seedDatabase(db);
}

export async function seedDatabase(db: Database): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await db.transaction(async (trx) => {
    const tx = trx as unknown as Database;

    const [owner, manager, staffUser, admin, bahariOwner, bahariStaff] = await tx
      .insert(s.users)
      .values([
        { name: "Zawadi Mwangi", email: "owner@amani.demo", passwordHash },
        { name: "Grace Wambui", email: "manager@amani.demo", passwordHash },
        { name: "Jabari Otieno", email: "staff@amani.demo", passwordHash },
        { name: "Nuru Platform", email: "admin@nuru.demo", passwordHash, isPlatformAdmin: true },
        { name: "Neema Hassan", email: "owner@bahari.demo", passwordHash },
        { name: "Leila Said", email: "staff@bahari.demo", passwordHash },
      ])
      .returning();

    const amani = await createTenantData(tx, {
      slug: "amani",
      name: "Amani Bodywork",
      themeId: "botanical",
      content: amaniContent,
      timezone: TZ,
      isDemo: true,
      ownerId: owner.id,
    });
    await tx.insert(s.tenantMemberships).values([
      { tenantId: amani.id, userId: manager.id, role: "manager" },
      { tenantId: amani.id, userId: staffUser.id, role: "staff" },
    ]);

    const bahari = await createTenantData(tx, {
      slug: "bahari",
      name: "Bahari House",
      themeId: "coastal",
      content: bahariContent,
      timezone: TZ,
      isDemo: true,
      ownerId: bahariOwner.id,
    });
    await tx.insert(s.tenantMemberships).values({ tenantId: bahari.id, userId: bahariStaff.id, role: "staff" });
    await tx.insert(s.tenantMemberships).values({ tenantId: bahari.id, userId: admin.id, role: "manager" });

    // Locations
    const [amaniLocation, bahariLocation] = await tx
      .insert(s.locations)
      .values([
        {
          tenantId: amani.id,
          name: "Amani Bodywork Studio",
          addressLine1: "Riverside Drive",
          addressLine2: "Kilimani",
          city: "Nairobi",
          country: "Kenya",
          phone: "+254 712 000 145",
          email: "hello@amanibodywork.demo",
          timezone: TZ,
          isPrimary: true,
        },
        {
          tenantId: bahari.id,
          name: "Bahari House",
          addressLine1: "Links Road",
          addressLine2: "Nyali",
          city: "Mombasa",
          country: "Kenya",
          phone: "+254 722 000 318",
          email: "stay@baharihouse.demo",
          timezone: TZ,
          isPrimary: true,
        },
      ])
      .returning();

    // Business hours
    for (const tenantId of [amani.id, bahari.id]) {
      for (let weekday = 0; weekday < 7; weekday += 1) {
        const closed = tenantId === amani.id ? weekday === 0 || weekday === 1 : weekday === 3;
        const shortDay = tenantId === amani.id && weekday === 6;
        await tx.insert(s.businessHours).values({
          tenantId,
          locationId: tenantId === amani.id ? amaniLocation.id : bahariLocation.id,
          weekday,
          opensAt: "09:00",
          closesAt: shortDay ? "17:00" : tenantId === amani.id ? "19:00" : "18:00",
          isClosed: closed,
        });
      }
    }

    // Staff
    const [zawadi, jabari, neema, leila] = await tx
      .insert(s.staffProfiles)
      .values([
        {
          tenantId: amani.id,
          userId: owner.id,
          name: "Zawadi Mwangi",
          title: "Founder & lead therapist",
          bio: "Zawadi has practised therapeutic massage for more than a decade. Her work is slow, specific and deeply attentive, with a particular focus on deep tissue and prenatal care. She founded Amani to create a studio where there was always enough time.",
          imageUrl: IMG.amani.zawadi,
          email: "zawadi@amanibodywork.demo",
          sortOrder: 0,
          color: "#24483D",
        },
        {
          tenantId: amani.id,
          userId: staffUser.id,
          name: "Jabari Otieno",
          title: "Therapeutic massage therapist",
          bio: "Jabari brings a calm, grounded presence and a keen interest in shoulder, neck and tension-related work. He is known for pressure that is firm without being hurried, and for making first-time guests feel completely at ease.",
          imageUrl: IMG.amani.jabari,
          email: "jabari@amanibodywork.demo",
          sortOrder: 1,
          color: "#B08D5B",
        },
        {
          tenantId: bahari.id,
          userId: bahariOwner.id,
          name: "Neema Hassan",
          title: "Founder & host",
          bio: "Neema spent a decade in hospitality before opening Bahari House. She still takes a small number of treatments each week and is happiest when the garden is full and the pace is slow.",
          imageUrl: IMG.bahari.neema,
          email: "neema@baharihouse.demo",
          sortOrder: 0,
          color: "#2E5560",
        },
        {
          tenantId: bahari.id,
          name: "Leila Said",
          title: "Senior therapist",
          bio: "Leila leads Bahari's bodywork team. Her signature is deep, grounding pressure delivered at an unhurried pace, with a love of warm stones and coastal botanicals.",
          imageUrl: IMG.bahari.leila,
          email: "leila@baharihouse.demo",
          sortOrder: 1,
          color: "#C08C6B",
        },
      ])
      .returning();

    // Availability
    for (const staff of [zawadi, jabari, neema, leila]) {
      const weekdays = staff.tenantId === amani.id
        ? staff.id === zawadi.id
          ? [2, 3, 4, 5, 6]
          : [1, 2, 3, 4, 5]
        : [0, 1, 2, 4, 5, 6];
      for (const weekday of weekdays) {
        await tx.insert(s.staffAvailability).values({
          tenantId: staff.tenantId,
          staffId: staff.id,
          weekday,
          startTime: staff.tenantId === amani.id ? (staff.id === jabari.id ? "10:00" : "09:00") : "09:00",
          endTime: staff.tenantId === amani.id ? (staff.id === jabari.id ? "19:00" : "18:00") : "18:00",
          isActive: true,
        });
      }
    }

    // Services
    const amaniServices = await tx
      .insert(s.services)
      .values([
        {
          tenantId: amani.id,
          slug: "deep-tissue-reset",
          name: "Deep Tissue Reset",
          shortDescription: "Focused, unhurried work for shoulders, back and tired legs.",
          description:
            "A full-body treatment for people who carry their week in their shoulders and back. We begin with a short conversation about where you feel tension, then work at a slower, deeper pace with warm oil. Pressure is always adjusted to you. Expect focused work, quiet and time to come back to your breath.",
          durationMinutes: 60,
          bufferBeforeMinutes: 10,
          bufferAfterMinutes: 15,
          priceCents: 650_000,
          imageUrl: IMG.amani.hero,
          category: "Therapeutic",
          sortOrder: 0,
        },
        {
          tenantId: amani.id,
          slug: "restorative-swedish",
          name: "Restorative Swedish",
          shortDescription: "Long, flowing strokes and a gentle pace. Our most restful hour.",
          description:
            "A classic full-body massage using light-to-medium pressure, warm oil and slow, continuous movement. Designed for rest rather than deep work. Many guests choose this treatment when they are tired, travelling or simply need an hour that belongs to them.",
          durationMinutes: 60,
          bufferBeforeMinutes: 10,
          bufferAfterMinutes: 15,
          priceCents: 550_000,
          imageUrl: IMG.amani.hands,
          category: "Relaxation",
          sortOrder: 1,
        },
        {
          tenantId: amani.id,
          slug: "hot-stone-ritual",
          name: "Hot Stone Ritual",
          shortDescription: "Warm basalt stones, slow pressure and a deeply grounding pace.",
          description:
            "Smooth, warmed basalt stones are used alongside hands-on massage to help the body settle. The treatment includes a longer settling period and finishes with warm oil on the shoulders and scalp. Best when you have nowhere else to be afterwards.",
          durationMinutes: 90,
          bufferBeforeMinutes: 15,
          bufferAfterMinutes: 15,
          priceCents: 850_000,
          imageUrl: IMG.amani.stones,
          category: "Signature",
          sortOrder: 2,
        },
        {
          tenantId: amani.id,
          slug: "head-shoulder-release",
          name: "Head & Shoulder Release",
          shortDescription: "Thirty focused minutes for neck, shoulders and scalp.",
          description:
            "A precise, seated or table-based treatment for the neck, shoulders and scalp. Ideal for desk-bound days, long drives or a lunchtime reset. We work within your comfort and can include gentle scalp work and a warm compress.",
          durationMinutes: 30,
          bufferBeforeMinutes: 5,
          bufferAfterMinutes: 10,
          priceCents: 350_000,
          imageUrl: IMG.amani.oil,
          category: "Express",
          sortOrder: 3,
        },
        {
          tenantId: amani.id,
          slug: "prenatal-comfort",
          name: "Prenatal Comfort",
          shortDescription: "Adapted positioning and gentle support through pregnancy.",
          description:
            "A gentle, side-lying treatment designed around comfort and support. We use cushions to find a position that works for you and keep the focus on rest, circulation and easing everyday tension. Please book after your first trimester and let us know of any guidance from your healthcare provider.",
          durationMinutes: 60,
          bufferBeforeMinutes: 10,
          bufferAfterMinutes: 15,
          priceCents: 600_000,
          imageUrl: IMG.amani.sauna,
          category: "Care",
          sortOrder: 4,
        },
      ])
      .returning();

    await tx
      .insert(s.serviceAddons)
      .values([
        {
          tenantId: amani.id,
          serviceId: amaniServices[0].id,
          name: "Warm foot compress",
          description: "A warm botanical compress for tired feet, added at the end of your treatment.",
          priceCents: 90_000,
          durationMinutes: 10,
        },
        {
          tenantId: amani.id,
          serviceId: amaniServices[2].id,
          name: "Scalp oil ritual",
          description: "Fifteen minutes of slow scalp massage with locally blended oil.",
          priceCents: 120_000,
          durationMinutes: 15,
        },
        {
          tenantId: amani.id,
          serviceId: amaniServices[1].id,
          name: "Extra thirty minutes",
          description: "Extend your treatment by half an hour.",
          priceCents: 250_000,
          durationMinutes: 30,
        },
      ])
      .returning();

    const bahariServices = await tx
      .insert(s.services)
      .values([
        {
          tenantId: bahari.id,
          slug: "ocean-flow",
          name: "Ocean Flow Massage",
          shortDescription: "Our signature full-body massage with coastal botanical oil.",
          description:
            "Long, flowing movement and a considered, medium pressure. Bahari's signature massage uses a reef-safe oil blended with locally grown frangipani and coconut. The pace is slow enough to let your shoulders drop, with focused work wherever you need it.",
          durationMinutes: 60,
          bufferBeforeMinutes: 10,
          bufferAfterMinutes: 15,
          priceCents: 600_000,
          imageUrl: IMG.bahari.wave,
          category: "Signature",
          sortOrder: 0,
        },
        {
          tenantId: bahari.id,
          slug: "sandstone-warmth",
          name: "Sandstone Warmth",
          shortDescription: "Warm stones, grounding pressure and a long, quiet finish.",
          description:
            "Warmed stones are worked slowly across the back, shoulders and legs, followed by hands-on massage and a warm foot wrap. Grounding and deeply restful, with time afterwards to sit in the garden.",
          durationMinutes: 90,
          bufferBeforeMinutes: 15,
          bufferAfterMinutes: 20,
          priceCents: 800_000,
          imageUrl: IMG.bahari.stones,
          category: "Signature",
          sortOrder: 1,
        },
        {
          tenantId: bahari.id,
          slug: "couples-tide-retreat",
          name: "Couples' Tide Retreat",
          shortDescription: "Two therapists, two treatments, one shared pause.",
          description:
            "A shared ninety minutes in our garden suite. Choose a full-body massage or let each guest choose their own focus. Includes a private plunge and tea afterwards. Please note this is a demonstration price and no payment is collected.",
          durationMinutes: 90,
          bufferBeforeMinutes: 20,
          bufferAfterMinutes: 20,
          priceCents: 1_200_000,
          imageUrl: IMG.bahari.pool,
          category: "Together",
          sortOrder: 2,
        },
        {
          tenantId: bahari.id,
          slug: "reflexology",
          name: "Coastal Reflexology",
          shortDescription: "Forty-five minutes of focused foot and lower-leg work.",
          description:
            "A grounding sequence for tired feet and lower legs, using slow pressure and a warm botanical balm. A good choice after travel or a long day on your feet.",
          durationMinutes: 45,
          bufferBeforeMinutes: 5,
          bufferAfterMinutes: 10,
          priceCents: 450_000,
          imageUrl: IMG.bahari.beach,
          category: "Express",
          sortOrder: 3,
        },
        {
          tenantId: bahari.id,
          slug: "after-sun-soothe",
          name: "After-Sun Soothe",
          shortDescription: "Cooling aloe, gentle massage and hydration for sun-tired skin.",
          description:
            "A gentle treatment for skin that has had a little too much sun. Cooling aloe and light massage help you feel comfortable again. Please let us know if your skin is blistered or broken; we may recommend waiting.",
          durationMinutes: 60,
          bufferBeforeMinutes: 10,
          bufferAfterMinutes: 10,
          priceCents: 550_000,
          imageUrl: IMG.bahari.hero,
          category: "Seasonal",
          sortOrder: 4,
        },
      ])
      .returning();

    await tx.insert(s.serviceAddons).values([
      {
        tenantId: bahari.id,
        serviceId: bahariServices[0].id,
        name: "Frangipani scalp ritual",
        description: "A fragrant scalp and hair oil treatment to finish.",
        priceCents: 100_000,
        durationMinutes: 15,
      },
      {
        tenantId: bahari.id,
        serviceId: bahariServices[1].id,
        name: "Warm foot wrap",
        description: "Warm botanical wrap for tired feet.",
        priceCents: 80_000,
        durationMinutes: 10,
      },
    ]);

    for (const service of amaniServices) {
      await tx.insert(s.staffServices).values([
        { tenantId: amani.id, staffId: zawadi.id, serviceId: service.id },
        ...(service.slug === "prenatal-comfort"
          ? []
          : [{ tenantId: amani.id, staffId: jabari.id, serviceId: service.id }]),
      ]);
    }
    for (const service of bahariServices) {
      await tx.insert(s.staffServices).values([
        { tenantId: bahari.id, staffId: neema.id, serviceId: service.id },
        { tenantId: bahari.id, staffId: leila.id, serviceId: service.id },
      ]);
    }

    // Time off (visible on the dashboard calendar)
    const timeOffDate = dateForWeekday(4, [2, 3, 4, 5, 6]);
    await tx.insert(s.timeOff).values({
      tenantId: amani.id,
      staffId: zawadi.id,
      startsAt: at(timeOffDate, "14:00"),
      endsAt: at(timeOffDate, "18:00"),
      reason: "Professional development afternoon",
    });
    await tx.insert(s.timeOff).values({
      tenantId: bahari.id,
      staffId: leila.id,
      startsAt: at(dateForWeekday(3, [0, 1, 2, 4, 5, 6]), "12:00"),
      endsAt: at(dateForWeekday(3, [0, 1, 2, 4, 5, 6]), "15:00"),
      reason: "Personal appointment",
    });

    // Customers
    const amaniCustomers = await tx
      .insert(s.customers)
      .values(
        [
          ["Wanjiru Kamau", "wanjiru.k@example.com", "+254 711 100 201", "Prefers firm pressure and a quiet room."],
          ["Amina Mohamed", "amina.m@example.com", "+254 722 100 202", "Sensitive to strong fragrance; unscented oil."],
          ["David Ochieng", "david.o@example.com", "+254 733 100 203", ""],
          ["Sarah Njeri", "sarah.n@example.com", "+254 744 100 204", "Usually books Saturday mornings."],
          ["Tomás Mwangi", "tomas.m@example.com", "+254 755 100 205", ""],
          ["Priya Shah", "priya.s@example.com", "+254 766 100 206", "Pregnant — second trimester. Side-lying only."],
          ["Brian Waweru", "brian.w@example.com", "+254 777 100 207", ""],
          ["Lucy Achieng", "lucy.a@example.com", "+254 788 100 208", "Prefers Zawadi."],
        ].map(([name, email, phone, notes]) => ({
          tenantId: amani.id,
          name,
          email,
          phone,
          notes: notes || null,
          isDemo: true,
        })),
      )
      .returning();

    const bahariCustomers = await tx
      .insert(s.customers)
      .values(
        [
          ["Fatuma Ali", "fatuma.a@example.com", "+254 700 200 301", ""],
          ["Peter Njoroge", "peter.n@example.com", "+254 701 200 302", "Prefers late afternoon."],
          ["Hannah van der Merwe", "hannah.v@example.com", "+254 702 200 303", "Visiting from Cape Town until the 30th."],
          ["Omar Said", "omar.s@example.com", "+254 703 200 304", ""],
          ["Joy Mutua", "joy.m@example.com", "+254 704 200 305", "Interested in couples' rituals."],
        ].map(([name, email, phone, notes]) => ({
          tenantId: bahari.id,
          name,
          email,
          phone,
          notes: notes || null,
          isDemo: true,
        })),
      )
      .returning();

    for (const customer of [...amaniCustomers, ...bahariCustomers]) {
      await tx.insert(s.customerConsents).values([
        { tenantId: customer.tenantId, customerId: customer.id, type: "transactional", granted: true, source: "booking" },
        {
          tenantId: customer.tenantId,
          customerId: customer.id,
          type: "marketing",
          granted: customer.name.charCodeAt(0) % 2 === 0,
          source: "booking",
        },
      ]);
      await tx.insert(s.notificationPreferences).values({
        tenantId: customer.tenantId,
        customerId: customer.id,
        transactionalEmail: true,
        marketingEmail: customer.name.charCodeAt(0) % 2 === 0,
      });
    }

    // Bookings — relative to today so the demo dashboard is always populated.
    type BookingSeed = {
      tenantId: string;
      customerId: string;
      staffId: string;
      serviceId: string;
      date: string;
      time: string;
      status: s.BookingStatus;
      prefix: string;
      notes?: string;
    };

    const todayAmani = dateForWeekday(0, [2, 3, 4, 5, 6]);
    const tomorrowAmani = dateForWeekday(1, [2, 3, 4, 5, 6]);
    const day3Amani = dateForWeekday(3, [2, 3, 4, 5, 6]);
    const day5Amani = dateForWeekday(5, [2, 3, 4, 5, 6]);

    const bookingSeeds: BookingSeed[] = [
      {
        tenantId: amani.id,
        customerId: amaniCustomers[0].id,
        staffId: zawadi.id,
        serviceId: amaniServices[0].id,
        date: todayAmani,
        time: "10:00",
        status: "confirmed",
        prefix: "AMN",
        notes: "Focus on right shoulder.",
      },
      {
        tenantId: amani.id,
        customerId: amaniCustomers[2].id,
        staffId: jabari.id,
        serviceId: amaniServices[3].id,
        date: todayAmani,
        time: "11:30",
        status: "confirmed",
        prefix: "AMN",
      },
      {
        tenantId: amani.id,
        customerId: amaniCustomers[1].id,
        staffId: zawadi.id,
        serviceId: amaniServices[2].id,
        date: todayAmani,
        time: "14:00",
        status: "pending",
        prefix: "AMN",
        notes: "Unscented oil please.",
      },
      {
        tenantId: amani.id,
        customerId: amaniCustomers[3].id,
        staffId: jabari.id,
        serviceId: amaniServices[1].id,
        date: todayAmani,
        time: "15:30",
        status: "confirmed",
        prefix: "AMN",
      },
      {
        tenantId: amani.id,
        customerId: amaniCustomers[5].id,
        staffId: zawadi.id,
        serviceId: amaniServices[4].id,
        date: tomorrowAmani,
        time: "09:30",
        status: "confirmed",
        prefix: "AMN",
        notes: "Second trimester; side-lying.",
      },
      {
        tenantId: amani.id,
        customerId: amaniCustomers[6].id,
        staffId: jabari.id,
        serviceId: amaniServices[0].id,
        date: tomorrowAmani,
        time: "13:00",
        status: "pending",
        prefix: "AMN",
      },
      {
        tenantId: amani.id,
        customerId: amaniCustomers[4].id,
        staffId: zawadi.id,
        serviceId: amaniServices[1].id,
        date: day3Amani,
        time: "11:00",
        status: "confirmed",
        prefix: "AMN",
      },
      {
        tenantId: amani.id,
        customerId: amaniCustomers[7].id,
        staffId: zawadi.id,
        serviceId: amaniServices[2].id,
        date: day5Amani,
        time: "10:00",
        status: "confirmed",
        prefix: "AMN",
      },
    ];

    const todayBahari = dateForWeekday(0, [0, 1, 2, 4, 5, 6]);
    const tomorrowBahari = dateForWeekday(1, [0, 1, 2, 4, 5, 6]);
    bookingSeeds.push(
      {
        tenantId: bahari.id,
        customerId: bahariCustomers[0].id,
        staffId: neema.id,
        serviceId: bahariServices[0].id,
        date: todayBahari,
        time: "10:30",
        status: "confirmed",
        prefix: "BHR",
      },
      {
        tenantId: bahari.id,
        customerId: bahariCustomers[1].id,
        staffId: leila.id,
        serviceId: bahariServices[1].id,
        date: todayBahari,
        time: "13:30",
        status: "confirmed",
        prefix: "BHR",
      },
      {
        tenantId: bahari.id,
        customerId: bahariCustomers[4].id,
        staffId: neema.id,
        serviceId: bahariServices[2].id,
        date: tomorrowBahari,
        time: "11:00",
        status: "pending",
        prefix: "BHR",
        notes: "Anniversary — please prepare the garden suite.",
      },
      {
        tenantId: bahari.id,
        customerId: bahariCustomers[2].id,
        staffId: leila.id,
        serviceId: bahariServices[3].id,
        date: dateForWeekday(2, [0, 1, 2, 4, 5, 6]),
        time: "16:00",
        status: "confirmed",
        prefix: "BHR",
      },
    );

    // Past completed appointments for customer history
    const pastAmani = dateForWeekday(-4, [2, 3, 4, 5, 6]);
    bookingSeeds.push(
      {
        tenantId: amani.id,
        customerId: amaniCustomers[0].id,
        staffId: zawadi.id,
        serviceId: amaniServices[0].id,
        date: pastAmani,
        time: "10:00",
        status: "completed",
        prefix: "AMN",
      },
      {
        tenantId: amani.id,
        customerId: amaniCustomers[3].id,
        staffId: jabari.id,
        serviceId: amaniServices[3].id,
        date: pastAmani,
        time: "14:00",
        status: "completed",
        prefix: "AMN",
      },
      {
        tenantId: amani.id,
        customerId: amaniCustomers[4].id,
        staffId: zawadi.id,
        serviceId: amaniServices[1].id,
        date: dateForWeekday(-7, [2, 3, 4, 5, 6]),
        time: "15:00",
        status: "no_show",
        prefix: "AMN",
      },
    );

    let index = 0;
    for (const item of bookingSeeds) {
      index += 1;
      const service = [...amaniServices, ...bahariServices].find((entry) => entry.id === item.serviceId)!;
      const startsAt = at(item.date, item.time);
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
      const [booking] = await tx
        .insert(s.bookings)
        .values({
          tenantId: item.tenantId,
          reference: bookingReference(item.prefix, index),
          customerId: item.customerId,
          staffId: item.staffId,
          locationId: item.tenantId === amani.id ? amaniLocation.id : bahariLocation.id,
          serviceId: item.serviceId,
          startsAt,
          endsAt,
          bufferBeforeMinutes: service.bufferBeforeMinutes,
          bufferAfterMinutes: service.bufferAfterMinutes,
          status: item.status,
          source: item.tenantId === amani.id ? "storefront" : "storefront",
          priceCents: service.priceCents,
          currency: "KES",
          customerNote: item.notes ?? null,
          isDemo: true,
          idempotencyKey: `seed-${item.tenantId}-${bookingReference(item.prefix, index)}`,
          cancelledAt: null,
        })
        .returning();

      await tx.insert(s.bookingItems).values({
        tenantId: item.tenantId,
        bookingId: booking.id,
        serviceId: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
      });
      await tx.insert(s.bookingStatusHistory).values({
        tenantId: item.tenantId,
        bookingId: booking.id,
        fromStatus: null,
        toStatus: "confirmed",
        changedByUserId: null,
        reason: "Seeded demonstration booking",
      });
      if (item.status !== "confirmed") {
        await tx.insert(s.bookingStatusHistory).values({
          tenantId: item.tenantId,
          bookingId: booking.id,
          fromStatus: "confirmed",
          toStatus: item.status,
          changedByUserId: null,
          reason: "Seeded demonstration status",
        });
      }
      if (item.tenantId === amani.id) {
        await tx.insert(s.dashboardNotifications).values({
          tenantId: amani.id,
          type: "booking_created",
          title: "New booking request",
          body: `${item.customerId === amaniCustomers[0].id ? "Wanjiru" : "A client"} booked ${service.name} for ${item.date} at ${item.time}.`,
        });
      }
    }

    // A completed demonstration campaign with simulated delivery receipts
    const [campaign] = await tx
      .insert(s.campaigns)
      .values({
        tenantId: amani.id,
        name: "A slower Sunday",
        channel: "email",
        subject: "A quiet hour, just for you",
        body:
          "Hello {{first_name}},\n\nWe have a few quieter slots this week and thought you might like one. Book a Restorative Swedish hour before Friday and we'll add a warm foot compress, on us.\n\nWith care,\nZawadi",
        audience: { segment: "marketing_consented", count: 5 },
        status: "simulated",
        sentAt: new Date(Date.now() - 86_400_000 * 4),
        isDemo: true,
        createdByUserId: owner.id,
      })
      .returning();
    for (const customer of amaniCustomers.slice(0, 4)) {
      await tx.insert(s.campaignRecipients).values({
        tenantId: amani.id,
        campaignId: campaign.id,
        customerId: customer.id,
        email: customer.email,
        status: "simulated",
        messageId: null,
      });
      await tx.insert(s.outboundMessages).values({
        tenantId: amani.id,
        campaignId: campaign.id,
        customerId: customer.id,
        channel: "email",
        toAddress: customer.email,
        subject: campaign.subject,
        body: campaign.body.replace("{{first_name}}", customer.name.split(" ")[0]),
        status: "simulated",
        provider: "demo",
        idempotencyKey: `seed-campaign-${campaign.id}-${customer.id}`,
        sentAt: new Date(Date.now() - 86_400_000 * 4),
      });
    }

    // A pending AI promotion awaiting approval
    const [run] = await tx
      .insert(s.agentRuns)
      .values({
        tenantId: amani.id,
        userId: owner.id,
        task: "marketing_campaign",
        prompt: "Help me fill the quiet slots this week.",
        status: "awaiting_approval",
        provider: "mock",
        model: "nuru-mock-1",
        result: {
          summary: "A warm email to marketing-consented clients, focused on Tuesday and Thursday availability.",
        },
      })
      .returning();
    await tx.insert(s.agentSteps).values([
      {
        tenantId: amani.id,
        runId: run.id,
        stepIndex: 1,
        kind: "tool",
        name: "get_available_slots",
        status: "completed",
        input: { days: 7 },
        output: { openSlots: 6, firstSlot: `${tomorrowAmani} 13:00` },
        completedAt: new Date(),
      },
      {
        tenantId: amani.id,
        runId: run.id,
        stepIndex: 2,
        kind: "tool",
        name: "get_business_profile",
        status: "completed",
        input: {},
        output: { businessName: "Amani Bodywork", timezone: TZ },
        completedAt: new Date(),
      },
      {
        tenantId: amani.id,
        runId: run.id,
        stepIndex: 3,
        kind: "message",
        name: "draft_marketing_campaign",
        status: "completed",
        output: { channel: "email", audience: "Marketing-consented clients" },
        completedAt: new Date(),
      },
    ]);
    const [artifact] = await tx
      .insert(s.agentArtifacts)
      .values({
        tenantId: amani.id,
        runId: run.id,
        type: "campaign_draft",
        title: "A little more room this week",
        content: {
          name: "Make room this week",
          channel: "email",
          subject: "A quieter hour is waiting",
          body:
            "Hello {{first_name}},\n\nThere is a little more room in the diary this week, and we would love to see you. We have openings on Tuesday afternoon and Thursday morning for a Restorative Swedish or Deep Tissue Reset.\n\nIf an hour of quiet would help, reply to this note or book online. We will keep the kettle warm.\n\nWith care,\nZawadi at Amani",
          audience: { segment: "marketing_consented", count: 5, description: "Clients who have opted in to occasional studio notes" },
          rationale: "Six open slots across the next seven days, concentrated on Tuesday and Thursday.",
        },
        status: "awaiting_approval",
      })
      .returning();
    await tx.insert(s.approvalRequests).values({
      tenantId: amani.id,
      runId: run.id,
      artifactId: artifact.id,
      action: "send_campaign",
      resourceType: "campaign",
      resourceId: artifact.id,
      payload: artifact.content,
      payloadHash: hashPayload(artifact.content),
      status: "pending",
      requestedByUserId: owner.id,
    });

    await tx.insert(s.integrationConnections).values([
      { tenantId: amani.id, provider: "email", status: "demo", config: { note: "No email provider configured. Messages are simulated." } },
      { tenantId: amani.id, provider: "payments", status: "demo", config: { note: "Pay at appointment. No card details are collected." } },
      { tenantId: amani.id, provider: "storage", status: "demo", config: { note: "Bundled demonstration media." } },
    ]);

    await tx.insert(s.auditEvents).values([
      {
        tenantId: amani.id,
        actorUserId: owner.id,
        action: "tenant.seeded",
        resourceType: "tenant",
        resourceId: amani.id,
        metadata: { demo: true, source: "seed" },
      },
      {
        tenantId: bahari.id,
        actorUserId: bahariOwner.id,
        action: "tenant.seeded",
        resourceType: "tenant",
        resourceId: bahari.id,
        metadata: { demo: true, source: "seed" },
      },
    ]);
  });
}

export async function resetDemoData(db: Database) {
  const tenantRows = await db.select({ id: s.tenants.id }).from(s.tenants).where(eq(s.tenants.isDemo, true));
  for (const tenant of tenantRows) {
    await db.delete(s.bookings).where(eq(s.bookings.tenantId, tenant.id));
  }
}

export const DEMO_CREDENTIALS = {
  password: DEMO_PASSWORD,
  accounts: [
    { email: "owner@amani.demo", label: "Amani Bodywork · Owner", tenant: "amani" },
    { email: "manager@amani.demo", label: "Amani Bodywork · Manager", tenant: "amani" },
    { email: "owner@bahari.demo", label: "Bahari House · Owner", tenant: "bahari" },
    { email: "admin@nuru.demo", label: "Nuru platform admin", tenant: "amani" },
  ],
};
