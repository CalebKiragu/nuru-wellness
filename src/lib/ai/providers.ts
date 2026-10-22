import "server-only";
import { env } from "@/lib/env";
import type { ActorContext, AgentPlan, AgentProvider, AgentTask, ProviderInfo } from "./types";
import type { StorefrontConfig } from "@/lib/storefront";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstSlot(facts: Record<string, unknown>) {
  const slots = facts.available as { slots?: { date: string; label: string; service: string }[] } | undefined;
  return slots?.slots?.[0] ?? null;
}

function audienceCount(facts: Record<string, unknown>) {
  const audience = facts.audience as { consented?: number } | undefined;
  return audience?.consented ?? 0;
}

function businessName(facts: Record<string, unknown>) {
  const profile = facts.profile as { businessName?: string } | undefined;
  return profile?.businessName ?? "the studio";
}

class MockProvider implements AgentProvider {
  info: ProviderInfo = { id: "mock", model: "nuru-mock-1", live: false };

  async plan(task: AgentTask, prompt: string, context: ActorContext, facts: Record<string, unknown>): Promise<AgentPlan> {
    const name = businessName(facts);
    const audience = audienceCount(facts);
    const slot = firstSlot(facts);

    if (task === "marketing_campaign") {
      const slotLine = slot ? `We have a little room on ${slot.date}, with ${slot.label} available for ${slot.service}.` : "We have a few quieter moments in the diary this week.";
      const subject = `A quiet hour at ${name}`;
      const body = [
        "Hello {{first_name}},",
        "",
        `${slotLine} If an hour of rest would help, we would love to see you.`,
        "",
        `Reply to this note or book online, and we will take care of the rest.`,
        "",
        "With care,",
        name,
      ].join("\n");
      const payload = {
        name: `Make room this week`,
        channel: "email",
        subject,
        body,
        audience: {
          segment: "marketing_consented",
          count: audience,
          description: "Clients who explicitly opted in to studio notes",
        },
        rationale: slot
          ? `Selected because ${slot.date} at ${slot.label} is genuinely open with ${slot.service}.`
          : "No open slots were returned, so the draft avoids specific availability claims.",
      };
      return {
        summary: `A campaign draft for ${audience} marketing-consented client${audience === 1 ? "" : "s"}. Nothing has been sent.`,
        steps: [
          { kind: "message", name: "draft_campaign_copy", output: { subject, audience } },
          { kind: "message", name: "request_approval", output: { action: "send_campaign" } },
        ],
        artifact: { type: "campaign_draft", title: subject, content: payload },
        approval: { action: "send_campaign", resourceType: "campaign", payload },
        result: { summary: `Prepared a campaign for ${audience} consented clients. Awaiting your approval.` },
      };
    }

    if (task === "storefront_copy") {
      const config = asRecord(facts.storefront);
      const content = asRecord(config.content) as Partial<StorefrontConfig["content"]>;
      const existingTitle = typeof content.heroTitle === "string" ? content.heroTitle : "A quieter way to come back to yourself.";
      const changes = {
        heroTitle: existingTitle.replace(/\.$/, "") + ", at your own pace.",
        heroText:
          "Thoughtful, unhurried care in a calm studio. Every visit begins with listening and ends with a little more room to breathe.",
        servicesText:
          "Each treatment is adapted to you on the day. Pressure, pace and focus are always discussed before we begin.",
      };
      return {
        summary: "Proposed storefront copy changes. They will be saved to the draft, not published automatically.",
        steps: [
          { kind: "message", name: "read_published_copy", output: { heroTitle: existingTitle } },
          { kind: "message", name: "draft_copy_refresh", output: changes },
        ],
        artifact: {
          type: "storefront_copy",
          title: "Storefront copy refresh",
          content: { changes, rationale: "Warmer, shorter hero copy while keeping the studio's voice and claims unchanged." },
        },
        approval: {
          action: "apply_storefront_copy",
          resourceType: "storefront",
          payload: { changes, note: "AI copy refresh — apply to draft for review" },
        },
        result: { summary: "Drafted storefront copy changes for review. The live site is unchanged." },
      };
    }

    if (task === "schedule_review") {
      const summary = asRecord(facts.bookings);
      const pending = Number(summary.pendingCount ?? 0);
      const today = Number(summary.todayCount ?? 0);
      const answer = `${today} appointment${today === 1 ? "" : "s"} today and ${pending} request${pending === 1 ? "" : "s"} awaiting confirmation. ${slot ? `The next genuinely open slot is ${slot.date} at ${slot.label}.` : "No open slots were found in the next seven days."}`;
      return {
        summary: answer,
        steps: [{ kind: "message", name: "summarise_schedule", output: { answer } }],
        result: { answer, summary: answer },
      };
    }

    const summary = asRecord(facts.bookings);
    const answer = `At ${name}, ${summary.todayCount ?? 0} appointment${Number(summary.todayCount ?? 0) === 1 ? "" : "s"} are scheduled today and ${summary.pendingCount ?? 0} request${Number(summary.pendingCount ?? 0) === 1 ? "" : "s"} are waiting for a decision. These figures come directly from this workspace's records — no projections are invented.`;
    return {
      summary: answer,
      steps: [{ kind: "message", name: "answer_question", output: { answer } }],
      result: { answer },
    };
  }
}

class OpenAIProvider implements AgentProvider {
  info: ProviderInfo = { id: "openai", model: env.openaiModel, live: true };

  async plan(task: AgentTask, prompt: string, context: ActorContext, facts: Record<string, unknown>): Promise<AgentPlan> {
    if (!env.openaiKey) {
      throw new Error("AI_PROVIDER is set to openai but OPENAI_API_KEY is missing.");
    }

    if (task !== "marketing_campaign" && task !== "storefront_copy") {
      return new MockProvider().plan(task, prompt, context, facts);
    }

    const instruction =
      task === "marketing_campaign"
        ? `Draft a warm, concise marketing email for ${businessName(facts)}. Return JSON: {"subject":string,"body":string,"name":string}. Do not invent discounts, reviews, availability or prices.`
        : `Refresh three pieces of storefront copy for ${businessName(facts)}. Return JSON: {"heroTitle":string,"heroText":string,"servicesText":string}. Preserve existing factual claims; do not invent awards, reviews or prices.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.openaiModel,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You write copy for independent wellness studios. You never fabricate facts." },
          {
            role: "user",
            content: `${instruction}\n\nOwner request: ${prompt}\n\nVerified workspace facts:\n${JSON.stringify(facts).slice(0, 6000)}`,
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`OpenAI provider responded ${response.status}`);
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI provider returned no content.");
    const parsed = JSON.parse(text) as Record<string, unknown>;

    if (task === "marketing_campaign") {
      const payload = {
        name: typeof parsed.name === "string" ? parsed.name : "Studio note",
        channel: "email",
        subject: typeof parsed.subject === "string" ? parsed.subject : "A note from the studio",
        body: typeof parsed.body === "string" ? parsed.body : "",
        audience: { segment: "marketing_consented", count: audienceCount(facts), description: "Clients who opted in to studio notes" },
        rationale: "Drafted by the configured OpenAI provider using verified workspace facts.",
      };
      return {
        summary: `An AI-drafted campaign for ${audienceCount(facts)} consented clients. Nothing has been sent.`,
        steps: [{ kind: "message", name: "draft_campaign_copy", output: { provider: "openai" } }],
        artifact: { type: "campaign_draft", title: payload.subject, content: payload },
        approval: { action: "send_campaign", resourceType: "campaign", payload },
        result: { summary: "Prepared a campaign draft for review." },
      };
    }

    const changes = {
      heroTitle: typeof parsed.heroTitle === "string" ? parsed.heroTitle : "",
      heroText: typeof parsed.heroText === "string" ? parsed.heroText : "",
      servicesText: typeof parsed.servicesText === "string" ? parsed.servicesText : "",
    };
    return {
      summary: "Proposed storefront copy changes from the OpenAI provider.",
      steps: [{ kind: "message", name: "draft_copy_refresh", output: { provider: "openai" } }],
      artifact: { type: "storefront_copy", title: "Storefront copy refresh", content: { changes } },
      approval: { action: "apply_storefront_copy", resourceType: "storefront", payload: { changes, note: "AI copy refresh" } },
      result: { summary: "Drafted storefront copy changes for review." },
    };
  }
}

export function getProvider(): AgentProvider {
  if (env.aiProvider === "openai") return new OpenAIProvider();
  return new MockProvider();
}
