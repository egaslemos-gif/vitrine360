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
import { Monitor, Wifi, WifiOff, AlertTriangle } from "lucide-react";
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
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Workspace ${tenant?.name ?? session.activeTenantId.slice(0, 8)} · estado operacional`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ecrãs"
          value={activeDevices.length}
          hint={`${contents.length} conteúdos · ${playlists.length} playlists`}
          tone="neutral"
          icon={<Monitor className="h-4 w-4" />}
        />
        <StatCard
          title="Online"
          value={onlineCount}
          tone="success"
          icon={<Wifi className="h-4 w-4" />}
        />
        <StatCard
          title="Instáveis"
          value={awayCount}
          tone="warning"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          title="Offline"
          value={offlineCount}
          tone="danger"
          icon={<WifiOff className="h-4 w-4" />}
        />
      </div>

      <section className="space-y-3">
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
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/devices/${d.id}`}
                        className="ui-card-title hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                      >
                        {d.name ?? d.deviceCode ?? d.id.slice(0, 8)}
                      </Link>
                      <p className="ui-caption mt-0.5">
                        {d.location ?? "—"}
                        {" · "}
                        {d.lastSeenAt
                          ? new Date(d.lastSeenAt).toLocaleString("pt-PT")
                          : "sem contacto"}
                        {" · "}
                        Manifest v{d.manifestVersion ?? "—"}
                      </p>
                    </div>
                    <StatusBadge status={d.presence} />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
