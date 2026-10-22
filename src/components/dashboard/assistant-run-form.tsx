"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

const tasks = [
  { id: "business_question", label: "Ask about the business", hint: "How is this week looking?", prompt: "How is this week looking, and is there anything I should pay attention to?" },
  { id: "schedule_review", label: "Review the schedule", hint: "Where is there room?", prompt: "Find the quieter parts of the week and tell me where there is genuine availability." },
  { id: "marketing_campaign", label: "Draft a campaign", hint: "Fill quiet slots", prompt: "Help me fill the quiet slots this week with a warm note to clients who have opted in." },
  { id: "storefront_copy", label: "Refresh storefront copy", hint: "Warmer hero text", prompt: "Refresh the homepage headline and introduction so it feels warmer, while keeping every factual claim accurate." },
] as const;

export function AssistantRunForm() {
  const router = useRouter();
  const [task, setTask] = useState<(typeof tasks)[number]["id"]>("business_question");
  const [prompt, setPrompt] = useState<string>(tasks[0].prompt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/dashboard/assistant/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, prompt }),
      });
      const json = (await response.json()) as {
        error?: string;
        summary?: string;
        awaitingApproval?: boolean;
        provider?: { id: string; live: boolean };
      };
      if (!response.ok) throw new Error(json.error ?? "The assistant could not complete that request.");
      setMessage(
        `${json.summary ?? "Done."}${json.awaitingApproval ? " Review the prepared draft below — nothing has been sent or published." : ""} Provider: ${json.provider?.live ? "live" : "mock (demo)"}.`,
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The assistant could not complete that request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {tasks.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => { setTask(entry.id); setPrompt(entry.prompt); }}
            className={`rounded-lg border p-3 text-left transition-colors ${task === entry.id ? "border-forest bg-[#eef2eb]" : "border-line bg-paper hover:border-forest/30"}`}
            aria-pressed={task === entry.id}
          >
            <span className="block text-xs font-semibold text-ink">{entry.label}</span>
            <span className="mt-0.5 block text-[10px] text-muted">{entry.hint}</span>
          </button>
        ))}
      </div>
      <div>
        <label className="dash-label" htmlFor="assistant-prompt">What would you like help with?</label>
        <textarea id="assistant-prompt" rows={4} className="dash-input resize-y" value={prompt} onChange={(event) => setPrompt(event.target.value)} minLength={3} maxLength={1200} required />
        <p className="mt-1 text-[10px] text-muted">
          The assistant can read this workspace&apos;s data and prepare drafts. It cannot send, publish, delete or charge anything without your approval.
        </p>
      </div>
      <button type="submit" disabled={busy} className="dash-btn dash-btn-primary">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {busy ? "Working…" : "Run assistant"}
      </button>
      {message && <p role="status" className="rounded-md border border-[#cee0d1] bg-[#e6efe7] px-3 py-2 text-[11px] leading-relaxed text-[#2f5c42]">{message}</p>}
      {error && <p role="alert" className="rounded-md bg-[#FBEDE9] px-3 py-2 text-[11px] text-[#8f4332]">{error}</p>}
    </form>
  );
}
