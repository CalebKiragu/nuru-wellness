"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  Loader2,
  Monitor,
  Plus,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Trash2,
} from "lucide-react";
import { themePresets, type StorefrontConfig, type StorefrontTheme } from "@/lib/storefront";
import { cn } from "@/lib/cn";

type Version = { id: string; version: number; note: string | null; createdAt: string | Date };

const tabLabels = [
  ["design", "Design"],
  ["content", "Content"],
  ["sections", "Sections"],
  ["publish", "Preview & publish"],
] as const;

type Tab = (typeof tabLabels)[number][0];

function Field({
  label,
  value,
  onChange,
  hint,
  multiline,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="dash-label">{label}</span>
      {multiline ? (
        <textarea rows={rows} className="dash-input resize-y" value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className="dash-input" value={value} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint && <span className="mt-1 block text-[10px] leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

function Group({ title, children, description }: { title: string; children: React.ReactNode; description?: string }) {
  return (
    <details className="group border-b border-line py-3 last:border-b-0" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-ink">
        <span>{title}</span>
        <span className="text-[9px] font-normal uppercase tracking-[0.08em] text-muted group-open:hidden">Open</span>
      </summary>
      {description && <p className="mt-1 text-[10px] text-muted">{description}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

export function StorefrontEditor({
  initialConfig,
  versions,
  draftChanged,
}: {
  initialConfig: StorefrontConfig;
  versions: Version[];
  draftChanged: boolean;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<StorefrontConfig>(() => structuredClone(initialConfig));
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialConfig));
  const [tab, setTab] = useState<Tab>("design");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const dirty = useMemo(() => JSON.stringify(config) !== baseline, [config, baseline]);

  function setContent<K extends keyof StorefrontConfig["content"]>(key: K, value: StorefrontConfig["content"][K]) {
    setConfig((current) => ({ ...current, content: { ...current.content, [key]: value } }));
  }

  function setTheme(patch: Partial<StorefrontTheme>) {
    setConfig((current) => ({ ...current, theme: { ...current.theme, ...patch } }));
  }

  async function save(silent = false) {
    setBusy("save");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/dashboard/storefront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not save the draft.");
      setBaseline(JSON.stringify(config));
      setPreviewKey((value) => value + 1);
      if (!silent) setMessage("Draft saved. The live storefront is unchanged until you publish.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the draft.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!window.confirm("Publish this draft to the live storefront? The current published version is kept for rollback.")) return;
    setBusy("publish");
    setMessage("");
    setError("");
    try {
      const saved = await save(true);
      if (!saved) return;
      const response = await fetch("/api/dashboard/storefront/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "Published from the storefront editor" }),
      });
      const json = (await response.json()) as { error?: string; version?: number };
      if (!response.ok) throw new Error(json.error ?? "Could not publish the storefront.");
      setMessage(`Published as version ${json.version}. The previous version remains available for rollback.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish the storefront.");
    } finally {
      setBusy(null);
    }
  }

  async function rollback(versionId: string, version: number) {
    if (!window.confirm(`Restore version ${version} to the live storefront? The current draft and published content will be replaced.`)) return;
    setBusy(versionId);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/dashboard/storefront/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const json = (await response.json()) as { error?: string; newVersion?: number };
      if (!response.ok) throw new Error(json.error ?? "Could not roll back.");
      setMessage(`Restored version ${version} as a new publication (version ${json.newVersion}).`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not roll back.");
    } finally {
      setBusy(null);
    }
  }

  function moveSection(index: number, direction: -1 | 1) {
    const next = [...config.sections].sort((a, b) => a.sortOrder - b.sortOrder);
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setConfig((current) => ({ ...current, sections: next.map((section, order) => ({ ...section, sortOrder: order })) }));
  }

  function toggleSection(index: number) {
    setConfig((current) => {
      const next = [...current.sections];
      next[index] = { ...next[index], visible: !next[index].visible };
      return { ...current, sections: next };
    });
  }

  const sortedSections = [...config.sections].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_1fr]">
      <div className="dash-card flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-ink">Storefront editor</p>
            <p className="text-[10px] text-muted">
              {dirty ? "Unsaved changes" : draftChanged ? "Draft differs from live" : "Draft matches the live storefront"}
            </p>
          </div>
          <span className={cn("dash-chip", dirty ? "bg-[#f7ecda] text-[#8e612f]" : "bg-[#e6efe7] text-[#2f5c42]")}>
            {dirty ? "Draft" : "Saved"}
          </span>
        </div>

        <div className="flex gap-1 border-b border-line px-2 py-2">
          {tabLabels.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold",
                tab === id ? "bg-forest text-ivory" : "text-muted hover:bg-[#efe9df]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="max-h-[62vh] flex-1 overflow-y-auto px-4 py-2">
          {tab === "design" && (
            <div>
              <Group title="Theme preset" description="Presets set a coherent starting point. You can adjust individual tokens below.">
                <div className="space-y-2">
                  {themePresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setTheme(structuredClone(preset.theme))}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-colors",
                        config.theme.preset === preset.id ? "border-forest bg-[#eef2eb]" : "border-line hover:border-forest/30",
                      )}
                    >
                      <span className="mt-0.5 flex gap-0.5">
                        {[preset.theme.colors.brand, preset.theme.colors.accent, preset.theme.colors.canvas].map((color) => (
                          <span key={color} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: color }} />
                        ))}
                      </span>
                      <span>
                        <span className="block text-[11px] font-semibold">{preset.name}</span>
                        <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">{preset.description}</span>
                      </span>
                      {config.theme.preset === preset.id && <Check className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />}
                    </button>
                  ))}
                </div>
              </Group>

              <Group title="Colour tokens">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["brand", "Brand"],
                      ["brandDeep", "Brand deep"],
                      ["accent", "Accent"],
                      ["canvas", "Canvas"],
                      ["surface", "Surface"],
                      ["ink", "Ink"],
                      ["muted", "Muted"],
                      ["border", "Border"],
                      ["soft", "Soft"],
                      ["onBrand", "On brand"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-[10px]">
                      <input
                        type="color"
                        className="h-7 w-8 rounded border border-line bg-paper p-0.5"
                        value={config.theme.colors[key]}
                        onChange={(event) => setTheme({ colors: { ...config.theme.colors, [key]: event.target.value } })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </Group>

              <Group title="Typography & shape">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["displayFont", "Display font", [["editorial", "Editorial"], ["modern", "Modern"], ["classic", "Classic"]]],
                      ["radius", "Corners", [["none", "None"], ["soft", "Soft"], ["rounded", "Rounded"]]],
                      ["buttonStyle", "Buttons", [["solid", "Solid"], ["outline", "Outline"], ["pill", "Pill"]]],
                      ["cardStyle", "Cards", [["flat", "Flat"], ["elevated", "Elevated"], ["outline", "Outline"]]],
                      ["width", "Page width", [["narrow", "Narrow"], ["standard", "Standard"], ["wide", "Wide"]]],
                      ["spacing", "Spacing", [["compact", "Compact"], ["balanced", "Balanced"], ["airy", "Airy"]]],
                    ] as const
                  ).map(([key, label, options]) => (
                    <label key={key} className="block">
                      <span className="dash-label">{label}</span>
                      <select
                        className="dash-input min-h-9 py-1 text-xs"
                        value={config.theme[key] as string}
                        onChange={(event) => setTheme({ [key]: event.target.value } as Partial<StorefrontTheme>)}
                      >
                        {options.map(([value, optionLabel]) => (
                          <option key={value} value={value}>{optionLabel}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </Group>
            </div>
          )}

          {tab === "content" && (
            <div>
              <Group title="Hero">
                <Field label="Business name" value={config.content.businessName} onChange={(value) => setContent("businessName", value)} />
                <Field label="Tagline" value={config.content.tagline} onChange={(value) => setContent("tagline", value)} />
                <Field label="Eyebrow" value={config.content.heroEyebrow} onChange={(value) => setContent("heroEyebrow", value)} />
                <Field label="Headline" value={config.content.heroTitle} onChange={(value) => setContent("heroTitle", value)} multiline rows={2} />
                <Field label="Introduction" value={config.content.heroText} onChange={(value) => setContent("heroText", value)} multiline rows={4} />
                <Field label="Primary button" value={config.content.primaryCta} onChange={(value) => setContent("primaryCta", value)} />
                <Field label="Secondary button" value={config.content.secondaryCta} onChange={(value) => setContent("secondaryCta", value)} />
                <Field label="Hero image URL" value={config.content.heroImage} onChange={(value) => setContent("heroImage", value)} />
                <Field label="Hero image alt text" value={config.content.heroImageAlt} onChange={(value) => setContent("heroImageAlt", value)} />
              </Group>

              <Group title="Services introduction">
                <Field label="Eyebrow" value={config.content.servicesEyebrow} onChange={(value) => setContent("servicesEyebrow", value)} />
                <Field label="Title" value={config.content.servicesTitle} onChange={(value) => setContent("servicesTitle", value)} />
                <Field label="Text" value={config.content.servicesText} onChange={(value) => setContent("servicesText", value)} multiline rows={3} />
              </Group>

              <Group title="About">
                <Field label="Title" value={config.content.aboutTitle} onChange={(value) => setContent("aboutTitle", value)} />
                <Field label="Text" value={config.content.aboutText} onChange={(value) => setContent("aboutText", value)} multiline rows={5} />
                <Field label="Image URL" value={config.content.aboutImage} onChange={(value) => setContent("aboutImage", value)} />
                <Field label="Image alt text" value={config.content.aboutImageAlt} onChange={(value) => setContent("aboutImageAlt", value)} />
                <Field
                  label="Highlights (one per line)"
                  value={config.content.aboutHighlights.join("\n")}
                  onChange={(value) => setContent("aboutHighlights", value.split("\n").map((line) => line.trim()).filter(Boolean))}
                  multiline
                  rows={4}
                />
              </Group>

              <Group title="Team & gallery">
                <Field label="Team title" value={config.content.teamTitle} onChange={(value) => setContent("teamTitle", value)} />
                <Field label="Team text" value={config.content.teamText} onChange={(value) => setContent("teamText", value)} multiline rows={3} />
                <Field label="Gallery title" value={config.content.galleryTitle} onChange={(value) => setContent("galleryTitle", value)} />
                <Field label="Gallery text" value={config.content.galleryText} onChange={(value) => setContent("galleryText", value)} multiline rows={2} />
                <div className="space-y-2">
                  <p className="dash-label">Gallery images</p>
                  {config.content.galleryImages.map((image, index) => (
                    <div key={index} className="rounded-md border border-line p-2">
                      <div className="flex gap-2">
                        <input
                          className="dash-input text-xs"
                          value={image.url}
                          placeholder="Image URL"
                          onChange={(event) => {
                            const next = [...config.content.galleryImages];
                            next[index] = { ...image, url: event.target.value };
                            setContent("galleryImages", next);
                          }}
                        />
                        <button
                          type="button"
                          className="p-1.5 text-muted hover:text-[#9c4634]"
                          onClick={() => setContent("galleryImages", config.content.galleryImages.filter((_, position) => position !== index))}
                          aria-label="Remove image"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        className="dash-input mt-1 text-xs"
                        value={image.alt}
                        placeholder="Alt text"
                        onChange={(event) => {
                          const next = [...config.content.galleryImages];
                          next[index] = { ...image, alt: event.target.value };
                          setContent("galleryImages", next);
                        }}
                      />
                    </div>
                  ))}
                  {config.content.galleryImages.length < 8 && (
                    <button
                      type="button"
                      className="dash-btn dash-btn-ghost"
                      onClick={() => setContent("galleryImages", [...config.content.galleryImages, { url: config.content.heroImage, alt: "" }])}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add image
                    </button>
                  )}
                </div>
              </Group>

              <Group title="Testimonials">
                <Field label="Title" value={config.content.testimonialsTitle} onChange={(value) => setContent("testimonialsTitle", value)} />
                <Field label="Disclaimer" value={config.content.testimonialsText} onChange={(value) => setContent("testimonialsText", value)} multiline rows={2} />
                {config.content.testimonials.map((testimonial, index) => (
                  <div key={index} className="space-y-1.5 rounded-md border border-line p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Testimonial {index + 1}</p>
                      <button
                        type="button"
                        className="p-1 text-muted hover:text-[#9c4634]"
                        onClick={() => setContent("testimonials", config.content.testimonials.filter((_, position) => position !== index))}
                        aria-label="Remove testimonial"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      className="dash-input text-xs"
                      value={testimonial.quote}
                      onChange={(event) => {
                        const next = [...config.content.testimonials];
                        next[index] = { ...testimonial, quote: event.target.value };
                        setContent("testimonials", next);
                      }}
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        className="dash-input text-xs"
                        value={testimonial.author}
                        placeholder="Author"
                        onChange={(event) => {
                          const next = [...config.content.testimonials];
                          next[index] = { ...testimonial, author: event.target.value };
                          setContent("testimonials", next);
                        }}
                      />
                      <input
                        className="dash-input text-xs"
                        value={testimonial.service}
                        placeholder="Service"
                        onChange={(event) => {
                          const next = [...config.content.testimonials];
                          next[index] = { ...testimonial, service: event.target.value };
                          setContent("testimonials", next);
                        }}
                      />
                    </div>
                  </div>
                ))}
                {config.content.testimonials.length < 6 && (
                  <button
                    type="button"
                    className="dash-btn dash-btn-ghost"
                    onClick={() => setContent("testimonials", [...config.content.testimonials, { quote: "", author: "", service: "" }])}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add testimonial
                  </button>
                )}
              </Group>

              <Group title="Location & contact">
                <Field label="Title" value={config.content.locationTitle} onChange={(value) => setContent("locationTitle", value)} />
                <Field label="Text" value={config.content.locationText} onChange={(value) => setContent("locationText", value)} multiline rows={3} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Address" value={config.content.address} onChange={(value) => setContent("address", value)} />
                  <Field label="City" value={config.content.city} onChange={(value) => setContent("city", value)} />
                  <Field label="Phone" value={config.content.phone} onChange={(value) => setContent("phone", value)} />
                  <Field label="Email" value={config.content.email} onChange={(value) => setContent("email", value)} />
                </div>
                <Field
                  label="Opening hours (one per line: Day | Hours)"
                  value={config.content.hours.map((entry) => `${entry.day} | ${entry.hours}`).join("\n")}
                  onChange={(value) =>
                    setContent(
                      "hours",
                      value
                        .split("\n")
                        .map((line) => {
                          const [day, ...rest] = line.split("|");
                          return { day: day.trim(), hours: rest.join("|").trim() };
                        })
                        .filter((entry) => entry.day),
                    )
                  }
                  multiline
                  rows={5}
                />
                <Field label="Instagram handle" value={config.content.instagram ?? ""} onChange={(value) => setContent("instagram", value)} />
                <Field label="Instagram URL" value={config.content.instagramUrl ?? ""} onChange={(value) => setContent("instagramUrl", value)} />
              </Group>

              <Group title="Policies & SEO">
                <Field label="Footer note" value={config.content.footerNote} onChange={(value) => setContent("footerNote", value)} multiline rows={2} />
                <Field label="Cancellation policy" value={config.content.cancellationPolicy} onChange={(value) => setContent("cancellationPolicy", value)} multiline rows={3} />
                <Field label="Deposit policy" value={config.content.depositPolicy} onChange={(value) => setContent("depositPolicy", value)} multiline rows={3} />
                <Field label="Arrival policy" value={config.content.arrivalPolicy} onChange={(value) => setContent("arrivalPolicy", value)} multiline rows={3} />
                <Field label="SEO title" value={config.content.seoTitle} onChange={(value) => setContent("seoTitle", value)} />
                <Field label="SEO description" value={config.content.seoDescription} onChange={(value) => setContent("seoDescription", value)} multiline rows={2} />
              </Group>
            </div>
          )}

          {tab === "sections" && (
            <div>
              <p className="mb-3 text-[11px] leading-relaxed text-muted">
                Reorder or hide sections. The hero is always shown first when visible. Changes apply to the draft, then to the live site when published.
              </p>
              <div className="space-y-2">
                {sortedSections.map((section, index) => (
                  <div key={section.key} className="flex items-center gap-2 rounded-lg border border-line bg-paper p-2">
                    <label className="flex flex-1 items-center gap-2 text-[11px]">
                      <input type="checkbox" checked={section.visible} onChange={() => toggleSection(index)} className="h-3.5 w-3.5 accent-forest" />
                      <span>{section.label}</span>
                    </label>
                    <button type="button" onClick={() => moveSection(index, -1)} disabled={index === 0} className="p-1 text-muted disabled:opacity-30" aria-label={`Move ${section.label} up`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => moveSection(index, 1)} disabled={index === sortedSections.length - 1} className="p-1 text-muted disabled:opacity-30" aria-label={`Move ${section.label} down`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "publish" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-brass/30 bg-[#f7efdf] p-3 text-[11px] leading-relaxed text-[#77572f]">
                Preview uses the saved draft. Save first to see your latest edits in the frame, then publish when you are happy.
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => save(false)} disabled={busy === "save"} className="dash-btn dash-btn-secondary">
                  {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save draft
                </button>
                <button type="button" onClick={() => setPreviewKey((value) => value + 1)} className="dash-btn dash-btn-secondary">
                  <Eye className="h-3.5 w-3.5" /> Refresh preview
                </button>
                <button type="button" onClick={publish} disabled={busy === "publish"} className="dash-btn dash-btn-primary">
                  {busy === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Publish live
                </button>
              </div>
              <div>
                <h3 className="text-xs font-semibold">Published versions</h3>
                <p className="mt-0.5 text-[10px] text-muted">Restoring creates a new publication; history is never erased.</p>
                <ul className="mt-2 divide-y divide-line">
                  {versions.map((version) => (
                    <li key={version.id} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <p className="text-[11px] font-medium">Version {version.version}</p>
                        <p className="text-[10px] text-muted">
                          {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(version.createdAt))}
                          {version.note ? ` · ${version.note}` : ""}
                        </p>
                      </div>
                      <button type="button" onClick={() => rollback(version.id, version.version)} disabled={Boolean(busy)} className="dash-btn dash-btn-ghost">
                        {busy === version.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line bg-[#fbf7f0] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => save(false)} disabled={busy === "save"} className="dash-btn dash-btn-primary">
              {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save draft
            </button>
            <button type="button" onClick={publish} disabled={busy === "publish"} className="dash-btn dash-btn-secondary">
              Publish
            </button>
            {dirty && <span className="text-[10px] text-[#8e612f]">Unsaved changes</span>}
          </div>
          {message && <p role="status" className="mt-2 text-[10px] leading-relaxed text-[#2f5c42]">{message}</p>}
          {error && <p role="alert" className="mt-2 text-[10px] leading-relaxed text-[#9c4634]">{error}</p>}
        </div>
      </div>

      <div className="dash-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setDevice("desktop")} className={cn("rounded-md p-1.5", device === "desktop" ? "bg-forest text-ivory" : "text-muted hover:bg-[#efe9df]")} aria-label="Desktop preview">
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setDevice("mobile")} className={cn("rounded-md p-1.5", device === "mobile" ? "bg-forest text-ivory" : "text-muted hover:bg-[#efe9df]")} aria-label="Mobile preview">
              <Smartphone className="h-3.5 w-3.5" />
            </button>
            <span className="ml-2 text-[10px] uppercase tracking-[0.1em] text-muted">Draft preview</span>
          </div>
          <a href="/preview/storefront" target="_blank" rel="noreferrer" className="text-[10px] font-semibold uppercase tracking-[0.08em] text-forest hover:underline">
            Open in new tab
          </a>
        </div>
        <div className="flex justify-center overflow-hidden bg-[#e9e3d9] p-3">
          <div className={cn("overflow-hidden bg-white shadow-lg transition-[width] duration-300", device === "mobile" ? "w-[390px] max-w-full" : "w-full")}>
            <iframe
              key={previewKey}
              src={`/preview/storefront?v=${previewKey}`}
              title="Draft storefront preview"
              className="h-[72vh] w-full border-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
