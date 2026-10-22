"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function HoursForm({
  hours,
}: {
  hours: { weekday: number; opensAt: string; closesAt: string; isClosed: boolean }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(() =>
    labels.map((label, weekday) => {
      const row = hours.find((entry) => entry.weekday === weekday);
      return {
        weekday,
        label,
        opensAt: row?.opensAt ?? "09:00",
        closesAt: row?.closesAt ?? "18:00",
        isClosed: row?.isClosed ?? false,
      };
    }),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/dashboard/hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: rows }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not save opening hours.");
      setMessage("Opening hours saved. Availability recalculates immediately.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save opening hours.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="space-y-1.5">
        {rows.map((row, index) => (
          <div key={row.weekday} className="grid grid-cols-[6rem_1fr_1fr_4rem] items-center gap-2">
            <span className="text-[11px]">{row.label}</span>
            <input
              type="time"
              className="dash-input min-h-9 py-1 text-xs"
              value={row.opensAt}
              disabled={row.isClosed}
              onChange={(event) => { const next = [...rows]; next[index] = { ...row, opensAt: event.target.value }; setRows(next); }}
            />
            <input
              type="time"
              className="dash-input min-h-9 py-1 text-xs"
              value={row.closesAt}
              disabled={row.isClosed}
              onChange={(event) => { const next = [...rows]; next[index] = { ...row, closesAt: event.target.value }; setRows(next); }}
            />
            <label className="flex items-center gap-1 text-[10px] text-muted">
              <input
                type="checkbox"
                checked={row.isClosed}
                onChange={(event) => { const next = [...rows]; next[index] = { ...row, isClosed: event.target.checked }; setRows(next); }}
                className="h-3.5 w-3.5 accent-forest"
              />
              Closed
            </label>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={busy} className="dash-btn dash-btn-primary">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save hours
        </button>
        {message && <span role="status" className="text-[11px] text-[#2f5c42]">{message}</span>}
        {error && <span role="alert" className="text-[11px] text-[#9c4634]">{error}</span>}
      </div>
    </form>
  );
}
