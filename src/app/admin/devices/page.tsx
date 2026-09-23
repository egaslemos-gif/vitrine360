import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { assignMissingDefaultPlaylists, listDevicesWithPresence } from "@/services/devices";
import { listPlaylists } from "@/services/playlists";
import { listDeviceGroups } from "@/services/device-groups";
import { PairDeviceForm } from "@/features/devices/pair-device-form";
import { DeviceListManager } from "@/features/devices/device-list-manager";
import { DeviceConfigurationHelp } from "@/features/devices/device-configuration-help";

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

  return (
    <div className="space-y-8">
      <header className="admin-page-header flex flex-col pb-4 pt-4">
        <h1
          className="text-3xl font-bold tracking-tight text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Devices
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Gestão e associação de ecrãs
        </p>
      </header>

      <PairDeviceForm />
      <DeviceConfigurationHelp />

      <DeviceListManager 
        devices={activeDevices}
        playlists={playlists.map((p) => ({ id: p.id, name: p.name }))}
        groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.memberIds }))}
      />

      {pendingDevices.length > 0 && (
        <p className="text-sm text-[var(--color-muted-foreground)] mt-6">
          Ecrãs pendentes de associação: {pendingDevices.length}
        </p>
      )}
    </div>
  );
}
