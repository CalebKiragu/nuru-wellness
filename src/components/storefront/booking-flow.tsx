"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { formatDuration, formatMoney } from "@/lib/format";

type StaffOption = { id: string; name: string; title: string; imageUrl: string | null };
type AddonOption = { id: string; name: string; description: string; priceCents: number; durationMinutes: number };
type DateOption = { key: string; weekday: string; day: string; month: string; closed: boolean };
type Slot = { start: string; end: string; label: string };

type Props = {
  businessName: string;
  timezone: string;
  currency: string;
  service: {
    id: string;
    slug: string;
    name: string;
    shortDescription: string;
    durationMinutes: number;
    priceCents: number;
  };
  staff: StaffOption[];
  addons: AddonOption[];
  dates: DateOption[];
  initialStaffId?: string;
};

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
  phone: z.string().trim().min(7, "Please enter a contact number").max(30),
  note: z.string().trim().max(600).optional(),
  policyAccepted: z.literal(true, { errorMap: () => ({ message: "Please accept the booking policy" }) }),
  marketingConsent: z.boolean().optional(),
});

type Details = z.infer<typeof detailsSchema>;

function addMinutesLabel(total: number) {
  return formatDuration(total);
}

function groupSlots(slots: Slot[], timezone: string) {
  const groups: { label: string; slots: Slot[] }[] = [
    { label: "Morning", slots: [] },
    { label: "Afternoon", slots: [] },
    { label: "Evening", slots: [] },
  ];
  for (const slot of slots) {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timezone }).format(new Date(slot.start)),
    );
    if (hour < 12) groups[0].slots.push(slot);
    else if (hour < 17) groups[1].slots.push(slot);
    else groups[2].slots.push(slot);
  }
  return groups.filter((group) => group.slots.length);
}

export function BookingFlow({ businessName, timezone, currency, service, staff, addons, dates, initialStaffId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [staffId, setStaffId] = useState(
    initialStaffId && staff.some((person) => person.id === initialStaffId) ? initialStaffId : staff[0]?.id ?? "",
  );
  const firstOpen = dates.find((date) => !date.closed) ?? dates[0];
  const [dateKey, setDateKey] = useState(firstOpen?.key ?? "");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const form = useForm<Details>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { name: "", email: "", phone: "", note: "", marketingConsent: false },
  });

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  const totalDuration = service.durationMinutes + addons.filter((addon) => addonIds.includes(addon.id)).reduce((sum, addon) => sum + addon.durationMinutes, 0);
  const addonTotal = addons.filter((addon) => addonIds.includes(addon.id)).reduce((sum, addon) => sum + addon.priceCents, 0);
  const totalPrice = service.priceCents + addonTotal;
  const selectedStaff = staff.find((person) => person.id === staffId);
  const selectedDate = dates.find((date) => date.key === dateKey);

  useEffect(() => {
    if (!staffId || !dateKey) return;
    const controller = new AbortController();
    setLoading(true);
    setAvailabilityError("");
    const params = new URLSearchParams({ serviceId: service.id, staffId, date: dateKey });
    if (addonIds.length) params.set("addonIds", addonIds.join(","));
    fetch(`/api/availability?${params.toString()}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not load availability");
        setSlots(json.slots ?? []);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSlots([]);
        setAvailabilityError(error instanceof Error ? error.message : "Could not load availability");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [service.id, staffId, dateKey, addonIds]);

  useEffect(() => {
    setSlot(null);
  }, [staffId, dateKey, addonIds]);

  const grouped = useMemo(() => groupSlots(slots, timezone), [slots, timezone]);

  function toggleAddon(id: string) {
    setAddonIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  function beginDetails() {
    if (!slot) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(values: Details) {
    if (!slot) {
      setStep(1);
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          serviceId: service.id,
          staffId,
          start: slot.start,
          addonIds,
          customer: {
            name: values.name,
            email: values.email,
            phone: values.phone,
            note: values.note || null,
          },
          marketingConsent: Boolean(values.marketingConsent),
          policyAccepted: values.policyAccepted,
          idempotencyKey,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "We could not complete your booking.");
      }
      router.push(`/booking/${encodeURIComponent(json.booking.reference)}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "We could not complete your booking.");
      setIdempotencyKey(crypto.randomUUID());
    } finally {
      setSubmitting(false);
    }
  }

  const summary = (
    <div className="rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-surface)] p-5">
      <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--color-accent)]">Your booking</p>
      <h2 className="mt-2 font-display text-2xl">{service.name}</h2>
      <div className="mt-4 space-y-2.5 border-t border-[var(--color-tenant-border)] pt-4 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-[var(--color-tenant-muted)]">Duration</span>
          <span>{addMinutesLabel(totalDuration)}</span>
        </div>
        {addonIds.length > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-[var(--color-tenant-muted)]">Add-ons</span>
            <span>{addonIds.length}</span>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span className="text-[var(--color-tenant-muted)]">Therapist</span>
          <span>{selectedStaff?.name ?? "To be confirmed"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--color-tenant-muted)]">Date</span>
          <span>{selectedDate ? `${selectedDate.weekday} ${selectedDate.day} ${selectedDate.month}` : "—"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--color-tenant-muted)]">Time</span>
          <span>{slot?.label ?? "—"}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-[var(--color-tenant-border)] pt-3 text-sm font-semibold">
          <span>Total</span>
          <span>{formatMoney(totalPrice, currency)}</span>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-md bg-[var(--color-canvas)] p-3 text-[10px] leading-relaxed text-[var(--color-tenant-muted)]">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]" />
        <span>
          No payment is taken in this demonstration. The appointment is saved to the studio&apos;s demo database and appears instantly in the dashboard.
        </span>
      </div>
    </div>
  );

  return (
    <div className="sf-container py-10 lg:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/services/${service.slug}`} className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-tenant-muted)] hover:text-[var(--color-brand)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Treatment details
        </Link>
        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-tenant-muted)]">Booking with {businessName}</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
        <div>
          <ol className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-tenant-muted)]" aria-label="Booking progress">
            {[
              [1, "Time"],
              [2, "Details"],
              [3, "Review"],
            ].map(([number, label], index) => (
              <li key={String(label)} className="flex items-center gap-2">
                {index > 0 && <ChevronRight className="h-3 w-3 opacity-40" aria-hidden="true" />}
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] ${step === number ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-[var(--color-on-brand)]" : step > Number(number) ? "border-[var(--color-brand)] text-[var(--color-brand)]" : "border-[var(--color-tenant-border)]"}`}
                  aria-current={step === number ? "step" : undefined}
                >
                  {step > Number(number) ? <Check className="h-3 w-3" /> : number}
                </span>
                <span className={step === number ? "text-[var(--color-tenant-ink)]" : ""}>{label}</span>
              </li>
            ))}
          </ol>

          {step === 1 && (
            <div className="mt-7 space-y-9">
              <div>
                <h1 className="font-display text-[clamp(2.2rem,4vw,3.4rem)] leading-[1]">Choose your time.</h1>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--color-tenant-muted)]">
                  Availability is calculated live from the studio diary. Times shown are in {timezone.replace("_", " ")}.
                </p>
              </div>

              {staff.length > 1 && (
                <fieldset>
                  <legend className="sf-label">Therapist</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {staff.map((person) => (
                      <label
                        key={person.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-[var(--tenant-radius)] border p-3 transition-colors ${staffId === person.id ? "border-[var(--color-brand)] bg-[var(--color-soft)]/60" : "border-[var(--color-tenant-border)] bg-[var(--color-surface)]"}`}
                      >
                        <input
                          type="radio"
                          name="staff"
                          value={person.id}
                          checked={staffId === person.id}
                          onChange={() => setStaffId(person.id)}
                          className="sr-only"
                        />
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-soft)] text-[var(--color-brand)]">
                          <UserRound className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-medium">{person.name}</span>
                          <span className="block text-[9px] uppercase tracking-[0.1em] text-[var(--color-tenant-muted)]">{person.title}</span>
                        </span>
                        {staffId === person.id && <Check className="ml-auto h-4 w-4 text-[var(--color-brand)]" />}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {addons.length > 0 && (
                <fieldset>
                  <legend className="sf-label">Add-ons <span className="normal-case tracking-normal opacity-60">(optional)</span></legend>
                  <div className="space-y-2">
                    {addons.map((addon) => (
                      <label key={addon.id} className={`flex cursor-pointer items-start gap-3 rounded-[var(--tenant-radius)] border p-3 transition-colors ${addonIds.includes(addon.id) ? "border-[var(--color-brand)] bg-[var(--color-soft)]/45" : "border-[var(--color-tenant-border)] bg-[var(--color-surface)]"}`}>
                        <input
                          type="checkbox"
                          checked={addonIds.includes(addon.id)}
                          onChange={() => toggleAddon(addon.id)}
                          className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-sm font-medium">{addon.name}</span>
                            <span className="text-xs">{formatMoney(addon.priceCents, currency)} <span className="text-[var(--color-tenant-muted)]">· +{addon.durationMinutes} min</span></span>
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--color-tenant-muted)]">{addon.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <fieldset>
                <legend className="sf-label">Date</legend>
                <div className="ticker-mask -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Choose a date">
                  {dates.map((date) => (
                    <button
                      key={date.key}
                      type="button"
                      disabled={date.closed}
                      onClick={() => setDateKey(date.key)}
                      aria-pressed={dateKey === date.key}
                      className={`flex min-w-[4.6rem] flex-col items-center rounded-[var(--tenant-radius)] border px-3 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${dateKey === date.key ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "border-[var(--color-tenant-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand)]/40"}`}
                    >
                      <span className="text-[8px] uppercase tracking-[0.1em] opacity-70">{date.weekday}</span>
                      <span className="mt-0.5 font-display text-2xl leading-none">{date.day}</span>
                      <span className="mt-1 text-[8px] uppercase tracking-[0.1em] opacity-70">{date.closed ? "Closed" : date.month}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--color-tenant-muted)]">
                  <CalendarDays className="h-3.5 w-3.5" /> Dates in studio time · 21 days shown
                </div>
              </fieldset>

              <fieldset>
                <legend className="sf-label">Available times</legend>
                {loading ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-[var(--color-tenant-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Checking the diary…</div>
                ) : availabilityError ? (
                  <p role="alert" className="rounded-md bg-[#FBEDE9] px-4 py-3 text-sm text-[#8f4332]">{availabilityError}</p>
                ) : grouped.length === 0 ? (
                  <div className="rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-surface)] px-5 py-6">
                    <p className="text-sm">No available times on this date.</p>
                    <p className="mt-1 text-xs text-[var(--color-tenant-muted)]">Try another day, or choose a different therapist.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {grouped.map((group) => (
                      <div key={group.label}>
                        <p className="mb-2 text-[9px] uppercase tracking-[0.14em] text-[var(--color-tenant-muted)]">{group.label}</p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {group.slots.map((entry) => (
                            <button
                              key={entry.start}
                              type="button"
                              onClick={() => setSlot(entry)}
                              aria-pressed={slot?.start === entry.start}
                              className={`min-h-11 rounded-[calc(var(--tenant-radius)*0.6)] border px-2 text-xs font-medium transition-colors ${slot?.start === entry.start ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "border-[var(--color-tenant-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand)]"}`}
                            >
                              {entry.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-tenant-border)] pt-6">
                <p className="text-xs text-[var(--color-tenant-muted)]">You will not be charged to book.</p>
                <button type="button" onClick={beginDetails} disabled={!slot} className="sf-btn sf-btn-primary disabled:cursor-not-allowed disabled:opacity-40">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={form.handleSubmit(() => setStep(3))} className="mt-7">
              <h1 className="font-display text-[clamp(2.2rem,4vw,3.4rem)] leading-[1]">A few details.</h1>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--color-tenant-muted)]">
                We only ask for what the studio needs to prepare for your visit.
              </p>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="sf-label" htmlFor="name">Full name</label>
                  <input id="name" className="sf-input" autoComplete="name" {...form.register("name")} aria-invalid={Boolean(form.formState.errors.name)} />
                  {form.formState.errors.name && <p className="mt-1 text-xs text-[#9c4634]">{form.formState.errors.name.message}</p>}
                </div>
                <div>
                  <label className="sf-label" htmlFor="email">Email</label>
                  <input id="email" type="email" className="sf-input" autoComplete="email" {...form.register("email")} aria-invalid={Boolean(form.formState.errors.email)} />
                  {form.formState.errors.email && <p className="mt-1 text-xs text-[#9c4634]">{form.formState.errors.email.message}</p>}
                </div>
                <div>
                  <label className="sf-label" htmlFor="phone">Phone</label>
                  <input id="phone" type="tel" className="sf-input" autoComplete="tel" {...form.register("phone")} aria-invalid={Boolean(form.formState.errors.phone)} />
                  {form.formState.errors.phone && <p className="mt-1 text-xs text-[#9c4634]">{form.formState.errors.phone.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="sf-label" htmlFor="note">Anything we should know? <span className="normal-case tracking-normal opacity-60">(optional)</span></label>
                  <textarea id="note" rows={3} className="sf-input resize-none" placeholder="Preferences, focus areas, or accessibility needs." {...form.register("note")} />
                  <p className="mt-1 text-[10px] text-[var(--color-tenant-muted)]">Please avoid sharing medical details here. You can discuss anything relevant privately with your therapist.</p>
                </div>
              </div>

              <div className="mt-5 space-y-3 rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-surface)] p-4">
                <label className="flex items-start gap-3 text-xs leading-relaxed">
                  <input type="checkbox" {...form.register("policyAccepted")} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
                  <span>
                    I have read and accept the{" "}
                    <Link href="/policies" target="_blank" className="sf-link font-medium text-[var(--color-brand)]">booking and cancellation policy</Link>.
                    {form.formState.errors.policyAccepted && <span className="mt-1 block text-[#9c4634]">{form.formState.errors.policyAccepted.message}</span>}
                  </span>
                </label>
                <label className="flex items-start gap-3 text-xs leading-relaxed">
                  <input type="checkbox" {...form.register("marketingConsent")} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
                  <span>Send me occasional studio notes and offers. This is optional and separate from my booking confirmation.</span>
                </label>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-tenant-border)] pt-6">
                <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-tenant-muted)]">
                  <ArrowLeft className="h-3.5 w-3.5" /> Change time
                </button>
                <button type="submit" className="sf-btn sf-btn-primary">
                  Review booking <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="mt-7">
              <h1 className="font-display text-[clamp(2.2rem,4vw,3.4rem)] leading-[1]">One last look.</h1>
              <p className="mt-3 text-sm text-[var(--color-tenant-muted)]">Check the details below before confirming.</p>

              <div className="mt-7 space-y-4">
                <div className="rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-surface)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-accent)]">Treatment</p>
                      <h2 className="mt-1 font-display text-2xl">{service.name}</h2>
                      <p className="mt-1 text-xs text-[var(--color-tenant-muted)]">{formatDuration(totalDuration)} with {selectedStaff?.name}</p>
                    </div>
                    <p className="text-sm font-semibold">{formatMoney(totalPrice, currency)}</p>
                  </div>
                  {addonIds.length > 0 && (
                    <ul className="mt-3 border-t border-[var(--color-tenant-border)] pt-3 text-xs text-[var(--color-tenant-muted)]">
                      {addons.filter((addon) => addonIds.includes(addon.id)).map((addon) => (
                        <li key={addon.id} className="flex justify-between gap-3 py-0.5">
                          <span>+ {addon.name}</span>
                          <span>{formatMoney(addon.priceCents, currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-surface)] p-5">
                    <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-accent)]">When</p>
                    <p className="mt-2 font-display text-xl">{selectedDate?.weekday} {selectedDate?.day} {selectedDate?.month}</p>
                    <p className="mt-1 text-sm text-[var(--color-tenant-muted)]">{slot?.label} · {timezone.replace("_", " ")}</p>
                    <button type="button" onClick={() => setStep(1)} className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-brand)] underline underline-offset-4">Change</button>
                  </div>
                  <div className="rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-surface)] p-5">
                    <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-accent)]">Guest</p>
                    <p className="mt-2 font-display text-xl">{form.getValues("name")}</p>
                    <p className="mt-1 truncate text-sm text-[var(--color-tenant-muted)]">{form.getValues("email")}</p>
                    <p className="text-sm text-[var(--color-tenant-muted)]">{form.getValues("phone")}</p>
                    <button type="button" onClick={() => setStep(2)} className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-brand)] underline underline-offset-4">Edit</button>
                  </div>
                </div>

                {form.getValues("note") && (
                  <div className="rounded-[var(--tenant-radius)] border border-[var(--color-tenant-border)] bg-[var(--color-surface)] p-5">
                    <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-accent)]">Your note</p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-tenant-muted)]">{form.getValues("note")}</p>
                  </div>
                )}

                <div className="rounded-[var(--tenant-radius)] bg-[var(--color-soft)]/60 p-4 text-xs leading-relaxed text-[var(--color-tenant-muted)]">
                  <p className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand)]" />
                    <span>
                      <strong className="font-semibold text-[var(--color-tenant-ink)]">Demonstration booking.</strong>{" "}
                      Your appointment will be persisted in the demo database and appear in the studio dashboard. No card details are collected, no payment is taken, and the confirmation email is simulated in demo mode.
                    </span>
                  </p>
                </div>

                {submitError && <p role="alert" className="rounded-md bg-[#FBEDE9] px-4 py-3 text-sm text-[#8f4332]">{submitError}</p>}

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-tenant-border)] pt-6">
                  <button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-tenant-muted)]">
                    <ArrowLeft className="h-3.5 w-3.5" /> Edit details
                  </button>
                  <button type="button" onClick={form.handleSubmit(submit)} disabled={submitting} className="sf-btn sf-btn-primary min-w-44 disabled:opacity-60">
                    {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</> : <>Confirm appointment <Check className="h-4 w-4" /></>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-3">
            {summary}
            <div className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.12em] text-[var(--color-tenant-muted)]">
              <Clock className="h-3 w-3" /> Real availability, checked again on confirmation
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-tenant-border)] bg-[var(--color-surface)]/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-tenant-muted)]">{slot ? `${selectedDate?.weekday} ${selectedDate?.day} · ${slot.label}` : "Choose a time"}</p>
            <p className="text-sm font-semibold">{formatMoney(totalPrice, currency)}</p>
          </div>
          {step === 1 ? (
            <button type="button" onClick={beginDetails} disabled={!slot} className="sf-btn sf-btn-primary disabled:opacity-40">Continue</button>
          ) : step === 2 ? (
            <button type="button" onClick={form.handleSubmit(() => setStep(3))} className="sf-btn sf-btn-primary">Review</button>
          ) : (
            <button type="button" onClick={form.handleSubmit(submit)} disabled={submitting} className="sf-btn sf-btn-primary">
              {submitting ? "Confirming…" : "Confirm"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
