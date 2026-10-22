"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

export function CustomerForm({
  customer,
}: {
  customer: { id: string; name: string; email: string | null; phone: string | null; notes: string | null };
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: customer.name,
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    notes: customer.notes ?? "",
    marketingConsent: false,
  });
  const [consentKnown, setConsentKnown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/dashboard/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          notes: form.notes || null,
          ...(consentKnown ? { marketingConsent: form.marketingConsent } : {}),
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not save the client.");
      setMessage("Client details saved.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the client.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="dash-label" htmlFor="client-name">Name</label>
        <input id="client-name" className="dash-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="dash-label" htmlFor="client-email">Email</label>
          <input id="client-email" type="email" className="dash-input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </div>
        <div>
          <label className="dash-label" htmlFor="client-phone">Phone</label>
          <input id="client-phone" className="dash-input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </div>
      </div>
      <div>
        <label className="dash-label" htmlFor="client-notes">Private studio notes</label>
        <textarea id="client-notes" rows={3} className="dash-input resize-none" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        <p className="mt-1 text-[10px] text-muted">Visible to staff in this workspace only. Never shown on the storefront.</p>
      </div>
      <label className="flex items-start gap-2.5 rounded-md border border-line bg-[#faf6ef] p-3 text-[11px] leading-relaxed">
        <input
          type="checkbox"
          checked={form.marketingConsent}
          onChange={(event) => { setForm({ ...form, marketingConsent: event.target.checked }); setConsentKnown(true); }}
          className="mt-0.5 h-4 w-4 accent-forest"
        />
        <span>Client consents to occasional marketing email. Leave unchanged unless the client has told you.</span>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="dash-btn dash-btn-primary">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save client
        </button>
        {message && <span role="status" className="text-[11px] text-[#2f5c42]">{message}</span>}
        {error && <span role="alert" className="text-[11px] text-[#9c4634]">{error}</span>}
      </div>
    </form>
  );
}
