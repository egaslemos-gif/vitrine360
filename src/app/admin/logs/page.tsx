import { desc, eq } from "drizzle-orm";
import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { PageHeader } from "@/components/ui/page-header";

export default async function LogsPage() {
  const session = await requireAdminPage("view_logs");
  if (!session) return <AccessDenied />;
  const logs = await db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.tenantId, session.tenantId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Actividade"
        description="Eventos recentes do workspace."
      />
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--color-surface-muted)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2.5 font-medium">Quando</th>
              <th className="px-3 py-2.5 font-medium">Acção</th>
              <th className="px-3 py-2.5 font-medium">Recurso</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums ui-secondary">
                  {l.createdAt}
                </td>
                <td className="px-3 py-2.5">{l.action}</td>
                <td className="px-3 py-2.5 ui-secondary">
                  {l.resource}{" "}
                  {l.resourceId ? `· ${l.resourceId.slice(0, 8)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 ? (
          <p className="ui-secondary p-4">Sem eventos ainda.</p>
        ) : null}
      </div>
    </div>
  );
}
