import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { listDevicesWithPresence } from "@/services/devices";
import { listContents } from "@/services/contents";
import { listPlaylists } from "@/services/playlists";
import { getTenantById } from "@/services/tenants";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const session = await requireAdminPage("view_dashboard");
  if (!session) return <AccessDenied />;

  const [devices, contents, playlists, tenant] = await Promise.all([
    listDevicesWithPresence(session.tenantId),
    listContents(session.tenantId),
    listPlaylists(session.tenantId),
    getTenantById(session.activeTenantId),
  ]);

  const activeDevices = devices.filter((d) => d.status !== "PENDING");
  const onlineCount = activeDevices.filter((d) => d.presence === "ONLINE").length;
  const awayCount = activeDevices.filter((d) => d.presence === "AWAY").length;
  const offlineCount = activeDevices.filter((d) => d.presence === "OFFLINE").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`${tenant?.name ?? "Workspace"} · vista operacional`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ecrãs"
          value={activeDevices.length}
          hint={`${contents.length} conteúdos · ${playlists.length} playlists`}
        />
        <StatCard title="Online" value={onlineCount} hint="em contacto" />
        <StatCard title="Instáveis" value={awayCount} hint="atenção" />
        <StatCard title="Offline" value={offlineCount} hint="sem contacto" />
      </div>

      <section className="space-y-4">
        <SectionHeader
          title="Ecrãs"
          description="Presença e contacto recente"
          actions={
            <Link
              href="/admin/devices"
              className="ui-secondary hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              Ver todos
            </Link>
          }
        />
        <Card className="border border-[var(--color-border)] bg-[var(--color-surface)] shadow-none">
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--color-border)]">
              {activeDevices.length === 0 ? (
                <p className="ui-secondary px-4 py-6">
                  Nenhum ecrã activo. Associe um ecrã em Ecrãs.
                </p>
              ) : (
                activeDevices.map((d) => (
                  <Link
                    key={d.id}
                    href={`/admin/devices/${d.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-muted)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ring)]"
                  >
                    <div className="min-w-0">
                      <p className="ui-card-title truncate">
                        {d.name ?? d.deviceCode ?? d.id.slice(0, 8)}
                      </p>
                      <p className="ui-caption mt-0.5">
                        {d.location ?? "—"}
                        {" · Manifest v"}
                        {d.manifestVersion ?? "—"}
                        {" · "}
                        {d.lastSeenAt
                          ? new Date(d.lastSeenAt).toLocaleTimeString("pt-PT")
                          : "sem contacto"}
                      </p>
                    </div>
                    <StatusBadge status={d.presence} />
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
