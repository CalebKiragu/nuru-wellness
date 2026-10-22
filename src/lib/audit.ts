import "server-only";
import type { Database } from "@/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auditEvents } from "@/db/schema";

type AuditInput = {
  tenantId: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

export async function recordAudit(db: Database, input: AuditInput) {
  try {
    await db.insert(auditEvents).values({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? {},
      ip: input.ip ?? null,
    });
  } catch (error) {
    // Auditing must never take down a booking or publish. The failure is logged
    // and can be picked up by platform monitoring.
    console.error("audit_write_failed", { action: input.action, error: String(error) });
  }
}

export async function recentAudit(db: Database, tenantId: string, limit = 20) {
  return db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.tenantId, tenantId), inArray(auditEvents.action, [
      "booking.created",
      "booking.status_changed",
      "booking.rescheduled",
      "storefront.published",
      "storefront.draft_saved",
      "approval.approved",
      "approval.rejected",
      "campaign.simulated",
      "campaign.sent",
    ])))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}
