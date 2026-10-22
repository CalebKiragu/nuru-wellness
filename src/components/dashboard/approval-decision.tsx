"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";

export function ApprovalDecision({
  approvalId,
  action,
  title,
}: {
  approvalId: string;
  action: string;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function decide(decision: "approved" | "rejected") {
    if (decision === "approved" && !window.confirm(`Approve "${title}"? The prepared action will run exactly as shown, and any external delivery will be simulated unless a provider is configured.`)) {
      return;
    }
    setBusy(decision);
    setResult("");
    setError("");
    try {
      const response = await fetch(`/api/dashboard/assistant/approvals/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const json = (await response.json()) as {
        error?: string;
        execution?: { note?: string; simulated?: number; recipients?: number; rejected?: boolean };
      };
      if (!response.ok) throw new Error(json.error ?? "Could not process the approval.");
      setResult(
        decision === "rejected"
          ? "Rejected. Nothing was sent or changed."
          : json.execution?.note ??
            (json.execution?.rejected ? "Rejected." : "Approved and executed."),
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not process the approval.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => decide("approved")} disabled={Boolean(busy)} className="dash-btn dash-btn-primary">
          {busy === "approved" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {action === "send_campaign" ? "Approve & process send" : "Approve & apply to draft"}
        </button>
        <button type="button" onClick={() => decide("rejected")} disabled={Boolean(busy)} className="dash-btn dash-btn-danger">
          {busy === "rejected" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Reject
        </button>
        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.08em] text-muted">
          <ShieldCheck className="h-3 w-3" /> Bound to payload hash
        </span>
      </div>
      {result && <p role="status" className="mt-2 text-[11px] leading-relaxed text-[#2f5c42]">{result}</p>}
      {error && <p role="alert" className="mt-2 text-[11px] text-[#9c4634]">{error}</p>}
    </div>
  );
}
