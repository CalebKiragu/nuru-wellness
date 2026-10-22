import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Eye, Layers, Rocket } from "lucide-react";
import { StorefrontEditor } from "@/components/dashboard/storefront-editor";
import { DemoNote, PageHeader } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";
import { getStorefrontConfigRow } from "@/lib/dashboard-data";
import { listVersions } from "@/lib/storefront-service";
import type { StorefrontConfig } from "@/lib/storefront";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StorefrontPage() {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "storefront.edit")) notFound();

  const db = await ensureDb();
  const [row, versions] = await Promise.all([
    getStorefrontConfigRow(db, context.tenant.id),
    listVersions(db, context.tenant.id, 12),
  ]);
  if (!row) notFound();

  const draft = row.draft as unknown as StorefrontConfig;
  const published = row.published as unknown as StorefrontConfig | null;
  const draftChanged = JSON.stringify(row.draft) !== JSON.stringify(row.published ?? {});
  const latest = versions[0];

  return (
    <div>
      <PageHeader
        eyebrow="Growth"
        title="Storefront"
        description="Shape how the studio presents itself, preview the draft, and publish when it feels right. Every publication is kept for rollback."
        actions={
          <>
            <Link href="/preview/storefront" target="_blank" className="dash-btn dash-btn-secondary">
              <Eye className="h-3.5 w-3.5" /> Preview draft
            </Link>
            {published && (
              <form action="/api/demo/switch" method="post" target="_blank">
                <input type="hidden" name="tenant" value={context.tenant.slug} />
                <input type="hidden" name="next" value="/" />
                <button type="submit" className="dash-btn dash-btn-primary">
                  <ExternalLink className="h-3.5 w-3.5" /> View live site
                </button>
              </form>
            )}
          </>
        }
      />

      <DemoNote>The storefront is a real published record in this demo. Publishing creates a version snapshot; rollback restores old content as a new version rather than erasing history.</DemoNote>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="dash-card p-4">
          <p className="dash-label">Live version</p>
          <p className="mt-1 font-display text-3xl text-forest">{published?.version ? `v${published.version}` : "—"}</p>
        </div>
        <div className="dash-card p-4">
          <p className="dash-label">Draft state</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span className={`h-1.5 w-1.5 rounded-full ${draftChanged ? "bg-brass" : "bg-[#3f7a56]"}`} />
            {draftChanged ? "Changes waiting" : "In sync"}
          </p>
          <p className="mt-1 text-[10px] text-muted">{draftChanged ? "Publish to make them live" : "Draft matches the live site"}</p>
        </div>
        <div className="dash-card p-4">
          <p className="dash-label">Sections</p>
          <p className="mt-1 font-display text-3xl text-forest">{draft.sections.filter((section) => section.visible).length}</p>
          <p className="mt-1 text-[10px] text-muted">Visible on the page</p>
        </div>
        <div className="dash-card p-4">
          <p className="dash-label">Last published</p>
          <p className="mt-1 text-sm font-semibold text-ink">{latest ? formatDate(latest.createdAt, context.tenant.timezone, "d MMM yyyy") : "Never"}</p>
          <p className="mt-1 text-[10px] text-muted">{latest?.note ?? "Publish your first version"}</p>
        </div>
      </div>

      <StorefrontEditor
        initialConfig={draft}
        versions={versions.map((version) => ({ id: version.id, version: version.version, note: version.note, createdAt: version.createdAt }))}
        draftChanged={draftChanged}
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="dash-card flex items-start gap-3 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#efe9df] text-forest"><Layers className="h-4 w-4" /></span>
          <div><p className="text-xs font-semibold">Draft is private</p><p className="mt-1 text-[11px] leading-relaxed text-muted">Only signed-in team members can preview the draft. Clients always see the latest published version.</p></div>
        </div>
        <div className="dash-card flex items-start gap-3 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#efe9df] text-forest"><Rocket className="h-4 w-4" /></span>
          <div><p className="text-xs font-semibold">Publishing is deliberate</p><p className="mt-1 text-[11px] leading-relaxed text-muted">Publishing saves the draft first, then snapshots it. Your previous live version stays available below.</p></div>
        </div>
        <div className="dash-card flex items-start gap-3 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#efe9df] text-forest"><Eye className="h-4 w-4" /></span>
          <div><p className="text-xs font-semibold">Honest copy matters</p><p className="mt-1 text-[11px] leading-relaxed text-muted">The assistant only edits these copy fields. It cannot invent services, prices, reviews or availability.</p></div>
        </div>
      </div>
    </div>
  );
}
