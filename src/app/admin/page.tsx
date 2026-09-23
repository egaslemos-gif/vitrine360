import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { listDevicesWithPresence } from "@/services/devices";
import { listContents } from "@/services/contents";
import { listPlaylists } from "@/services/playlists";
import { getTenantById } from "@/services/tenants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <header className="admin-page-header flex flex-col pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Workspace:{" "}
          <span className="font-medium text-[var(--color-foreground)]">
            {tenant?.name ?? session.activeTenantId.slice(0, 8)}
          </span>
          {" · "}
          {session.role.replaceAll("_", " ")}
        </p>
        <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
          Estado operacional dos ecrãs e conteúdos
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Total de Ecrãs" value={activeDevices.length} />
        <Stat title="Online" value={onlineCount} />
        <Stat title="Instáveis" value={awayCount} />
        <Stat title="Offline" value={offlineCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ecrãs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-[var(--color-border)]">
            {activeDevices.length === 0 ? (
              <p className="py-4 text-sm text-[var(--color-muted-foreground)]">
                Nenhum ecrã activo. Associe um ecrã em Devices.
              </p>
            ) : (
              activeDevices.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <p className="font-medium">{d.name ?? d.deviceCode ?? d.id.slice(0, 8)}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {d.location ?? "—"} · Last seen:{" "}
                      {d.lastSeenAt
                        ? new Date(d.lastSeenAt).toLocaleString()
                        : "never"}{" "}
                      · Manifest v {d.manifestVersion ?? "—"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      d.presence === "ONLINE"
                        ? "success"
                        : d.presence === "AWAY"
                          ? "warning"
                          : "muted"
                    }
                  >
                    {d.presence}
                  </Badge>
                </div>
              ))
            )}
          </div>
          <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">
            Conteúdos na biblioteca: {contents.length} · Playlists: {playlists.length}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-[var(--color-primary)]">{value}</p>
      </CardContent>
    </Card>
  );
}
