import { db, type AllocationTx } from "@/db";
import { activityLogs } from "@/db/schema";
import { AuditWriteError, isUnpreparedSchemaError } from "@/lib/schema-readiness";

/**
 * Com `tx`, o registo entra na transacção do chamador.
 * Sem `tx`, escreve na ligação principal.
 *
 * Política dos logins: a sessão só abre depois deste registo.
 * Uma falha faz rollback da conta ou da associação quando vai na mesma
 * transacção, e nunca é apresentada como token ou credencial inválidos.
 */
export async function recordLoginAudit(
  params: Parameters<typeof logActivity>[0],
  tx?: AllocationTx,
) {
  try {
    await logActivity(params, tx);
  } catch (error) {
    if (isUnpreparedSchemaError(error)) throw error;
    throw new AuditWriteError();
  }
}
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
