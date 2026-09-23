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
      <header className="admin-page-header flex flex-col pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Schedules
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Criar, editar, activar/desactivar e eliminar. A execução efectiva
          aplica-se no Sync (~60s) — não altera a playlist atribuída no Devices.
          Timezone efectiva: Device → Tenant ({tenantTimezone}) → UTC.
        </p>
      </header>

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
