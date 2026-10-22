import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Clock, MapPin, Phone, Quote, Sparkles } from "lucide-react";
import { Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import type { StorefrontData } from "@/lib/tenant";
import { formatDuration, formatMoney } from "@/lib/format";
import { sortedVisibleSections, type StorefrontSection } from "@/lib/storefront";
import { fontClass } from "./theme";

function todayLabel(hours: { weekday: number; opensAt: string; closesAt: string; isClosed: boolean }[]) {
  const weekday = new Date().getDay();
  const today = hours.find((h) => h.weekday === weekday);
  if (!today || today.isClosed) return "Closed today";
  const clean = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    const period = h >= 12 ? "pm" : "am";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${period}`;
  };
  return `Open today · ${clean(today.opensAt)} – ${clean(today.closesAt)}`;
}

function Hero({ data }: { data: StorefrontData }) {
  const { config, services } = data;
  const content = config.content;
  const priceFrom = services.length ? Math.min(...services.map((s) => s.priceCents)) : 0;

  return (
    <section className="relative overflow-hidden border-b border-[var(--color-tenant-border)]">
      <div className="grid min-h-[calc(100svh-110px)] lg:grid-cols-[1.04fr_1fr]">
        <div className="relative z-10 flex flex-col justify-center px-5 py-16 sm:px-10 md:px-14 lg:px-[max(3.5rem,calc((100vw-var(--tenant-container))/2))] lg:py-24">
          <Reveal y={14} delay={0.04}>
            <p className="sf-eyebrow">{content.heroEyebrow}</p>
          </Reveal>
          <Reveal y={26} delay={0.1}>
            <h1 className={`${fontClass(config.theme)} mt-6 max-w-[13ch] text-[clamp(3.2rem,7.2vw,6rem)] leading-[0.92] tracking-[-0.025em] text-[var(--color-tenant-ink)]`}>
              {content.heroTitle}
            </h1>
          </Reveal>
          <Reveal y={20} delay={0.18}>
            <p className="mt-7 max-w-[34rem] text-[0.98rem] leading-[1.75] text-[var(--color-tenant-muted)] sm:text-[1.05rem]">
              {content.heroText}
            </p>
          </Reveal>
          <Reveal y={18} delay={0.24}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/book" className="sf-btn btn-sheen sf-btn-primary">
                {content.primaryCta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/#services" className="sf-btn sf-btn-outline">
                {content.secondaryCta}
              </Link>
            </div>
          </Reveal>

          <Reveal y={12} delay={0.3}>
            <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-[var(--color-tenant-border)] pt-5 text-[11px] uppercase tracking-[0.13em] text-[var(--color-tenant-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[var(--color-accent)]" aria-hidden="true" /> {content.city}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[var(--color-accent)]" aria-hidden="true" /> {todayLabel(data.hours)}
              </span>
              {priceFrom > 0 && <span>From {formatMoney(priceFrom, data.tenant.currency)}</span>}
            </div>
          </Reveal>
        </div>

        <div className="relative min-h-[58vh] overflow-hidden lg:min-h-full">
          <Parallax className="absolute inset-[-4%]" distance={18} zoom>
            <Image
              src={content.heroImage}
              alt={content.heroImageAlt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="animate-ken-burns object-cover"
              style={{ objectPosition: content.heroFocal || "center" }}
            />
          </Parallax>
          <div className="absolute inset-0 bg-gradient-to-t from-[#1c2b24]/40 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4 text-white sm:bottom-9 sm:left-9 sm:right-9">
            <div className="rounded-[var(--tenant-radius)] border border-white/20 bg-black/20 px-4 py-3 backdrop-blur-md">
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/70">The studio</p>
              <p className="mt-0.5 font-display text-lg leading-tight">{content.businessName}</p>
            </div>
            <p className="hidden text-right text-[9px] uppercase leading-relaxed tracking-[0.2em] text-white/70 sm:block">
              Quiet spaces
              <br />
              Considered care
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Services({ data }: { data: StorefrontData }) {
  const { config, services } = data;
  return (
    <section id="services" className="sf-section">
      <div className="sf-container">
        <Reveal>
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="sf-eyebrow">{config.content.servicesEyebrow}</p>
              <h2 className={`${fontClass(config.theme)} mt-4 max-w-[15ch] text-[clamp(2.5rem,4.6vw,4rem)] leading-[0.98]`}>
                {config.content.servicesTitle}
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-[var(--color-tenant-muted)]">
              {config.content.servicesText}
            </p>
          </div>
        </Reveal>

        <div className="mt-12 border-t border-[var(--color-tenant-border)]">
          {services.map((service, index) => (
            <Reveal key={service.id} delay={Math.min(index * 0.05, 0.3)} y={16}>
            <Link
              href={`/services/${service.slug}`}
              className="service-row group grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-[var(--color-tenant-border)] py-6 transition-colors hover:bg-[color-mix(in_srgb,var(--color-soft)_48%,transparent)] sm:gap-7 sm:px-3 md:grid-cols-[2.5rem_6rem_1fr_auto]"
            >
              <span className="hidden text-[10px] font-medium tracking-[0.15em] text-[var(--color-accent)] md:block">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="relative hidden h-[4.5rem] w-[6rem] overflow-hidden rounded-[calc(var(--tenant-radius)*0.7)] md:block">
                {service.imageUrl && (
                  <Image
                    src={service.imageUrl}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className={`${fontClass(config.theme)} text-[1.65rem] leading-tight sm:text-[2rem]`}>
                    {service.name}
                  </h3>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-tenant-muted)]">
                    {formatDuration(service.durationMinutes)}
                  </span>
                </div>
                <p className="mt-1 max-w-xl text-[0.84rem] leading-relaxed text-[var(--color-tenant-muted)]">
                  {service.shortDescription}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium tabular-nums">{formatMoney(service.priceCents, service.currency)}</span>
                <ArrowUpRight className="h-5 w-5 text-[var(--color-brand)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
              </div>
            </Link>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="inline-flex items-center gap-2 text-xs text-[var(--color-tenant-muted)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" aria-hidden="true" />
            Prices include consultation time. Add-ons can be selected when you book.
          </p>
          <Link href="/book" className="sf-link text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-brand)]">
            View availability
          </Link>
        </div>
        </Reveal>
      </div>
    </section>
  );
}

function About({ data }: { data: StorefrontData }) {
  const { config, services, staff } = data;
  const durations = services.map((s) => s.durationMinutes);
  return (
    <section id="about" className="sf-section border-y border-[var(--color-tenant-border)] bg-[color-mix(in_srgb,var(--color-soft)_35%,var(--color-canvas))]">
      <div className="sf-container grid gap-12 lg:grid-cols-[1.02fr_1fr] lg:items-center lg:gap-20">
        <Reveal y={28}>
        <div className="relative">
          <div className="hover-zoom relative aspect-[4/5] overflow-hidden rounded-[var(--tenant-radius)]">
            <Image
              src={config.content.aboutImage}
              alt={config.content.aboutImageAlt}
              fill
              sizes="(max-width: 1024px) 100vw, 46vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-4 -right-2 hidden w-[12rem] animate-float-slow bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] sm:block lg:-right-8">
            <p className="font-display text-3xl text-[var(--color-brand)]">
              {staff.length} <span className="text-lg">therapists</span>
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-tenant-muted)]">
              {durations.length ? `${Math.min(...durations)}–${Math.max(...durations)} minute treatments` : "Time to unwind"}
            </p>
          </div>
        </div>
        </Reveal>

        <Reveal delay={0.1} y={24}>
        <div>
          <p className="sf-eyebrow">Our approach</p>
          <h2 className={`${fontClass(config.theme)} mt-4 text-[clamp(2.4rem,4.4vw,3.75rem)] leading-[0.98]`}>
            {config.content.aboutTitle}
          </h2>
          <p className="mt-6 text-[0.95rem] leading-[1.8] text-[var(--color-tenant-muted)]">{config.content.aboutText}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {config.content.aboutHighlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2.5 text-[0.82rem] leading-relaxed text-[var(--color-tenant-ink)]">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" strokeWidth={2.5} aria-hidden="true" />
                {highlight}
              </li>
            ))}
          </ul>
          <Link href="/book" className="sf-btn sf-btn-outline mt-9">
            Plan your visit
          </Link>
        </div>
        </Reveal>
      </div>
    </section>
  );
}

function Team({ data }: { data: StorefrontData }) {
  const { config, staff } = data;
  return (
    <section id="team" className="sf-section">
      <div className="sf-container">
        <Reveal>
          <div className="max-w-2xl">
            <p className="sf-eyebrow">The people</p>
            <h2 className={`${fontClass(config.theme)} mt-4 text-[clamp(2.4rem,4.4vw,3.75rem)] leading-[0.98]`}>
              {config.content.teamTitle}
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-[var(--color-tenant-muted)]">{config.content.teamText}</p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:gap-12">
          {staff.map((person, index) => (
            <Reveal key={person.id} delay={index * 0.08} y={26} className={index % 2 === 1 ? "sm:mt-16" : ""}>
            <article>
              <div className="hover-zoom relative aspect-[5/6] overflow-hidden rounded-[var(--tenant-radius)] bg-[var(--color-soft)]">
                {person.imageUrl ? (
                  <Image
                    src={person.imageUrl}
                    alt={`Portrait of ${person.name}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 46vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center font-display text-6xl text-[var(--color-brand)]">
                    {person.name.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className={`${fontClass(config.theme)} text-3xl`}>{person.name}</h3>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">{person.title}</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-tenant-muted)]">{person.bio}</p>
            </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gallery({ data }: { data: StorefrontData }) {
  const { config } = data;
  const images = config.content.galleryImages;
  const layout = [
    "md:col-span-7 md:row-span-2",
    "md:col-span-5",
    "md:col-span-5",
    "md:col-span-4",
    "md:col-span-4",
    "md:col-span-4",
  ];
  return (
    <section id="gallery" className="sf-section border-y border-[var(--color-tenant-border)] bg-[var(--color-surface)]">
      <div className="sf-container">
        <Reveal>
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="sf-eyebrow">The space</p>
              <h2 className={`${fontClass(config.theme)} mt-4 text-[clamp(2.4rem,4.4vw,3.75rem)] leading-[0.98]`}>
                {config.content.galleryTitle}
              </h2>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-[var(--color-tenant-muted)]">{config.content.galleryText}</p>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-3 md:grid-cols-12 md:grid-rows-2">
          {images.slice(0, 6).map((image, index) => (
            <Reveal
              key={`${image.url}-${index}`}
              delay={index * 0.045}
              y={20}
              className={`relative min-h-[15rem] ${layout[index] ?? "md:col-span-4"}`}
            >
              <div className="sf-image-zoom group relative h-full min-h-[15rem] overflow-hidden rounded-[var(--tenant-radius)] bg-[var(--color-soft)] md:min-h-[13rem]">
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  sizes={index === 0 ? "(max-width: 768px) 100vw, 58vw" : "(max-width: 768px) 100vw, 33vw"}
                  className="object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#18251f]/15 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-[var(--color-tenant-muted)]">
          Demonstration imagery · replace with your studio photography before publishing
        </p>
      </div>
    </section>
  );
}

function Testimonials({ data }: { data: StorefrontData }) {
  const { config } = data;
  return (
    <section id="testimonials" className="sf-section bg-[var(--color-soft)]">
      <div className="sf-container">
        <Reveal>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="sf-eyebrow">Kind words</p>
              <h2 className={`${fontClass(config.theme)} mt-4 text-[clamp(2.4rem,4.4vw,3.75rem)] leading-[0.98]`}>
                {config.content.testimonialsTitle}
              </h2>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-tenant-border)] bg-[var(--color-canvas)]/60 px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] text-[var(--color-tenant-muted)]">
              Illustrative · not verified reviews
            </span>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {config.content.testimonials.map((testimonial, index) => (
            <Reveal key={testimonial.author} delay={index * 0.08} y={20} className={index === 0 ? "md:-translate-y-3" : ""}>
            <figure className="card-lift flex h-full flex-col justify-between rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-canvas)] p-6 sm:p-7">
              <Quote className="h-6 w-6 text-[var(--color-accent)]/60" aria-hidden="true" />
              <blockquote className={`${fontClass(config.theme)} mt-5 text-[1.35rem] leading-[1.35] text-[var(--color-tenant-ink)]`}>
                “{testimonial.quote}”
              </blockquote>
              <figcaption className="mt-6 border-t border-[var(--color-tenant-border)] pt-4 text-[10px] uppercase tracking-[0.13em] text-[var(--color-tenant-muted)]">
                {testimonial.author} · {testimonial.service}
              </figcaption>
            </figure>
            </Reveal>
          ))}
        </div>
        <p className="mt-5 max-w-2xl text-[10px] leading-relaxed text-[var(--color-tenant-muted)]">{config.content.testimonialsText}</p>
      </div>
    </section>
  );
}

function Location({ data }: { data: StorefrontData }) {
  const { config } = data;
  const image = config.content.galleryImages[2]?.url ?? config.content.heroImage;
  return (
    <section id="visit" className="sf-section">
      <div className="sf-container grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-stretch">
        <Reveal>
        <div>
          <p className="sf-eyebrow">Visit</p>
          <h2 className={`${fontClass(config.theme)} mt-4 text-[clamp(2.4rem,4.4vw,3.75rem)] leading-[0.98]`}>
            {config.content.locationTitle}
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-[var(--color-tenant-muted)]">{config.content.locationText}</p>

          <div className="mt-8 grid gap-8 border-t border-[var(--color-tenant-border)] pt-8 sm:grid-cols-2">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em]">Address</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-tenant-muted)]">
                {config.content.address}
                <br />
                {config.content.city}
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${config.content.address}, ${config.content.city}`)}`}
                target="_blank"
                rel="noreferrer"
                className="sf-link mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand)]"
              >
                Get directions <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em]">Opening hours</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-[var(--color-tenant-muted)]">
                {config.content.hours.map((entry) => (
                  <li key={entry.day} className="flex justify-between gap-3">
                    <span>{entry.day}</span>
                    <span className="text-[var(--color-tenant-ink)]">{entry.hours}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <a href={`tel:${config.content.phone}`} className="sf-btn sf-btn-outline">
              <Phone className="h-4 w-4" aria-hidden="true" /> {config.content.phone}
            </a>
            <a href={`mailto:${config.content.email}`} className="sf-btn sf-btn-outline">
              Email the studio
            </a>
          </div>
        </div>
        </Reveal>

        <Reveal delay={0.1} y={26}>
        <div className="grain-overlay relative min-h-[25rem] overflow-hidden rounded-[var(--tenant-radius)]">
          <Parallax className="absolute inset-[-4%]" distance={22} zoom>
            <Image src={image} alt="The studio space" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          </Parallax>
          <div className="absolute inset-0 bg-gradient-to-t from-[#18251f]/55 via-transparent to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 rounded-[var(--tenant-radius)] border border-white/20 bg-[#1b2a23]/55 p-5 text-white backdrop-blur-md">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
              <div>
                <p className="font-display text-2xl">{config.content.businessName}</p>
                <p className="mt-1 text-xs text-white/75">
                  {config.content.address}, {config.content.city}
                </p>
              </div>
            </div>
          </div>
        </div>
        </Reveal>
      </div>
    </section>
  );
}

function ClosingCta({ data }: { data: StorefrontData }) {
  return (
    <section className="grain-overlay relative overflow-hidden bg-[var(--color-brand)] py-20 text-[var(--color-on-brand)] sm:py-24">
      <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 animate-pulse-soft rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 animate-pulse-soft rounded-full border border-white/10" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 animate-drift rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_62%)] blur-2xl" />
      <div className="sf-container relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <Reveal>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/55">Your time</p>
            <h2 className={`${fontClass(data.config.theme)} mt-4 max-w-[18ch] text-[clamp(2.6rem,5vw,4.5rem)] leading-[0.96]`}>
              An hour that belongs entirely to you.
            </h2>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <Link href="/book" className="sf-btn btn-sheen sf-btn-light">
              Book a treatment <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/55">Online booking · instant confirmation</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function StorefrontHome({ data }: { data: StorefrontData }) {
  const sections = sortedVisibleSections(data.config);
  const render = (section: StorefrontSection) => {
    switch (section.key) {
      case "hero":
        return <Hero key={section.key} data={data} />;
      case "services":
        return <Services key={section.key} data={data} />;
      case "about":
        return <About key={section.key} data={data} />;
      case "team":
        return <Team key={section.key} data={data} />;
      case "gallery":
        return <Gallery key={section.key} data={data} />;
      case "testimonials":
        return <Testimonials key={section.key} data={data} />;
      case "location":
        return <Location key={section.key} data={data} />;
      default:
        return null;
    }
  };

  return (
    <>
      {sections.map(render)}
      <ClosingCta data={data} />
    </>
  );
}
