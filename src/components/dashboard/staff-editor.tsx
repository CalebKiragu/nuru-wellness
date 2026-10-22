"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Loader2, Plus, Save, Trash2 } from "lucide-react";

type Person = {
  id: string;
  name: string;
  title: string;
  bio: string;
  email: string | null;
  phone: string | null;
  color: string;
  isActive: boolean;
};

type AvailabilityRow = { weekday: number; startTime: string; endTime: string };
type TimeOffRow = { id: string; startsAt: string | Date; endsAt: string | Date; reason: string };
type ServiceRow = { id: string; name: string };

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function StaffEditor({
  person,
  availability,
  timeOff,
  services,
  allServices,
  timezone,
}: {
  person: Person;
  availability: AvailabilityRow[];
  timeOff: TimeOffRow[];
  services: ServiceRow[];
  allServices: ServiceRow[];
  timezone: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: person.name,
    title: person.title,
    bio: person.bio,
    email: person.email ?? "",
    phone: person.phone ?? "",
    color: person.color,
    isActive: person.isActive,
  });
  const [serviceIds, setServiceIds] = useState<string[]>(services.map((service) => service.id));
  const [days, setDays] = useState(() =>
    weekdays.map((label, weekday) => {
      const row = availability.find((entry) => entry.weekday === weekday);
      return {
        weekday,
        label,
        active: Boolean(row),
        startTime: row?.startTime ?? "09:00",
        endTime: row?.endTime ?? "18:00",
      };
    }),
  );
  const [off, setOff] = useState({ date: "", startTime: "12:00", endTime: "15:00", reason: "Unavailable" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setBusy("profile");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/dashboard/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: person.id,
          name: form.name,
          title: form.title,
          bio: form.bio,
          email: form.email || null,
          phone: form.phone || null,
          color: form.color,
          isActive: form.isActive,
          serviceIds,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not save team member.");
      setMessage("Team member saved.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save team member.");
    } finally {
      setBusy(null);
    }
  }

  async function saveAvailability() {
    setBusy("availability");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/dashboard/staff/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: person.id,
          availability: days.filter((day) => day.active).map((day) => ({
            weekday: day.weekday,
            startTime: day.startTime,
            endTime: day.endTime,
            isActive: true,
          })),
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not save working hours.");
      setMessage("Working hours saved.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save working hours.");
    } finally {
      setBusy(null);
    }
  }

  async function addTimeOff(event: React.FormEvent) {
    event.preventDefault();
    if (!off.date) {
      setError("Choose a date for the time off.");
      return;
    }
    setBusy("timeoff");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/dashboard/staff/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: person.id, ...off }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not add time off.");
      setMessage("Time off added.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add time off.");
    } finally {
      setBusy(null);
    }
  }

  async function removeTimeOff(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/dashboard/staff/time-off?id=${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={saveProfile} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="dash-label">Name</label>
            <input className="dash-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </div>
          <div>
            <label className="dash-label">Role / title</label>
            <input className="dash-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          </div>
          <div>
            <label className="dash-label">Email</label>
            <input type="email" className="dash-input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <div>
              <label className="dash-label">Phone</label>
              <input className="dash-input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </div>
            <div>
              <label className="dash-label">Colour</label>
              <input type="color" className="dash-input h-[2.65rem] p-1" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
            </div>
          </div>
        </div>
        <div>
          <label className="dash-label">Bio</label>
          <textarea rows={3} className="dash-input resize-none" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
        </div>
        <div>
          <p className="dash-label">Treatments this person can perform</p>
          <div className="flex flex-wrap gap-2">
            {allServices.map((service) => (
              <label key={service.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={serviceIds.includes(service.id)}
                  onChange={(event) =>
                    setServiceIds((current) =>
                      event.target.checked ? [...current, service.id] : current.filter((id) => id !== service.id),
                    )
                  }
                  className="h-3.5 w-3.5 accent-forest"
                />
                {service.name}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="h-4 w-4 accent-forest" />
          Active and bookable
        </label>
        <button type="submit" disabled={busy === "profile"} className="dash-btn dash-btn-primary">
          {busy === "profile" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save profile
        </button>
      </form>

      <div className="border-t border-line pt-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-ink">Working hours</h3>
            <p className="text-[10px] text-muted">Independent of the studio&apos;s business hours.</p>
          </div>
          <button type="button" onClick={saveAvailability} disabled={busy === "availability"} className="dash-btn dash-btn-primary">
            {busy === "availability" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save hours
          </button>
        </div>
        <div className="space-y-1.5">
          {days.map((day, index) => (
            <div key={day.weekday} className="grid grid-cols-[6.5rem_1fr_1fr] items-center gap-2">
              <label className="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={day.active}
                  onChange={(event) => {
                    const next = [...days];
                    next[index] = { ...day, active: event.target.checked };
                    setDays(next);
                  }}
                  className="h-3.5 w-3.5 accent-forest"
                />
                {day.label.slice(0, 3)}
              </label>
              <input type="time" className="dash-input min-h-9 py-1 text-xs" value={day.startTime} disabled={!day.active} onChange={(event) => { const next = [...days]; next[index] = { ...day, startTime: event.target.value }; setDays(next); }} />
              <input type="time" className="dash-input min-h-9 py-1 text-xs" value={day.endTime} disabled={!day.active} onChange={(event) => { const next = [...days]; next[index] = { ...day, endTime: event.target.value }; setDays(next); }} />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line pt-5">
        <h3 className="text-xs font-semibold text-ink">Time off</h3>
        {timeOff.length > 0 ? (
          <ul className="mt-2 divide-y divide-line">
            {timeOff.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-start gap-2">
                  <CalendarOff className="mt-0.5 h-3.5 w-3.5 text-muted" />
                  <div>
                    <p className="text-[11px] font-medium">
                      {new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: timezone }).format(new Date(entry.startsAt))}
                      {" · "}
                      {new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: timezone }).format(new Date(entry.startsAt))}
                      {" – "}
                      {new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: timezone }).format(new Date(entry.endsAt))}
                    </p>
                    <p className="text-[10px] text-muted">{entry.reason}</p>
                  </div>
                </div>
                <button type="button" onClick={() => removeTimeOff(entry.id)} disabled={busy === entry.id} className="p-1.5 text-muted hover:text-[#9c4634]" aria-label="Remove time off">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[11px] text-muted">No upcoming time off.</p>
        )}
        <form onSubmit={addTimeOff} className="mt-3 grid gap-2 sm:grid-cols-[9rem_6rem_6rem_1fr_auto]">
          <input type="date" className="dash-input" value={off.date} onChange={(event) => setOff({ ...off, date: event.target.value })} required />
          <input type="time" className="dash-input" value={off.startTime} onChange={(event) => setOff({ ...off, startTime: event.target.value })} />
          <input type="time" className="dash-input" value={off.endTime} onChange={(event) => setOff({ ...off, endTime: event.target.value })} />
          <input className="dash-input" placeholder="Reason" value={off.reason} onChange={(event) => setOff({ ...off, reason: event.target.value })} />
          <button type="submit" disabled={busy === "timeoff"} className="dash-btn dash-btn-secondary"><Plus className="h-3.5 w-3.5" /> Add</button>
        </form>
      </div>

      {(message || error) && (
        <p role={error ? "alert" : "status"} className={`text-[11px] ${error ? "text-[#9c4634]" : "text-[#2f5c42]"}`}>{error || message}</p>
      )}
    </div>
  );
}
