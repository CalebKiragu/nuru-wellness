"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";

const actions = [
  { status: "confirmed", label: "Confirm", className: "dash-btn dash-btn-primary" },
  { status: "completed", label: "Mark completed", className: "dash-btn dash-btn-secondary" },
  { status: "no_show", label: "No-show", className: "dash-btn dash-btn-secondary" },
  { status: "cancelled", label: "Cancel", className: "dash-btn dash-btn-danger" },
] as const;

export function BookingStatusActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const allowed =
    status === "pending"
      ? ["confirmed", "cancelled"]
      : status === "confirmed"
        ? ["completed", "no_show", "cancelled"]
        : [];

  if (!allowed.length) {
    return (
      <p className="text-[11px] leading-relaxed text-muted">
        This booking is {status.replace("_", " ")} and cannot be changed further. Status history is retained for audit.
      </p>
    );
  }

  async function change(next: string) {
    if (next === "cancelled" && !window.confirm("Cancel this appointment? The client notification will be simulated in demo mode.")) {
      return;
    }
    setBusy(next);
    setError("");
    try {
      const response = await fetch(`/api/dashboard/bookings/${bookingId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not update the booking.");
      setResult(`Booking marked ${next.replace("_", " ")}.`);
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the booking.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {actions
          .filter((action) => allowed.includes(action.status))
          .map((action) => (
            <button key={action.status} type="button" onClick={() => change(action.status)} disabled={Boolean(busy)} className={action.className}>
              {busy === action.status ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : action.status === "cancelled" ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              {action.label}
            </button>
          ))}
      </div>
      {pending && <p className="mt-2 text-[10px] text-muted">Refreshing…</p>}
      {result && <p role="status" className="mt-2 text-[11px] text-[#2f5c42]">{result}</p>}
      {error && <p role="alert" className="mt-2 text-[11px] text-[#9c4634]">{error}</p>}
    </div>
  );
}
