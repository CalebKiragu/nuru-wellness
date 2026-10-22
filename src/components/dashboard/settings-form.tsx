"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

export function SettingsForm({
  tenant,
  location,
}: {
  tenant: { name: string; timezone: string; currency: string };
  location: {
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    phone: string | null;
    email: string | null;
  } | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: tenant.name,
    timezone: tenant.timezone,
    currency: tenant.currency,
    locationName: location?.name ?? "",
    addressLine1: location?.addressLine1 ?? "",
    addressLine2: location?.addressLine2 ?? "",
    city: location?.city ?? "",
    phone: location?.phone ?? "",
    email: location?.email ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          timezone: form.timezone,
          currency: form.currency,
          location: {
            name: form.locationName,
            addressLine1: form.addressLine1,
            addressLine2: form.addressLine2 || null,
            city: form.city,
            phone: form.phone || null,
            email: form.email || null,
          },
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not save settings.");
      setMessage("Business settings saved.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="dash-label">Business name</label>
          <input className="dash-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </div>
        <div>
          <label className="dash-label">Currency</label>
          <input className="dash-input" value={form.currency} maxLength={3} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} required />
        </div>
        <div className="sm:col-span-2">
          <label className="dash-label">Timezone</label>
          <input className="dash-input" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} placeholder="Africa/Nairobi" required />
          <p className="mt-1 text-[10px] text-muted">IANA timezone, for example Africa/Nairobi or Europe/London. Changing this shifts how times are displayed and booked.</p>
        </div>
      </div>

      <div className="border-t border-line pt-3">
        <h3 className="text-xs font-semibold">Location</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="dash-label">Location name</label>
            <input className="dash-input" value={form.locationName} onChange={(event) => setForm({ ...form, locationName: event.target.value })} required />
          </div>
          <div>
            <label className="dash-label">City</label>
            <input className="dash-input" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} required />
          </div>
          <div>
            <label className="dash-label">Address line 1</label>
            <input className="dash-input" value={form.addressLine1} onChange={(event) => setForm({ ...form, addressLine1: event.target.value })} required />
          </div>
          <div>
            <label className="dash-label">Address line 2</label>
            <input className="dash-input" value={form.addressLine2} onChange={(event) => setForm({ ...form, addressLine2: event.target.value })} />
          </div>
          <div>
            <label className="dash-label">Phone</label>
            <input className="dash-input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </div>
          <div>
            <label className="dash-label">Email</label>
            <input type="email" className="dash-input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="dash-btn dash-btn-primary">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save settings
        </button>
        {message && <span role="status" className="text-[11px] text-[#2f5c42]">{message}</span>}
        {error && <span role="alert" className="text-[11px] text-[#9c4634]">{error}</span>}
      </div>
    </form>
  );
}
