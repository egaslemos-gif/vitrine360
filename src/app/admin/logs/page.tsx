import { desc, eq } from "drizzle-orm";
import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";

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
      <header className="admin-page-header pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Activity Logs
        </h1>
      </header>
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--color-muted)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2">Quando</th>
              <th className="px-3 py-2">Acção</th>
              <th className="px-3 py-2">Recurso</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 whitespace-nowrap">{l.createdAt}</td>
                <td className="px-3 py-2">{l.action}</td>
                <td className="px-3 py-2">
                  {l.resource} {l.resourceId ? `· ${l.resourceId.slice(0, 8)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-muted-foreground)]">
            Sem eventos ainda.
          </p>
        ) : null}
      </div>
    </div>
  );
}
