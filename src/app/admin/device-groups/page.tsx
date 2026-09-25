import { AccessDenied } from "@/components/access-denied";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="space-y-6">
      <PageHeader
        title="Grupos"
        description="Agrupar ecrãs para atribuição de playlists em escala"
      />
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
