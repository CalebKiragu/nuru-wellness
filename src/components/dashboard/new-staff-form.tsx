"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";

export function NewStaffForm({ services }: { services: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", title: "Therapist", bio: "", email: "", color: "#24483D" });
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, email: form.email || null, serviceIds, isActive: true }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not add the team member.");
      setForm({ name: "", title: "Therapist", bio: "", email: "", color: "#24483D" });
      setServiceIds([]);
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the team member.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="dash-btn dash-btn-secondary">
        <UserPlus className="h-3.5 w-3.5" /> Add team member
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="dash-card space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="dash-label">Name</label>
          <input className="dash-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </div>
        <div>
          <label className="dash-label">Title</label>
          <input className="dash-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        </div>
        <div>
          <label className="dash-label">Email</label>
          <input type="email" className="dash-input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </div>
        <div>
          <label className="dash-label">Colour</label>
          <input type="color" className="dash-input h-[2.65rem] p-1" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
        </div>
      </div>
      <div>
        <label className="dash-label">Short bio</label>
        <textarea rows={2} className="dash-input resize-none" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
      </div>
      <div>
        <p className="dash-label">Treatments</p>
        <div className="flex flex-wrap gap-2">
          {services.map((service) => (
            <label key={service.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px]">
              <input
                type="checkbox"
                checked={serviceIds.includes(service.id)}
                onChange={(event) => setServiceIds((current) => event.target.checked ? [...current, service.id] : current.filter((id) => id !== service.id))}
                className="h-3.5 w-3.5 accent-forest"
              />
              {service.name}
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy} className="dash-btn dash-btn-primary">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Add member
        </button>
        <button type="button" onClick={() => setOpen(false)} className="dash-btn dash-btn-ghost">Cancel</button>
        {error && <span role="alert" className="text-[11px] text-[#9c4634]">{error}</span>}
      </div>
    </form>
  );
}
