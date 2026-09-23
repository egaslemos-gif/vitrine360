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
import { Monitor, Wifi, WifiOff, ListVideo } from "lucide-react";

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
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <PageHeader
        title="Ecrãs"
        description="Gestão e associação de ecrãs"
        actions={
          <a
            href="#registar-ecra"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            + Registar Ecrã
          </a>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ecrãs registados"
          value={activeDevices.length}
          tone="info"
          icon={<Monitor className="h-5 w-5" />}
        />
        <StatCard
          title="Online"
          value={onlineCount}
          tone="success"
          icon={<Wifi className="h-5 w-5" />}
        />
        <StatCard
          title="Offline"
          value={offlineCount}
          tone="danger"
          icon={<WifiOff className="h-5 w-5" />}
        />
        <StatCard
          title="Playlists activas"
          value={withPlaylist}
          tone="accent"
          icon={<ListVideo className="h-5 w-5" />}
        />
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
