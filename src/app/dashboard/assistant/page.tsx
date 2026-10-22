import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Cpu,
  Mail,
  ShieldCheck,
  Sparkles,
  Store,
  Wrench,
} from "lucide-react";
import { ApprovalDecision } from "@/components/dashboard/approval-decision";
import { AssistantRunForm } from "@/components/dashboard/assistant-run-form";
import { DemoNote, PageHeader, SectionCard } from "@/components/dashboard/ui";
import { ensureDb } from "@/db";
import type { AgentRun, AgentStep, ApprovalRequest } from "@/db/schema";
import { can } from "@/lib/auth/permissions";
import { getDashboardContext } from "@/lib/auth/session";
import { getPendingApprovals } from "@/lib/ai/engine";
import { getProvider } from "@/lib/ai/providers";
import { listAgentRuns } from "@/lib/dashboard-data";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const statusStyles: Record<AgentRun["status"], string> = {
  queued: "bg-[#f2f0ec] text-[#6f6a63]",
  running: "bg-[#e8edf2] text-[#3e586c]",
  awaiting_approval: "bg-[#f7ecda] text-[#8e612f]",
  completed: "bg-[#e6efe7] text-[#2f5c42]",
  failed: "bg-[#f6e4df] text-[#8f4332]",
  cancelled: "bg-[#f2f0ec] text-[#6f6a63]",
};

const statusLabels: Record<AgentRun["status"], string> = {
  queued: "Queued",
  running: "Running",
  awaiting_approval: "Awaiting approval",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const taskLabels: Record<string, string> = {
  business_question: "Business question",
  schedule_review: "Schedule review",
  marketing_campaign: "Marketing campaign",
  storefront_copy: "Storefront copy",
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function approvalTitle(approval: ApprovalRequest) {
  if (approval.action === "send_campaign") return "Send marketing campaign";
  if (approval.action === "apply_storefront_copy") return "Apply storefront copy";
  return approval.action.replaceAll("_", " ");
}

function ArtifactPreview({ action, payload }: { action: string; payload: Record<string, unknown> }) {
  if (action === "send_campaign") {
    const audience = payload.audience as { count?: number; segment?: string } | undefined;
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-line bg-[#faf6ef] p-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Subject</p>
          <p className="mt-1 text-xs font-medium text-ink">{text(payload.subject)}</p>
          <p className="mt-3 whitespace-pre-wrap text-[11px] leading-relaxed text-ink/85">{text(payload.body)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="dash-chip bg-[#e6efe7] text-[#2f5c42]">To {audience?.count ?? 0} consented client{(audience?.count ?? 0) === 1 ? "" : "s"}</span>
          <span className="dash-chip bg-[#efe9df] text-[#5d5448]">{text(payload.channel) || "email"}</span>
          {text(payload.rationale) && <span className="dash-chip bg-[#f7ecda] text-[#8e612f]">Why: {text(payload.rationale)}</span>}
        </div>
        <p className="text-[10px] leading-relaxed text-muted">
          Only clients with explicit marketing consent and an email address receive this. In demo mode every send is simulated and clearly recorded as simulated.
        </p>
      </div>
    );
  }

  if (action === "apply_storefront_copy") {
    const changes = payload.changes as Record<string, unknown> | undefined;
    return (
      <div className="space-y-2">
        {Object.entries(changes ?? {}).map(([key, value]) => (
          <div key={key} className="rounded-md border border-line bg-[#faf6ef] p-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">{key.replace(/([A-Z])/g, " $1").trim()}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink/85">{text(value)}</p>
          </div>
        ))}
        <p className="text-[10px] leading-relaxed text-muted">Approving applies these changes to the private draft only. You still choose when to publish.</p>
      </div>
    );
  }

  return <pre className="overflow-x-auto rounded-md bg-[#faf6ef] p-3 text-[10px] text-muted">{JSON.stringify(payload, null, 2)}</pre>;
}

function StepList({ steps }: { steps: AgentStep[] }) {
  if (!steps.length) return <p className="px-4 py-4 text-[11px] text-muted sm:px-5">No steps were recorded for this run.</p>;
  return (
    <div className="divide-y divide-[#efeae1]">
      {steps.map((step) => (
        <div key={step.id} className="flex items-start gap-2.5 px-4 py-2.5 sm:px-5">
          <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", step.status === "failed" ? "bg-clay" : step.status === "awaiting_approval" ? "bg-brass" : "bg-[#3f7a56]")} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-ink">
              {step.stepIndex}. {step.name.replaceAll("_", " ")}
              <span className="ml-1.5 font-normal text-muted">· {step.kind}</span>
            </p>
            {step.error && <p className="mt-0.5 text-[10px] text-[#8f4332]">{step.error}</p>}
            {!step.error && step.output && Object.keys(step.output).length > 0 && (
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted">{JSON.stringify(step.output)}</p>
            )}
          </div>
          <span className="shrink-0 text-[9px] uppercase tracking-[0.08em] text-muted">{step.status.replaceAll("_", " ")}</span>
        </div>
      ))}
    </div>
  );
}

export default async function AssistantPage() {
  const context = await getDashboardContext();
  if (!context) return null;
  if (!can(context.role, "ai.use")) notFound();

  const db = await ensureDb();
  const [runs, pending] = await Promise.all([
    listAgentRuns(db, context.tenant.id, 15),
    getPendingApprovals(db, context.tenant.id),
  ]);
  const provider = getProvider();

  return (
    <div>
      <PageHeader
        eyebrow="Growth"
        title="Nuru assistant"
        description="A tenant-scoped assistant that reads this workspace, prepares drafts, and stops for approval before anything leaves it."
        actions={
          <span className="dash-chip border border-line bg-paper text-muted">
            <Cpu className="h-3 w-3" /> {provider.info.live ? "Live provider" : "Mock provider"} · {provider.info.model}
          </span>
        }
      />
      <DemoNote>
        {provider.info.live
          ? "A live model provider is configured. Tool outputs still come only from this tenant, and no action runs without approval."
          : "The deterministic mock provider is active in demo mode. It produces real drafts from this workspace's data, but no model call leaves the server and no external message is sent."}
      </DemoNote>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-5">
          {pending.length > 0 && (
            <SectionCard title="Awaiting your approval" description="Prepared actions that are paused until a human decides">
              <div className="divide-y divide-[#efeae1]">
                {pending.map(({ approval, artifact, run }) => (
                  <div key={approval.id} className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f5e8d8] text-[#8c5b30]">
                          {approval.action === "send_campaign" ? <Mail className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-ink">{approvalTitle(approval)}</p>
                          <p className="mt-0.5 text-[10px] text-muted">
                            {artifact?.title ?? "Prepared action"} · {formatDate(approval.createdAt, context.tenant.timezone, "d MMM, h:mm a")}
                            {run ? ` · ${taskLabels[run.task] ?? run.task}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className="dash-chip bg-[#f7ecda] text-[#8e612f]">Nothing has run yet</span>
                    </div>

                    <div className="mt-3">
                      <ArtifactPreview action={approval.action} payload={approval.payload} />
                    </div>

                    <div className="mt-4 border-t border-line pt-3">
                      <ApprovalDecision approvalId={approval.id} action={approval.action} title={approvalTitle(approval)} />
                      <p className="mt-2 font-mono text-[9px] text-muted">payload {approval.payloadHash.slice(0, 16)}…</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Run history" description="Every run, tool call and decision is persisted for this tenant">
            {runs.length === 0 ? (
              <div className="px-4 py-10 text-center sm:px-5">
                <Sparkles className="mx-auto h-5 w-5 text-muted" />
                <p className="mt-2 text-sm font-medium">No runs yet</p>
                <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-muted">Use the panel on the right to ask about the schedule, draft a campaign, or refresh storefront copy.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#efeae1]">
                {runs.map(({ run, steps, artifacts, approvals }) => {
                  const summary = typeof run.result?.summary === "string" ? run.result.summary : null;
                  return (
                    <details key={run.id} className="group">
                      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 hover:bg-[#faf6ef] sm:px-5">
                        <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", statusStyles[run.status])}>
                          {run.status === "failed" ? <AlertTriangle className="h-3.5 w-3.5" /> : run.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-ink">{taskLabels[run.task] ?? run.task}</p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">{summary ?? run.prompt}</p>
                          <p className="mt-1 text-[9px] text-muted">
                            {formatDate(run.createdAt, context.tenant.timezone, "d MMM, h:mm a")} · {run.provider} · {steps.length} step{steps.length === 1 ? "" : "s"} · {artifacts.length} artifact{artifacts.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className={cn("dash-chip shrink-0", statusStyles[run.status])}>{statusLabels[run.status]}</span>
                        <ChevronDown className="mt-1 h-3.5 w-3.5 shrink-0 text-muted transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-line bg-[#fdfbf6]">
                        <div className="px-4 py-3 sm:px-5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Request</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-ink/85">{run.prompt}</p>
                          {run.error && <p className="mt-2 rounded bg-[#f6e4df] px-2 py-1.5 text-[10px] text-[#8f4332]">{run.error}</p>}
                        </div>
                        <div className="border-t border-line">
                          <p className="px-4 pb-1 pt-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted sm:px-5">Steps</p>
                          <StepList steps={steps} />
                        </div>
                        {approvals.length > 0 && (
                          <div className="border-t border-line px-4 py-3 sm:px-5">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Approval</p>
                            {approvals.map((approval) => (
                              <p key={approval.id} className="mt-1 flex items-center gap-1.5 text-[10px] text-ink/80">
                                {approval.status === "executed" ? <CheckCircle2 className="h-3 w-3 text-[#3f7a56]" /> : <ClipboardList className="h-3 w-3 text-muted" />}
                                {approvalTitle(approval)} · {approval.status.replaceAll("_", " ")}
                                {typeof approval.result?.note === "string" && ` · ${approval.result.note}`}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Ask the assistant" description="Starts a new persisted workflow">
            <div className="p-4 sm:p-5">
              <AssistantRunForm />
            </div>
          </SectionCard>

          <SectionCard title="What it can do">
            <div className="space-y-3 p-4 text-[11px] leading-relaxed text-muted sm:p-5">
              <div className="flex items-start gap-2.5">
                <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />
                <p>Read this tenant&apos;s bookings, availability, client consent and storefront content through typed tools.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />
                <p>Actions that change or send anything create an approval bound to a payload hash. If the payload changes, approval is refused.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />
                <p>It cannot see another tenant, publish the storefront, delete records, charge cards, or claim an external delivery that did not happen.</p>
              </div>
            </div>
          </SectionCard>

          <div className="overflow-hidden rounded-xl bg-forest p-5 text-ivory">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-brass">Demo provider</p>
            <p className="mt-2 font-display text-2xl leading-snug">{provider.info.live ? "A live model is connected." : "Deterministic, honest, local."}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-ivory/65">
              {provider.info.live
                ? "The configured provider drafts the words, while tools remain the only source of facts."
                : "The mock provider uses the same tool results and approval pipeline as a live model, so the workflow is real even though no model call is made."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
