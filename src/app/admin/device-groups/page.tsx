import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { listDeviceGroups } from "@/services/device-groups";
import { listDevicesWithPresence } from "@/services/devices";
import { listPlaylists } from "@/services/playlists";
import { DeviceGroupsManager } from "@/features/devices/device-groups-manager";

export default async function DeviceGroupsPage() {
  const session = await requireAdminPage("manage_devices");
  if (!session) return <AccessDenied />;

  const [groups, devices, playlists] = await Promise.all([
    listDeviceGroups(session.tenantId),
    listDevicesWithPresence(session.tenantId),
    listPlaylists(session.tenantId),
  ]);

  return (
    <div className="space-y-8">
      <header className="admin-page-header flex flex-col pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Device Groups
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Agrupar ecrãs para atribuição de playlists em escala
        </p>
      </header>
      <DeviceGroupsManager
        groups={groups}
        devices={devices
          .filter((d) => d.status !== "PENDING")
          .map((d) => ({
            id: d.id,
            label: d.deviceCode ?? d.name ?? d.id.slice(0, 8),
          }))}
        playlists={playlists.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
