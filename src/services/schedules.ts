import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  contents,
  playlists,
  schedules,
  scheduleTargets,
  devices,
  deviceGroups,
  deviceGroupMembers,
} from "@/db/schema";
import { logActivity } from "@/services/activity-log";
import { z } from "zod";
import { normalizeTimeToHHmm } from "@/domain/schedule-time";
import { resolveEffectivePlayback } from "@/domain/playback-resolver";

/** Activity actions for schedule lifecycle (Control Plane). */
export const SCHEDULE_ACTIVITY = {
  CREATED: "SCHEDULE_CREATED",
  UPDATED: "SCHEDULE_UPDATED",
  ACTIVATED: "SCHEDULE_ACTIVATED",
  DEACTIVATED: "SCHEDULE_DEACTIVATED",
  DELETED: "SCHEDULE_DELETED",
} as const;

async function assertTenantPlaylist(
  playlistId: string | undefined,
  tenantId: string,
) {
  if (!playlistId) return;
  const [row] = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new Error("Playlist not found");
}

async function assertTenantContent(
  contentId: string | undefined,
  tenantId: string,
) {
  if (!contentId) return;
  const [row] = await db
    .select({ id: contents.id })
    .from(contents)
    .where(and(eq(contents.id, contentId), eq(contents.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new Error("Content not found");
}

const optionalHHmm = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (v == null || v === "") return undefined;
    const n = normalizeTimeToHHmm(v);
    if (!n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid time (expected HH:mm)",
      });
      return z.NEVER;
    }
    return n;
  });

export const createScheduleSchema = z
  .object({
    name: z.string().min(1).max(200),
    playlistId: z.string().uuid().optional(),
    contentId: z.string().uuid().optional(),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
    startTime: optionalHHmm,
    endTime: optionalHHmm,
    priority: z.enum(["NORMAL", "HIGH", "EMERGENCY"]).default("NORMAL"),
    active: z.boolean().default(true),
    targets: z
      .array(
        z.object({
          targetType: z.enum(["ALL", "GROUP", "DEVICE"]),
          targetId: z.string().nullable(),
        }),
      )
      .min(1, "At least one target is required"),
  })
  .refine(
    (data) => {
      for (const t of data.targets) {
        if (t.targetType === "ALL" && t.targetId !== null) return false;
        if (t.targetType !== "ALL" && !t.targetId) return false;
      }
      return true;
    },
    { message: "Invalid target configuration" },
  )
  .refine(
    (data) => {
      if (data.priority === "EMERGENCY") return !!data.contentId;
      return true;
    },
    { message: "EMERGENCY schedules require contentId" },
  );

/** Caller-facing input (before Zod defaults/transforms). */
export type CreateScheduleInput = z.input<typeof createScheduleSchema>;

/** Bump manifestVersion for every device matched by schedule targets. */
export async function bumpManifestForScheduleTargets(
  tenantId: string,
  targets: { targetType: string; targetId: string | null }[],
) {
  const deviceIds = new Set<string>();

  for (const t of targets) {
    if (t.targetType === "ALL") {
      const rows = await db
        .select({ id: devices.id })
        .from(devices)
        .where(and(eq(devices.tenantId, tenantId), eq(devices.status, "ACTIVE")));
      for (const r of rows) deviceIds.add(r.id);
    } else if (t.targetType === "DEVICE" && t.targetId) {
      const [row] = await db
        .select({ id: devices.id })
        .from(devices)
        .where(
          and(
            eq(devices.id, t.targetId),
            eq(devices.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (row) deviceIds.add(row.id);
    } else if (t.targetType === "GROUP" && t.targetId) {
      const members = await db
        .select({ deviceId: deviceGroupMembers.deviceId })
        .from(deviceGroupMembers)
        .innerJoin(devices, eq(devices.id, deviceGroupMembers.deviceId))
        .where(
          and(
            eq(deviceGroupMembers.groupId, t.targetId),
            eq(devices.tenantId, tenantId),
          ),
        );
      for (const m of members) deviceIds.add(m.deviceId);
    }
  }

  if (deviceIds.size === 0) return 0;

  const ids = Array.from(deviceIds);
  const rows = await db
    .select({ id: devices.id, manifestVersion: devices.manifestVersion })
    .from(devices)
    .where(inArray(devices.id, ids));

  const now = new Date().toISOString();
  for (const row of rows) {
    await db
      .update(devices)
      .set({
        manifestVersion: (row.manifestVersion ?? 0) + 1,
        // Force wall-clock compare to re-publish on next sync
        effectivePlaybackKey: null,
        updatedAt: now,
      })
      .where(eq(devices.id, row.id));
  }
  return rows.length;
}

export async function listSchedules(tenantId: string) {
  const rows = await db
    .select({
      schedule: schedules,
      target: scheduleTargets,
    })
    .from(schedules)
    .leftJoin(scheduleTargets, eq(scheduleTargets.scheduleId, schedules.id))
    .where(eq(schedules.tenantId, tenantId));

  const map = new Map<
    string,
    typeof schedules.$inferSelect & {
      targets: (typeof scheduleTargets.$inferSelect)[];
    }
  >();

  for (const row of rows) {
    if (!map.has(row.schedule.id)) {
      map.set(row.schedule.id, { ...row.schedule, targets: [] });
    }
    if (row.target) {
      map.get(row.schedule.id)!.targets.push(row.target);
    }
  }

  return Array.from(map.values());
}

export async function createSchedule(
  raw: CreateScheduleInput,
  tenantId: string,
  userId?: string,
) {
  const input = createScheduleSchema.parse(raw);
  await assertTenantPlaylist(input.playlistId, tenantId);
  await assertTenantContent(input.contentId, tenantId);

  for (const t of input.targets) {
    if (t.targetType === "DEVICE" && t.targetId) {
      const [device] = await db
        .select({ id: devices.id })
        .from(devices)
        .where(
          and(eq(devices.id, t.targetId), eq(devices.tenantId, tenantId)),
        )
        .limit(1);
      if (!device) throw new Error(`Device ${t.targetId} not found in tenant`);
    } else if (t.targetType === "GROUP" && t.targetId) {
      const [group] = await db
        .select({ id: deviceGroups.id })
        .from(deviceGroups)
        .where(
          and(
            eq(deviceGroups.id, t.targetId),
            eq(deviceGroups.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!group) throw new Error(`Group ${t.targetId} not found in tenant`);
    }
  }

  const id = crypto.randomUUID();
  const startTime = normalizeTimeToHHmm(input.startTime ?? null);
  const endTime = normalizeTimeToHHmm(input.endTime ?? null);

  await db.transaction(async (tx) => {
    await tx.insert(schedules).values({
      id,
      name: input.name,
      playlistId: input.playlistId ?? null,
      contentId: input.contentId ?? null,
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      daysOfWeek: JSON.stringify(input.daysOfWeek),
      startTime,
      endTime,
      priority: input.priority,
      active: input.active,
      tenantId,
    });

    for (const t of input.targets) {
      await tx.insert(scheduleTargets).values({
        id: crypto.randomUUID(),
        scheduleId: id,
        targetType: t.targetType,
        targetId: t.targetId,
      });
    }
  });

  const bumped = await bumpManifestForScheduleTargets(tenantId, input.targets);

  await logActivity({
    userId,
    tenantId,
    action: SCHEDULE_ACTIVITY.CREATED,
    resource: "schedule",
    resourceId: id,
    metadata: {
      priority: input.priority,
      targetsCount: input.targets.length,
      devicesBumped: bumped,
    },
  });
  return id;
}

export async function setScheduleActive(
  id: string,
  active: boolean,
  tenantId: string,
  userId?: string,
) {
  const [row] = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.id, id), eq(schedules.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new Error("Schedule not found");

  await db
    .update(schedules)
    .set({ active, updatedAt: new Date().toISOString() })
    .where(and(eq(schedules.id, id), eq(schedules.tenantId, tenantId)));

  const targets = await db
    .select()
    .from(scheduleTargets)
    .where(eq(scheduleTargets.scheduleId, id));

  await bumpManifestForScheduleTargets(
    tenantId,
    targets.map((t) => ({
      targetType: t.targetType,
      targetId: t.targetId,
    })),
  );

  await logActivity({
    userId,
    tenantId,
    action: active
      ? SCHEDULE_ACTIVITY.ACTIVATED
      : SCHEDULE_ACTIVITY.DEACTIVATED,
    resource: "schedule",
    resourceId: id,
  });
}

export async function deleteSchedule(
  id: string,
  tenantId: string,
  userId?: string,
) {
  const [row] = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.id, id), eq(schedules.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new Error("Schedule not found");

  const targets = await db
    .select()
    .from(scheduleTargets)
    .where(eq(scheduleTargets.scheduleId, id));

  await db
    .delete(schedules)
    .where(and(eq(schedules.id, id), eq(schedules.tenantId, tenantId)));

  await bumpManifestForScheduleTargets(
    tenantId,
    targets.map((t) => ({
      targetType: t.targetType,
      targetId: t.targetId,
    })),
  );

  await logActivity({
    userId,
    tenantId,
    action: SCHEDULE_ACTIVITY.DELETED,
    resource: "schedule",
    resourceId: id,
  });
}

export const updateScheduleSchema = createScheduleSchema;

export async function getSchedule(id: string, tenantId: string) {
  const rows = await listSchedules(tenantId);
  return rows.find((s) => s.id === id) ?? null;
}

export async function updateSchedule(
  id: string,
  raw: CreateScheduleInput,
  tenantId: string,
  userId?: string,
) {
  const input = updateScheduleSchema.parse(raw);
  const [existing] = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.id, id), eq(schedules.tenantId, tenantId)))
    .limit(1);
  if (!existing) throw new Error("Schedule not found");

  await assertTenantPlaylist(input.playlistId, tenantId);
  await assertTenantContent(input.contentId, tenantId);

  for (const t of input.targets) {
    if (t.targetType === "DEVICE" && t.targetId) {
      const [device] = await db
        .select({ id: devices.id })
        .from(devices)
        .where(
          and(eq(devices.id, t.targetId), eq(devices.tenantId, tenantId)),
        )
        .limit(1);
      if (!device) throw new Error(`Device ${t.targetId} not found in tenant`);
    } else if (t.targetType === "GROUP" && t.targetId) {
      const [group] = await db
        .select({ id: deviceGroups.id })
        .from(deviceGroups)
        .where(
          and(
            eq(deviceGroups.id, t.targetId),
            eq(deviceGroups.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!group) throw new Error(`Group ${t.targetId} not found in tenant`);
    }
  }

  const oldTargets = await db
    .select()
    .from(scheduleTargets)
    .where(eq(scheduleTargets.scheduleId, id));

  await db.transaction(async (tx) => {
    await tx
      .update(schedules)
      .set({
        name: input.name,
        playlistId: input.playlistId ?? null,
        contentId: input.contentId ?? null,
        startAt: input.startAt ?? null,
        endAt: input.endAt ?? null,
        daysOfWeek: JSON.stringify(input.daysOfWeek),
        startTime: normalizeTimeToHHmm(input.startTime ?? null),
        endTime: normalizeTimeToHHmm(input.endTime ?? null),
        priority: input.priority,
        active: input.active,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(schedules.id, id), eq(schedules.tenantId, tenantId)));

    await tx
      .delete(scheduleTargets)
      .where(eq(scheduleTargets.scheduleId, id));

    for (const t of input.targets) {
      await tx.insert(scheduleTargets).values({
        id: crypto.randomUUID(),
        scheduleId: id,
        targetType: t.targetType,
        targetId: t.targetId,
      });
    }
  });

  // Invalidate old + new target sets
  await bumpManifestForScheduleTargets(tenantId, [
    ...oldTargets.map((t) => ({
      targetType: t.targetType,
      targetId: t.targetId,
    })),
    ...input.targets,
  ]);

  await logActivity({
    userId,
    tenantId,
    action: SCHEDULE_ACTIVITY.UPDATED,
    resource: "schedule",
    resourceId: id,
    metadata: { priority: input.priority, targetsCount: input.targets.length },
  });
}

/**
 * Derived "effective now" flags via resolveEffectivePlayback (no second resolver).
 * A schedule is effective-now when it is the winning schedule for ≥1 ACTIVE device.
 */
export async function mapSchedulesEffectiveNow(
  tenantId: string,
  scheduleIds: string[],
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  for (const id of scheduleIds) result.set(id, false);
  if (scheduleIds.length === 0) return result;

  const deviceRows = await db
    .select({ id: devices.id })
    .from(devices)
    .where(and(eq(devices.tenantId, tenantId), eq(devices.status, "ACTIVE")));

  for (const row of deviceRows) {
    try {
      const { effectiveState } = await resolveEffectivePlayback(row.id);
      if (
        effectiveState.scheduleId &&
        result.has(effectiveState.scheduleId)
      ) {
        result.set(effectiveState.scheduleId, true);
      }
    } catch {
      // skip devices that cannot resolve
    }
  }
  return result;
}
