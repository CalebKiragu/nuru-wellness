import type { Tenant, TenantRole, User } from "@/db/schema";

export type AgentTask = "marketing_campaign" | "storefront_copy" | "business_question" | "schedule_review";

export type ActorContext = {
  tenant: Tenant;
  user: User;
  role: TenantRole;
};

export type ToolResult = {
  output: Record<string, unknown>;
  summary: string;
};

export type PlannedArtifact = {
  type: "campaign_draft" | "storefront_copy";
  title: string;
  content: Record<string, unknown>;
};

export type PlannedApproval = {
  action: "send_campaign" | "apply_storefront_copy";
  resourceType: "campaign" | "storefront";
  resourceId?: string | null;
  payload: Record<string, unknown>;
};

export type AgentPlan = {
  summary: string;
  steps: { kind: "tool" | "message"; name: string; input?: Record<string, unknown>; output?: Record<string, unknown> }[];
  artifact?: PlannedArtifact;
  approval?: PlannedApproval;
  result: Record<string, unknown>;
};

export type ProviderInfo = {
  id: "mock" | "openai";
  model: string;
  live: boolean;
};

export interface AgentProvider {
  info: ProviderInfo;
  plan(task: AgentTask, prompt: string, context: ActorContext, toolFacts: Record<string, unknown>): Promise<AgentPlan>;
}
