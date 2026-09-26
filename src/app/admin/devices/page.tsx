import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import {
  assignMissingDefaultPlaylists,
  listDevicesWithPresence,
} from "@/services/devices";
import { listPlaylists } from "@/services/playlists";
import { listDeviceGroups } from "@/services/device-groups";
import { PairDeviceForm } from "@/features/devices/pair-device-form";
import { DeviceListManager } from "@/features/devices/device-list-manager";
import { DeviceConfigurationHelp } from "@/features/devices/device-configuration-help";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default async function DevicesPage() {
  const session = await requireAdminPage("manage_devices");
  if (!session) return <AccessDenied />;

  await assignMissingDefaultPlaylists(session.tenantId);

  const [devices, playlists, groups] = await Promise.all([
    listDevicesWithPresence(session.tenantId),
    listPlaylists(session.tenantId),
    listDeviceGroups(session.tenantId),
  ]);

  const activeDevices = devices.filter((d) => d.status !== "PENDING");
  const pendingDevices = devices.filter((d) => d.status === "PENDING");
  const onlineCount = activeDevices.filter((d) => d.presence === "ONLINE").length;
  const offlineCount = activeDevices.filter((d) => d.presence === "OFFLINE").length;
  const withPlaylist = activeDevices.filter((d) => d.currentPlaylistId).length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-8">
      <PageHeader
        title="Ecrãs"
        description="Gerencie os dispositivos que apresentam as suas experiências."
        actions={
          <a
            href="#registar-ecra"
            className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] sm:w-auto"
          >
            + Registar Ecrã
          </a>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Ecrãs" value={activeDevices.length} hint="registados" />
        <StatCard title="Online" value={onlineCount} hint="activos agora" />
        <StatCard title="Offline" value={offlineCount} hint="sem contacto" />
        <StatCard title="Com playlist" value={withPlaylist} hint="atribuídas" />
      </div>

      <section className="scroll-mt-24 space-y-3" id="registar-ecra">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Registar ecrã
        </h2>
        <PairDeviceForm />
      </section>

      <DeviceConfigurationHelp />

      <DeviceListManager
        devices={activeDevices}
        playlists={playlists.map((p) => ({ id: p.id, name: p.name }))}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          memberIds: g.memberIds,
        }))}
      />

      {pendingDevices.length > 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Ecrãs pendentes de associação: {pendingDevices.length}
        </p>
      ) : null}
    </div>
  );
}
