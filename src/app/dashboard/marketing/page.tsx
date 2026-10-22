import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CircleCheck, Mail, Megaphone, MessageSquareWarning, Sparkles, Users } from "lucide-react";
import { CampaignForm, CampaignSendButton } from "@/components/dashboard/campaign-form";
import { DemoNote, EmptyState, PageHeader, SectionCard, StatCard } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";
import { getPendingApprovals } from "@/lib/ai/engine";
import { getMarketingStats, listCampaigns } from "@/lib/dashboard-data";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const campaignStatusStyles: Record<string, string> = {
  draft: "bg-[#f2f0ec] text-[#6f6a63]",
  queued: "bg-[#e8edf2] text-[#3e586c]",
  sending: "bg-[#e8edf2] text-[#3e586c]",
  sent: "bg-[#e6efe7] text-[#2f5c42]",
  partial: "bg-[#f7ecda] text-[#8e612f]",
  simulated: "bg-[#f7ecda] text-[#8e612f]",
  failed: "bg-[#f6e4df] text-[#8f4332]",
};

const deliveryLabels: Record<string, string> = {
  sent: "Sent",
  simulated: "Simulated",
  failed: "Failed",
  queued: "Queued",
};

export default async function MarketingPage() {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "marketing.manage")) notFound();

  const db = await ensureDb();
  const [stats, campaigns, approvals] = await Promise.all([
    getMarketingStats(db, context.tenant.id),
    listCampaigns(db, context.tenant.id),
    getPendingApprovals(db, context.tenant.id),
  ]);
  const campaignApprovals = approvals.filter((row) => row.approval.action === "send_campaign");
  const simulated = (stats.messages.simulated ?? 0) + (stats.messages.queued ?? 0);

  return (
    <div>
      <PageHeader
        eyebrow="Growth"
        title="Marketing"
        description="Consent-first studio notes. Drafts are saved here; sending is explicit and always shows whether delivery was real or simulated."
        actions={<Link href="/dashboard/assistant" className="dash-btn dash-btn-secondary"><Sparkles className="h-3.5 w-3.5" /> Draft with assistant</Link>}
      />
      <DemoNote>No email provider is configured for this demo. Sends are recorded as simulated, never as delivered, and only clients who explicitly opted in are ever included.</DemoNote>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Clients" value={stats.customers} note="Records in this workspace" href="/dashboard/customers" />
        <StatCard label="Marketing consent" value={stats.consented} note={`${stats.declined} explicitly declined`} />
        <StatCard label="Campaigns" value={campaigns.length} note="Drafts and processed sends" />
        <StatCard label="Simulated messages" value={simulated} note="No external delivery claimed" accent="brass" />
      </div>

      {campaignApprovals.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brass/35 bg-[#f7efdf] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-[#8c5b30]" />
            <div>
              <p className="text-xs font-semibold text-[#6d4c27]">{campaignApprovals.length} campaign draft{campaignApprovals.length === 1 ? "" : "s"} awaiting approval</p>
              <p className="mt-0.5 text-[10px] text-[#77572f]">The assistant prepared {campaignApprovals.length === 1 ? "a send" : "sends"} but did not execute anything.</p>
            </div>
          </div>
          <Link href="/dashboard/assistant" className="dash-btn dash-btn-secondary">Review in assistant <ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <SectionCard title="Campaign history" description="Every recipient status comes from the outbound message log">
            {campaigns.length === 0 ? (
              <EmptyState title="No campaigns yet" description="Draft a note for consented clients, or ask the assistant to prepare one for approval." />
            ) : (
              <div className="divide-y divide-[#efeae1]">
                {campaigns.map(({ campaign, recipients, messages }) => {
                  const counts = messages.reduce<Record<string, number>>((acc, message) => {
                    acc[message.status] = (acc[message.status] ?? 0) + 1;
                    return acc;
                  }, {});
                  return (
                    <div key={campaign.id} className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-ink">{campaign.name}</p>
                            <span className={cn("dash-chip", campaignStatusStyles[campaign.status] ?? "bg-[#f2f0ec] text-[#6f6a63]")}>{campaign.status}</span>
                            {campaign.isDemo && <span className="dash-chip bg-[#f2f0ec] text-[#6f6a63]">Demo</span>}
                          </div>
                          <p className="mt-1 text-[11px] text-muted">{campaign.subject}</p>
                          <p className="mt-1 text-[9px] text-muted">
                            Created {formatDate(campaign.createdAt, context.tenant.timezone, "d MMM yyyy, h:mm a")}
                            {campaign.sentAt ? ` · processed ${formatDate(campaign.sentAt, context.tenant.timezone, "d MMM, h:mm a")}` : ""}
                            {" · "}{recipients.length} recipient{recipients.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {Object.entries(counts).map(([status, value]) => (
                            <span key={status} className={cn("dash-chip", campaignStatusStyles[status] ?? "bg-[#e6efe7] text-[#2f5c42]")}>
                              {value} {deliveryLabels[status] ?? status}
                            </span>
                          ))}
                          {campaign.status === "draft" && (
                            <CampaignSendButton campaignId={campaign.id} recipients={stats.consented} />
                          )}
                        </div>
                      </div>
                      <details className="mt-3 border-t border-line pt-2.5">
                        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Read the note</summary>
                        <p className="mt-2 whitespace-pre-wrap rounded-md border border-line bg-[#faf6ef] p-3 text-[11px] leading-relaxed text-ink/85">{campaign.body}</p>
                      </details>
                      {recipients.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {recipients.slice(0, 8).map((recipient) => (
                            <span key={recipient.id} className="dash-chip bg-[#efe9df] text-[#5d5448]">
                              {recipient.email ?? "No address"} · {deliveryLabels[recipient.status] ?? recipient.status}
                            </span>
                          ))}
                          {recipients.length > 8 && <span className="dash-chip bg-[#efe9df] text-[#5d5448]">+{recipients.length - 8} more</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="New campaign draft" description="Saved as a draft, never auto-sent">
            <div className="p-4 sm:p-5">
              <CampaignForm consented={stats.consented} />
            </div>
          </SectionCard>

          <SectionCard title="Consent & delivery">
            <div className="space-y-3 p-4 text-[11px] leading-relaxed text-muted sm:p-5">
              <div className="flex items-start gap-2.5">
                <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />
                <p><span className="font-medium text-ink">{stats.consented}</span> clients granted marketing consent. <span className="font-medium text-ink">{stats.declined}</span> declined and are excluded.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />
                <p>With no provider key configured, messages are stored as <span className="font-medium text-ink">simulated</span>. The UI never says they were delivered.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />
                <p>Adding <code className="rounded bg-[#efe9df] px-1">RESEND_API_KEY</code> switches configured sends to live, and each message records its true provider status.</p>
              </div>
            </div>
          </SectionCard>

          <div className="overflow-hidden rounded-xl bg-forest p-5 text-ivory">
            <Megaphone className="h-4 w-4 text-brass" />
            <p className="mt-2 font-display text-2xl leading-snug">Warmth, not volume.</p>
            <p className="mt-2 text-[11px] leading-relaxed text-ivory/65">The assistant&apos;s campaign copy is grounded in genuine open slots and sent only to consented clients after a human approves the exact payload.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
