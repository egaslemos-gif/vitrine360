import { db } from "@/db";
import { activityLogs } from "@/db/schema";

export async function logActivity(params: {
  userId?: string | null;
  tenantId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(activityLogs).values({
    id: crypto.randomUUID(),
    userId: params.userId ?? null,
    tenantId: params.tenantId ?? null,
    action: params.action,
    resource: params.resource,
    resourceId: params.resourceId ?? null,
    ip: params.ip ?? null,
    metadata: JSON.stringify(params.metadata ?? {}),
  });
}
