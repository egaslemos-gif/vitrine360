import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import {
  listSchedules,
  mapSchedulesEffectiveNow,
} from "@/services/schedules";
import { listPlaylists } from "@/services/playlists";
import { listDevicesWithPresence } from "@/services/devices";
import { listDeviceGroups } from "@/services/device-groups";
import { getTenantById } from "@/services/tenants";
import { ScheduleForm } from "@/features/schedules/schedule-form";
import { ScheduleListManager } from "@/features/schedules/schedule-list-manager";
import { PageHeader } from "@/components/ui/page-header";

export default async function SchedulesPage() {
  const session = await requireAdminPage("manage_schedules");
  if (!session) return <AccessDenied />;
  const [schedules, playlists, devices, groups, tenant] = await Promise.all([
    listSchedules(session.tenantId),
    listPlaylists(session.tenantId),
    listDevicesWithPresence(session.tenantId),
    listDeviceGroups(session.tenantId),
    getTenantById(session.tenantId),
  ]);

  const effectiveNow = await mapSchedulesEffectiveNow(
    session.tenantId,
    schedules.map((s) => s.id),
  );

  const tenantTimezone = tenant?.timezone || "UTC";
  const playlistOpts = playlists.map((p) => ({ id: p.id, name: p.name }));
  const deviceOpts = devices.map((d) => ({
    id: d.id,
    name: d.name ?? d.deviceCode ?? d.id,
  }));
  const groupOpts = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agendamentos"
        description={`Janelas de reprodução · timezone ${tenantTimezone}.`}
      />

      <ScheduleForm
        playlists={playlistOpts}
        devices={deviceOpts}
        groups={groupOpts}
      />

      <ScheduleListManager
        tenantTimezone={tenantTimezone}
        schedules={schedules.map((s) => ({
          id: s.id,
          name: s.name,
          playlistId: s.playlistId,
          contentId: s.contentId,
          startTime: s.startTime,
          endTime: s.endTime,
          daysOfWeek: s.daysOfWeek,
          priority: s.priority,
          active: s.active,
          effectiveNow: effectiveNow.get(s.id) === true,
          targets: s.targets.map((t) => ({
            id: t.id,
            targetType: t.targetType,
            targetId: t.targetId,
          })),
        }))}
        playlists={playlistOpts}
        devices={deviceOpts}
        groups={groupOpts}
      />
    </div>
  );
}
