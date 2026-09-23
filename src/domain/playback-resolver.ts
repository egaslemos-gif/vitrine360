import { db } from "@/db";
import {
  devices,
  tenants,
  deviceGroupMembers,
  schedules,
  scheduleTargets,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { format, toZonedTime } from "date-fns-tz";
import { isWithinDailyWindow } from "@/domain/schedule-time";

export type EffectivePlaybackState = {
  deviceId: string;
  tenantId: string;
  playlistId: string | null;
  source: "DEFAULT" | "SCHEDULE" | "EMERGENCY";
  scheduleId: string | null;
  priority: string;
  resolvedAt: string;
  timezone: string;
  emergencyContentId?: string | null;
};

export async function resolveEffectivePlayback(
  deviceId: string,
  now: Date = new Date(),
): Promise<{ effectiveState: EffectivePlaybackState }> {
  const [device] = await db
    .select()
    .from(devices)
    .where(eq(devices.id, deviceId))
    .limit(1);
  if (!device || !device.tenantId) {
    throw new Error("Device or Tenant not found");
  }
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, device.tenantId))
    .limit(1);
  if (!tenant) throw new Error("Tenant not found");

  const memberships = await db
    .select({ groupId: deviceGroupMembers.groupId })
    .from(deviceGroupMembers)
    .where(eq(deviceGroupMembers.deviceId, deviceId));
  const groupIds = memberships.map((m) => m.groupId);

  const effectiveTimezone = device.timezone || tenant.timezone || "UTC";

  const zonedNow = toZonedTime(now, effectiveTimezone);
  const dayOfWeek = zonedNow.getDay();
  const hhmm = format(zonedNow, "HH:mm");
  const isoNow = now.toISOString();

  const allSchedules = await db
    .select({
      schedule: schedules,
      target: scheduleTargets,
    })
    .from(schedules)
    .innerJoin(scheduleTargets, eq(scheduleTargets.scheduleId, schedules.id))
    .where(and(eq(schedules.tenantId, tenant.id), eq(schedules.active, true)));

  const applicableSchedulesMap = new Map<
    string,
    typeof schedules.$inferSelect
  >();

  for (const row of allSchedules) {
    const { schedule, target } = row;

    if (schedule.startAt && isoNow < schedule.startAt) continue;
    if (schedule.endAt && isoNow > schedule.endAt) continue;

    const days = JSON.parse(schedule.daysOfWeek || "[]") as number[];
    if (days.length && !days.includes(dayOfWeek)) continue;

    if (!isWithinDailyWindow(hhmm, schedule.startTime, schedule.endTime)) {
      continue;
    }

    let matchesTarget = false;
    if (target.targetType === "ALL") {
      matchesTarget = true;
    } else if (
      target.targetType === "DEVICE" &&
      target.targetId === deviceId
    ) {
      matchesTarget = true;
    } else if (
      target.targetType === "GROUP" &&
      target.targetId &&
      groupIds.includes(target.targetId)
    ) {
      matchesTarget = true;
    }

    if (matchesTarget) {
      applicableSchedulesMap.set(schedule.id, schedule);
    }
  }

  const matchingSchedules = Array.from(applicableSchedulesMap.values());

  const rank = { EMERGENCY: 3, HIGH: 2, NORMAL: 1 } as Record<string, number>;
  matchingSchedules.sort((a, b) => {
    const rankDiff = (rank[b.priority] ?? 0) - (rank[a.priority] ?? 0);
    if (rankDiff !== 0) return rankDiff;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const winner = matchingSchedules[0];

  const baseState = {
    deviceId,
    tenantId: tenant.id,
    resolvedAt: isoNow,
    timezone: effectiveTimezone,
  };

  if (!winner) {
    return {
      effectiveState: {
        ...baseState,
        playlistId: device.currentPlaylistId,
        source: "DEFAULT" as const,
        scheduleId: null,
        priority: "NONE",
      },
    };
  }

  if (winner.priority === "EMERGENCY" && winner.contentId) {
    return {
      effectiveState: {
        ...baseState,
        playlistId: device.currentPlaylistId,
        source: "EMERGENCY" as const,
        scheduleId: winner.id,
        priority: winner.priority,
        emergencyContentId: winner.contentId,
      },
    };
  }

  return {
    effectiveState: {
      ...baseState,
      playlistId: winner.playlistId ?? device.currentPlaylistId,
      source: "SCHEDULE" as const,
      scheduleId: winner.id,
      priority: winner.priority,
    },
  };
}
