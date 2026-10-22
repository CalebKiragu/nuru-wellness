import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  LayoutDashboard,
  LockKeyhole,
  MessageSquareText,
  Sparkles,
  Store,
} from "lucide-react";
import { Logo, NuruMark } from "@/components/brand/logo";
import { listPublicTenantsForDemo } from "@/lib/tenant";
import { env } from "@/lib/env";

const tenantImagery: Record<string, { image: string; theme: string }> = {
  amani: { image: "/media/amani/hero.jpg", theme: "Botanical Luxury" },
  bahari: { image: "/media/bahari/hero.jpg", theme: "Coastal Calm" },
};

export async function PlatformLanding() {
  const demoTenants = await listPublicTenantsForDemo();

  return (
    <div className="min-h-screen bg-ivory text-ink">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/90 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-[86rem] items-center justify-between px-5 md:px-10">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            <a href="#product" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-forest">Product</a>
            <a href="#studios" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-forest">Demo studios</a>
            <a href="#ai" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-forest">AI assistant</a>
            <Link href="/login" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-forest">Sign in</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="dash-btn dash-btn-secondary hidden sm:inline-flex">Open dashboard</Link>
            <a href="#studios" className="dash-btn dash-btn-primary">Explore the demo</a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div className="pointer-events-none absolute -right-40 -top-48 h-[38rem] w-[38rem] rounded-full border border-forest/10" />
          <div className="pointer-events-none absolute -right-24 -top-32 h-[26rem] w-[26rem] rounded-full border border-forest/10" />
          <div className="mx-auto grid max-w-[86rem] gap-14 px-5 py-16 md:px-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-24">
            <div className="relative z-10">
              <p className="inline-flex items-center gap-2 rounded-full border border-brass/40 bg-white/60 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-forest">
                <NuruMark size={16} /> White-label wellness platform
              </p>
              <h1 className="mt-7 max-w-[12ch] font-display text-[clamp(3.6rem,7.5vw,6.6rem)] leading-[0.9] tracking-[-0.03em] text-forest">
                A beautiful home for your practice.
              </h1>
              <p className="mt-7 max-w-xl text-[1.05rem] leading-[1.8] text-muted">
                Nuru brings a considered storefront, effortless online booking, a calm business
                dashboard and an AI assistant that helps you run the studio — all under your own brand.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href="#studios" className="dash-btn dash-btn-primary min-h-12 px-6">
                  Explore two demo studios <ArrowRight className="h-4 w-4" />
                </a>
                <Link href="/login" className="dash-btn dash-btn-secondary min-h-12 px-6">
                  Sign in to the dashboard
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 border-t border-line pt-6 text-[11px] uppercase tracking-[0.13em] text-muted">
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brass" /> Your brand</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brass" /> Real bookings</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brass" /> Human approval</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[34rem] lg:max-w-none">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-sage/40 via-transparent to-brass/20 blur-2xl" />
              <div className="relative rotate-[0.6deg] rounded-[1.2rem] border border-white/60 bg-paper p-3 shadow-[0_50px_100px_-50px_rgba(36,72,61,0.55)]">
                <div className="flex items-center justify-between rounded-t-[0.8rem] border border-line bg-[#fbf8f2] px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#d7ccc0]" />
                    <span className="h-2 w-2 rounded-full bg-[#d7ccc0]" />
                    <span className="h-2 w-2 rounded-full bg-[#d7ccc0]" />
                  </div>
                  <span className="text-[9px] uppercase tracking-[0.16em] text-muted">Amani Bodywork · Dashboard</span>
                  <span className="rounded-full bg-sage/30 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-forest">Demo</span>
                </div>
                <div className="grid grid-cols-[92px_1fr] gap-3 p-3">
                  <div className="rounded-[0.7rem] bg-forest p-3 text-ivory">
                    <div className="flex items-center gap-1.5">
                      <NuruMark size={18} />
                      <span className="font-display text-sm">Nuru</span>
                    </div>
                    <div className="mt-5 space-y-1">
                      {["Overview", "Calendar", "Bookings", "Clients", "Storefront", "Assistant"].map((item, i) => (
                        <div key={item} className={`rounded px-2 py-1.5 text-[8px] ${i === 0 ? "bg-white/12 text-white" : "text-white/55"}`}>{item}</div>
                      ))}
                    </div>
                    <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-2">
                      <p className="text-[7px] uppercase tracking-[0.1em] text-brass">Today</p>
                      <p className="mt-1 font-display text-xl">4 visits</p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[8px] uppercase tracking-[0.14em] text-muted">Thursday, 22 October</p>
                        <p className="mt-1 font-display text-2xl text-forest">Good morning, Zawadi.</p>
                      </div>
                      <span className="rounded-md bg-forest px-2.5 py-1.5 text-[8px] font-semibold text-ivory">New booking</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        ["Today", "4", "appointments"],
                        ["This week", "11", "bookings"],
                        ["Pending", "2", "requests"],
                      ].map(([label, value, sub]) => (
                        <div key={label} className="rounded-lg border border-line bg-white p-2.5">
                          <p className="text-[7px] uppercase tracking-[0.12em] text-muted">{label}</p>
                          <p className="mt-1 font-display text-2xl leading-none text-forest">{value}</p>
                          <p className="mt-0.5 text-[7px] text-muted">{sub}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 rounded-lg border border-line bg-white p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-ink">Today&apos;s schedule</p>
                        <span className="text-[7px] text-muted">View calendar</span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {[
                          ["10:00", "Deep Tissue Reset", "Zawadi", "confirmed"],
                          ["11:30", "Head & Shoulder", "Jabari", "confirmed"],
                          ["14:00", "Hot Stone Ritual", "Zawadi", "pending"],
                        ].map(([time, service, staff, status]) => (
                          <div key={time} className="flex items-center gap-2 rounded-md bg-[#faf7f1] px-2 py-1.5">
                            <span className="w-7 text-[7px] font-medium tabular-nums text-muted">{time}</span>
                            <span className="h-5 w-0.5 rounded-full bg-brass/70" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[8px] font-medium text-ink">{service}</p>
                              <p className="text-[7px] text-muted">{staff}</p>
                            </div>
                            <span className={`rounded-full px-1.5 py-0.5 text-[6px] uppercase tracking-wide ${status === "pending" ? "bg-[#f6e7d9] text-[#9d6537]" : "bg-[#e4ece4] text-forest"}`}>{status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-7 -left-4 w-[15rem] rotate-[-2deg] rounded-xl border border-line bg-white p-4 shadow-[0_24px_60px_-30px_rgba(36,72,61,0.5)] sm:-left-8">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-ivory"><Sparkles className="h-3.5 w-3.5" /></span>
                  <div>
                    <p className="text-[9px] font-semibold text-forest">Nuru assistant</p>
                    <p className="text-[7px] uppercase tracking-[0.1em] text-muted">Draft ready</p>
                  </div>
                </div>
                <p className="mt-3 text-[9px] leading-relaxed text-ink">“A quiet hour is waiting.” A promotion is ready for your review.</p>
                <div className="mt-2.5 flex gap-1.5">
                  <span className="rounded bg-forest px-2 py-1 text-[7px] font-semibold text-ivory">Review draft</span>
                  <span className="rounded border border-line px-2 py-1 text-[7px] text-muted">Not sent</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="border-b border-line bg-white/45">
          <div className="mx-auto flex max-w-[86rem] flex-wrap items-center justify-between gap-4 px-5 py-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted md:px-10">
            <span>One calm platform</span>
            <span className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5 text-brass" /> Branded storefront</span>
            <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-brass" /> Live booking</span>
            <span className="flex items-center gap-1.5"><LayoutDashboard className="h-3.5 w-3.5 text-brass" /> Business dashboard</span>
            <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-brass" /> AI operations</span>
            <span className="flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5 text-brass" /> Tenant isolation</span>
          </div>
        </div>

        <section id="product" className="mx-auto max-w-[86rem] px-5 py-20 md:px-10 md:py-28">
          <div className="max-w-2xl">
            <p className="sf-eyebrow">Beyond a booking page</p>
            <h2 className="mt-4 font-display text-[clamp(2.6rem,5vw,4.4rem)] leading-[0.95] text-forest">
              Three products, one considered experience.
            </h2>
            <p className="mt-5 text-[0.98rem] leading-relaxed text-muted">
              Everything a therapist needs to look established, stay organised and spend more time
              with clients — without stitching together five disconnected tools.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {[
              {
                icon: Store,
                number: "01",
                title: "A storefront with a point of view",
                body: "Editorial layouts, restrained motion and a theme system that feels commissioned — not templated. Your identity, applied consistently from the homepage to the booking confirmation.",
                points: ["Three coherent theme presets", "Draft, preview, publish", "Mobile-first by default"],
                image: "/media/amani/hands.jpg",
              },
              {
                icon: CalendarDays,
                number: "02",
                title: "Booking that holds up",
                body: "Real availability, calculated on the server from opening hours, therapist schedules, time off and existing appointments. Concurrent requests cannot silently double-book.",
                points: ["Server-side slot validation", "Timezone-aware scheduling", "Confirmed in the dashboard"],
                image: "/media/bahari/wave.jpg",
              },
              {
                icon: Sparkles,
                number: "03",
                title: "An assistant with boundaries",
                body: "The Nuru assistant reads only your business data, shows each tool it used, and stops for approval before sending a message or changing a guest's booking.",
                points: ["Observable tool calls", "Approval-bound actions", "Honest demo/live labels"],
                image: "/media/amani/detail.jpg",
              },
            ].map((feature) => (
              <article key={feature.number} className="group overflow-hidden rounded-2xl border border-line bg-paper">
                <div className="relative h-44 overflow-hidden">
                  <Image src={feature.image} alt="" fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1b2a23]/55 to-transparent" />
                  <span className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-sm">
                    <feature.icon className="h-4 w-4" />
                  </span>
                  <span className="absolute bottom-3 right-4 font-display text-2xl text-white/70">{feature.number}</span>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-[1.8rem] leading-tight text-forest">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{feature.body}</p>
                  <ul className="mt-5 space-y-2 border-t border-line pt-4">
                    {feature.points.map((point) => (
                      <li key={point} className="flex items-center gap-2 text-xs text-ink">
                        <Check className="h-3.5 w-3.5 text-brass" /> {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="studios" className="border-y border-line bg-[#efe9de] py-20 md:py-28">
          <div className="mx-auto max-w-[86rem] px-5 md:px-10">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="sf-eyebrow">See it with real data</p>
                <h2 className="mt-4 font-display text-[clamp(2.6rem,5vw,4.4rem)] leading-[0.95] text-forest">
                  Two studios. Two identities. Complete isolation.
                </h2>
                <p className="mt-5 text-[0.98rem] leading-relaxed text-muted">
                  Each demonstration studio has its own brand, services, team, bookings and AI
                  workspace. Switch between them to see how Nuru keeps tenants separate.
                </p>
              </div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-ivory px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-clay" /> Demonstration data
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {demoTenants.map((tenant) => {
                const meta = tenantImagery[tenant.slug];
                return (
                  <article key={tenant.slug} className="group relative overflow-hidden rounded-2xl">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={meta?.image ?? "/media/amani/hero.jpg"}
                        alt={`${tenant.name} demonstration storefront`}
                        fill
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className="object-cover transition-transform duration-[900ms] group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#14211b]/85 via-[#14211b]/25 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-6 text-ivory sm:p-8">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-white/60">{meta?.theme ?? "Demo studio"} · {tenant.slug === "bahari" ? "Mombasa" : "Nairobi"}</p>
                        <h3 className="mt-2 font-display text-4xl">{tenant.name}</h3>
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <form action="/api/demo/switch" method="post">
                            <input type="hidden" name="tenant" value={tenant.slug} />
                            <input type="hidden" name="next" value="/" />
                            <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ivory px-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-forest transition-colors hover:bg-white">
                              View storefront <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          </form>
                          <Link href="/login" className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-white/25 px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 transition-colors hover:bg-white/10">
                            Owner dashboard <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-5 text-[10px] leading-relaxed text-muted">
              Demonstration photography from Unsplash. Testimonials and business details are illustrative and clearly labelled in each storefront.
            </p>
          </div>
        </section>

        <section id="ai" className="mx-auto max-w-[86rem] px-5 py-20 md:px-10 md:py-28">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="sf-eyebrow">Quietly intelligent</p>
              <h2 className="mt-4 font-display text-[clamp(2.6rem,5vw,4.4rem)] leading-[0.95] text-forest">
                Help that shows its work.
              </h2>
              <p className="mt-5 text-[0.98rem] leading-relaxed text-muted">
                Ask what is quiet this week, draft a considered promotion, or propose new storefront
                copy. Nuru assembles the context from your business, records every step, and asks you
                before anything consequential happens.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  ["Reads the real diary", "Availability and booking summaries come from the same server-side engine as the storefront."],
                  ["Uses typed tools", "Every tool checks your identity, role, tenant and the current state of the resource."],
                  ["Stops at approval", "Sending a campaign, publishing, or changing a guest's booking requires an explicit, bound approval."],
                  ["Never pretends", "In demo mode, a prepared message is shown as a preview — never as delivered."],
                ].map(([title, body]) => (
                  <div key={title} className="flex gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-brass/50 text-brass"><Check className="h-3 w-3" /></span>
                    <div>
                      <h3 className="text-sm font-semibold text-forest">{title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-paper p-4 shadow-[0_30px_80px_-55px_rgba(36,72,61,0.5)] sm:p-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-ivory"><MessageSquareText className="h-4 w-4" /></span>
                  <div>
                    <p className="text-sm font-semibold text-forest">Nuru assistant</p>
                    <p className="text-[9px] uppercase tracking-[0.12em] text-muted">Workflow · awaiting approval</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#f4e7d8] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#8f5d33]">Demo mode</span>
              </div>
              <div className="mt-5 space-y-3 text-xs">
                <div className="ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-forest px-4 py-3 text-ivory">
                  Help me fill the quiet slots this week.
                </div>
                <div className="max-w-[92%] rounded-xl rounded-bl-sm bg-[#f6f1e8] px-4 py-3">
                  <p className="text-ink">I found six open slots in the next seven days, mostly Tuesday afternoon and Thursday morning.</p>
                  <p className="mt-2 text-muted">I drafted a warm email to the five clients who have opted in to studio notes.</p>
                </div>
                <div className="rounded-xl border border-line bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-forest">Draft · A quieter hour is waiting</p>
                    <span className="text-[9px] text-muted">Email · 5 recipients</span>
                  </div>
                  <p className="mt-2 line-clamp-3 font-display text-lg leading-snug text-ink">
                    “There is a little more room in the diary this week, and we would love to see you…”
                  </p>
                  <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                    <span className="rounded bg-forest px-2.5 py-1.5 text-[9px] font-semibold text-ivory">Approve draft</span>
                    <span className="rounded border border-line px-2.5 py-1.5 text-[9px] text-muted">Edit</span>
                    <span className="ml-auto text-[9px] font-medium text-[#8f5d33]">Not sent</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted">
                  <Check className="h-3.5 w-3.5 text-forest" /> Reads availability
                  <Check className="ml-2 h-3.5 w-3.5 text-forest" /> Respects marketing consent
                  <Check className="ml-2 h-3.5 w-3.5 text-forest" /> Requires approval
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-forest py-16 text-ivory md:py-20">
          <div className="mx-auto flex max-w-[86rem] flex-col items-start justify-between gap-8 px-5 md:flex-row md:items-center md:px-10">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-brass">The first walkthrough</p>
              <h2 className="mt-3 max-w-[22ch] font-display text-[clamp(2.4rem,4.5vw,3.8rem)] leading-[0.98]">
                Spend less time managing. More time caring.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="#studios" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-ivory px-6 text-[10px] font-semibold uppercase tracking-[0.12em] text-forest transition-colors hover:bg-white">
                Open a demo storefront <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <Link href="/login" className="inline-flex min-h-12 items-center gap-2 rounded-md border border-ivory/25 px-6 text-[10px] font-semibold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-white/10">
                Dashboard sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-ivory">
        <div className="mx-auto grid max-w-[86rem] gap-8 px-5 py-12 md:grid-cols-[1.5fr_1fr_1fr] md:px-10">
          <div>
            <Logo compact />
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-muted">
              Nuru means light in Swahili. A calmer operating system for independent wellness businesses.
            </p>
            <p className="mt-5 text-[9px] uppercase tracking-[0.14em] text-muted">Make room for well-being.</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink">Demonstrations</p>
            <div className="mt-3 flex flex-col gap-2 text-xs text-muted">
              {demoTenants.map((tenant) => (
                <form key={tenant.slug} action="/api/demo/switch" method="post">
                  <input type="hidden" name="tenant" value={tenant.slug} />
                  <input type="hidden" name="next" value="/" />
                  <button type="submit" className="text-left hover:text-forest">{tenant.name} storefront</button>
                </form>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink">Platform</p>
            <div className="mt-3 flex flex-col gap-2 text-xs text-muted">
              <Link href="/login" className="hover:text-forest">Sign in</Link>
              <a href="#ai" className="hover:text-forest">AI & approvals</a>
              <a href="#product" className="hover:text-forest">Product overview</a>
              <a href={`${env.appUrl}/api/health`} className="inline-flex items-center gap-1 hover:text-forest">Service health <ArrowUpRight className="h-3 w-3" /></a>
            </div>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-[86rem] flex-col gap-2 px-5 py-5 text-[9px] uppercase tracking-[0.13em] text-muted sm:flex-row sm:items-center sm:justify-between md:px-10">
            <p>© {new Date().getFullYear()} Nuru Wellness. Demonstration product.</p>
            <p className="normal-case tracking-normal">Imagery licensed from Unsplash · Demo data labelled throughout</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
