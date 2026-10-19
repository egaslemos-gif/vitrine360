import { db, type AllocationTx } from "@/db";
import { activityLogs } from "@/db/schema";

/**
 * Com `tx`, o registo entra na transacção do chamador.
 * Sem `tx`, escreve na ligação principal (melhor-esforço).
 */
export async function logActivity(
  params: {
    userId?: string | null;
    tenantId?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    ip?: string | null;
    metadata?: Record<string, unknown>;
  },
  tx?: AllocationTx,
) {
  await (tx ?? db).insert(activityLogs).values({
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
