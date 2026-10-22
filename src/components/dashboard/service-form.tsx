"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { Service } from "@/db/schema";

type ServiceInput = Pick<
  Service,
  | "id"
  | "name"
  | "shortDescription"
  | "description"
  | "durationMinutes"
  | "bufferBeforeMinutes"
  | "bufferAfterMinutes"
  | "priceCents"
  | "category"
  | "imageUrl"
  | "isActive"
  | "sortOrder"
>;

export function ServiceForm({ service }: { service?: ServiceInput }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: service?.name ?? "",
    shortDescription: service?.shortDescription ?? "",
    description: service?.description ?? "",
    durationMinutes: service?.durationMinutes ?? 60,
    bufferBeforeMinutes: service?.bufferBeforeMinutes ?? 10,
    bufferAfterMinutes: service?.bufferAfterMinutes ?? 10,
    price: service ? service.priceCents / 100 : 5000,
    category: service?.category ?? "Massage",
    imageUrl: service?.imageUrl ?? "",
    isActive: service?.isActive ?? true,
    sortOrder: service?.sortOrder ?? 0,
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
      const payload = {
        name: form.name,
        shortDescription: form.shortDescription,
        description: form.description,
        durationMinutes: Number(form.durationMinutes),
        bufferBeforeMinutes: Number(form.bufferBeforeMinutes),
        bufferAfterMinutes: Number(form.bufferAfterMinutes),
        priceCents: Math.round(Number(form.price) * 100),
        category: form.category,
        imageUrl: form.imageUrl || null,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder),
      };
      const response = await fetch(service ? `/api/dashboard/services/${service.id}` : "/api/dashboard/services", {
        method: service ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as { error?: string; service?: { id: string } };
      if (!response.ok) throw new Error(json.error ?? "Could not save the treatment.");
      setMessage(service ? "Treatment saved." : "Treatment created. You can now add it to a therapist's services.");
      if (!service && json.service) {
        router.push(`/dashboard/services/${json.service.id}`);
      } else {
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the treatment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="dash-label" htmlFor={`name-${service?.id ?? "new"}`}>Treatment name</label>
          <input id={`name-${service?.id ?? "new"}`} className="dash-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </div>
        <div>
          <label className="dash-label">Category</label>
          <input className="dash-input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
        </div>
        <div>
          <label className="dash-label">Price (KES)</label>
          <input type="number" min={0} step={50} className="dash-input" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} required />
        </div>
        <div>
          <label className="dash-label">Duration (minutes)</label>
          <input type="number" min={5} step={5} className="dash-input" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} required />
        </div>
        <div>
          <label className="dash-label">Sort order</label>
          <input type="number" min={0} className="dash-input" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} />
        </div>
        <div>
          <label className="dash-label">Buffer before</label>
          <input type="number" min={0} step={5} className="dash-input" value={form.bufferBeforeMinutes} onChange={(event) => setForm({ ...form, bufferBeforeMinutes: Number(event.target.value) })} />
        </div>
        <div>
          <label className="dash-label">Buffer after</label>
          <input type="number" min={0} step={5} className="dash-input" value={form.bufferAfterMinutes} onChange={(event) => setForm({ ...form, bufferAfterMinutes: Number(event.target.value) })} />
        </div>
      </div>

      <div>
        <label className="dash-label">Short description</label>
        <input className="dash-input" value={form.shortDescription} onChange={(event) => setForm({ ...form, shortDescription: event.target.value })} maxLength={200} required />
      </div>
      <div>
        <label className="dash-label">Full description</label>
        <textarea rows={5} className="dash-input resize-y" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
      </div>
      <div>
        <label className="dash-label">Image URL</label>
        <input className="dash-input" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="/media/amani/hero.jpg" />
        <p className="mt-1 text-[10px] text-muted">Use a path from the media library or a hosted image URL.</p>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="h-4 w-4 accent-forest" />
        Visible on the storefront and bookable
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="dash-btn dash-btn-primary">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {service ? "Save treatment" : "Create treatment"}
        </button>
        {message && <span role="status" className="text-[11px] text-[#2f5c42]">{message}</span>}
        {error && <span role="alert" className="text-[11px] text-[#9c4634]">{error}</span>}
      </div>
    </form>
  );
}

export function AddonForm({ serviceId, addons }: { serviceId: string; addons: { id: string; name: string; priceCents: number; durationMinutes: number }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState(800);
  const [duration, setDuration] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/dashboard/services/${serviceId}/addons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: "", priceCents: Math.round(price * 100), durationMinutes: Number(duration) }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not add the add-on.");
      setName("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the add-on.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/dashboard/services/${serviceId}/addons?addonId=${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {addons.length > 0 ? (
        <ul className="divide-y divide-line">
          {addons.map((addon) => (
            <li key={addon.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-xs font-medium">{addon.name}</p>
                <p className="text-[10px] text-muted">KES {(addon.priceCents / 100).toLocaleString()} · +{addon.durationMinutes} min</p>
              </div>
              <button type="button" onClick={() => remove(addon.id)} disabled={busy} className="p-1.5 text-muted hover:text-[#9c4634]" aria-label={`Remove ${addon.name}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted">No add-ons yet.</p>
      )}
      <form onSubmit={add} className="mt-3 grid gap-2 sm:grid-cols-[1fr_6rem_6rem_auto]">
        <input className="dash-input" placeholder="Add-on name" value={name} onChange={(event) => setName(event.target.value)} required />
        <input type="number" className="dash-input" placeholder="KES" value={price} onChange={(event) => setPrice(Number(event.target.value))} min={0} />
        <input type="number" className="dash-input" placeholder="Minutes" value={duration} onChange={(event) => setDuration(Number(event.target.value))} min={0} step={5} />
        <button type="submit" disabled={busy || !name} className="dash-btn dash-btn-secondary"><Plus className="h-3.5 w-3.5" /> Add</button>
      </form>
      {error && <p role="alert" className="mt-2 text-[11px] text-[#9c4634]">{error}</p>}
    </div>
  );
}
