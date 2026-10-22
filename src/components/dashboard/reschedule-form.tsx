"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";

type Staff = { id: string; name: string };
type Slot = { start: string; end: string; label: string };

export function RescheduleForm({
  bookingId,
  serviceId,
  staff,
  defaultStaffId,
  defaultDate,
}: {
  bookingId: string;
  serviceId: string;
  staff: Staff[];
  defaultStaffId: string;
  defaultDate: string;
}) {
  const router = useRouter();
  const [staffId, setStaffId] = useState(defaultStaffId);
  const [date, setDate] = useState(defaultDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!date || !staffId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSlot(null);
    fetch(`/api/dashboard/availability?serviceId=${serviceId}&staffId=${staffId}&date=${date}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const json = (await response.json()) as { slots?: Slot[]; error?: string };
        if (!response.ok) throw new Error(json.error ?? "Could not load availability.");
        setSlots(json.slots ?? []);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setSlots([]);
        setError(cause instanceof Error ? cause.message : "Could not load availability.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [serviceId, staffId, date]);

  async function submit() {
    if (!slot) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/dashboard/bookings/${bookingId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: slot.start, staffId, reason: "Moved by the studio" }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not reschedule.");
      setMessage(`Moved to ${slot.label}. The client notification was simulated in demo mode.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reschedule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="dash-label">Therapist</span>
          <select className="dash-input" value={staffId} onChange={(event) => setStaffId(event.target.value)}>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="dash-label">New date</span>
          <input type="date" className="dash-input" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>

      <div>
        <p className="dash-label">Available times</p>
        {loading ? (
          <p className="flex items-center gap-2 py-3 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the diary…</p>
        ) : slots.length === 0 ? (
          <p className="rounded-md border border-line bg-[#faf6ef] px-3 py-2.5 text-[11px] text-muted">No open times for this therapist and date.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {slots.slice(0, 24).map((entry) => (
              <button
                key={entry.start}
                type="button"
                onClick={() => setSlot(entry)}
                className={`min-h-9 rounded-md border px-2 text-[11px] font-medium transition-colors ${slot?.start === entry.start ? "border-forest bg-forest text-ivory" : "border-line bg-paper hover:border-forest/50"}`}
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={submit} disabled={!slot || busy} className="dash-btn dash-btn-primary disabled:opacity-40">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
        Confirm new time
      </button>
      {message && <p role="status" className="text-[11px] text-[#2f5c42]">{message}</p>}
      {error && <p role="alert" className="text-[11px] text-[#9c4634]">{error}</p>}
    </div>
  );
}
