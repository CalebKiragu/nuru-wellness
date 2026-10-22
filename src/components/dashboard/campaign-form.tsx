"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Send } from "lucide-react";

export function CampaignForm({ consented }: { consented: number }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", subject: "", body: "Hello {{first_name}},\n\n" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/dashboard/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, channel: "email" }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not save the campaign.");
      setMessage("Draft saved. Review it below before sending.");
      setForm({ name: "", subject: "", body: "Hello {{first_name}},\n\n" });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the campaign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="rounded-md border border-brass/30 bg-[#f7efdf] px-3 py-2 text-[10px] leading-relaxed text-[#77572f]">
        <Mail className="mr-1.5 inline h-3 w-3" />
        {consented} client{consented === 1 ? "" : "s"} have explicitly consented to marketing. Only consented clients are ever included. In demo mode, sends are simulated and never claim delivery.
      </div>
      <div>
        <label className="dash-label">Campaign name</label>
        <input className="dash-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="A slower Sunday" required />
      </div>
      <div>
        <label className="dash-label">Subject</label>
        <input className="dash-input" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="A quiet hour, just for you" required />
      </div>
      <div>
        <label className="dash-label">Body</label>
        <textarea rows={7} className="dash-input resize-y" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required />
        <p className="mt-1 text-[10px] text-muted">Use {"{{first_name}}"} for the client&apos;s first name.</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="dash-btn dash-btn-primary">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Save draft
        </button>
        {message && <span role="status" className="text-[11px] text-[#2f5c42]">{message}</span>}
        {error && <span role="alert" className="text-[11px] text-[#9c4634]">{error}</span>}
      </div>
    </form>
  );
}

export function CampaignSendButton({ campaignId, recipients }: { campaignId: string; recipients: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function send() {
    if (!window.confirm(`Process this campaign for ${recipients} consented client${recipients === 1 ? "" : "s"}? In demo mode messages are simulated, not delivered.`)) return;
    setBusy(true);
    setResult("");
    setError("");
    try {
      const response = await fetch(`/api/dashboard/marketing/campaigns/${campaignId}/send`, { method: "POST" });
      const json = (await response.json()) as { error?: string; recipients?: number; sent?: number; simulated?: number; note?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not process the campaign.");
      setResult(json.note ?? `${json.simulated ?? 0} messages simulated.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not process the campaign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={send} disabled={busy} className="dash-btn dash-btn-secondary">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Process send
      </button>
      {result && <p role="status" className="mt-1.5 max-w-sm text-[10px] leading-relaxed text-[#77572f]">{result}</p>}
      {error && <p role="alert" className="mt-1.5 text-[10px] text-[#9c4634]">{error}</p>}
    </div>
  );
}
