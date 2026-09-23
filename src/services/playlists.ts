import { and, asc, eq, max, sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { contents, devices, playlistItems, playlists, schedules } from "@/db/schema";
import { logActivity } from "@/services/activity-log";
import {
  TRANSITIONS,
  assertTransition,
  parseTransition,
  type Transition,
} from "@/domain/types";
import { z } from "zod";

export const createPlaylistSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export const transitionSchema = z.enum(TRANSITIONS);

export const updatePlaylistItemSchema = z
  .object({
    durationOverrideMs: z.number().int().positive().nullable().optional(),
    transition: transitionSchema.optional(),
    fitMode: z.string().min(1).max(40).optional(),
  })
  .refine(
    (data) =>
      data.durationOverrideMs !== undefined ||
      data.transition !== undefined ||
      data.fitMode !== undefined,
    { message: "Nenhuma alteração fornecida" },
  );

export async function listPlaylists(tenantId: string) {
  return db.select().from(playlists).where(eq(playlists.tenantId, tenantId)).orderBy(asc(playlists.name));
}

export async function listPlaylistsWithUsage(tenantId: string) {
  // Use leftJoin to aggregate devices and schedules
  const rows = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      version: playlists.version,
      status: playlists.status,
      createdAt: playlists.createdAt,
      updatedAt: playlists.updatedAt,
      devicesCount: sql<number>`count(DISTINCT ${devices.id})`.mapWith(Number),
      schedulesCount: sql<number>`count(DISTINCT ${schedules.id})`.mapWith(Number),
    })
    .from(playlists)
    .leftJoin(devices, eq(devices.currentPlaylistId, playlists.id))
    .leftJoin(schedules, eq(schedules.playlistId, playlists.id))
    .where(eq(playlists.tenantId, tenantId))
    .groupBy(playlists.id)
    .orderBy(asc(playlists.name));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    version: r.version,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    inUse: r.devicesCount > 0 || r.schedulesCount > 0,
  }));
}

export async function createPlaylist(
  input: z.infer<typeof createPlaylistSchema>,
  tenantId: string,
  userId?: string,
) {
  const id = crypto.randomUUID();
  await db.insert(playlists).values({
    id,
    name: input.name,
    description: input.description ?? null,
    tenantId,
  });
  await logActivity({
    userId,
    tenantId,
    action: "playlist.created",
    resource: "playlist",
    resourceId: id,
  });
  return id;
}

export async function updatePlaylistDetails(
  playlistId: string,
  input: z.infer<typeof createPlaylistSchema>,
  tenantId: string,
  userId?: string,
) {
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.tenantId, tenantId)))
    .limit(1);
  if (!playlist) throw new Error("Playlist not found");

  await db
    .update(playlists)
    .set({
      name: input.name,
      description: input.description ?? null,
    })
    .where(eq(playlists.id, playlistId));

  await bumpPlaylistVersion(playlistId, tenantId);
  await logActivity({
    userId,
    tenantId,
    action: "playlist.updated",
    resource: "playlist",
    resourceId: playlistId,
  });
}

export async function getPlaylistWithItems(
  playlistId: string,
  tenantId: string,
) {
  await ensureSchema();
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.tenantId, tenantId)))
    .limit(1);
  if (!playlist) return null;
  const items = await db
    .select()
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(asc(playlistItems.position));
  return {
    ...playlist,
    items: items.map((item) => ({
      ...item,
      transition: parseTransition(item.transition),
    })),
  };
}

export async function addPlaylistItem(params: {
  playlistId: string;
  contentId: string;
  tenantId: string;
  durationOverrideMs?: number;
  transition?: Transition | string;
  userId?: string;
}) {
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(
      and(
        eq(playlists.id, params.playlistId),
        eq(playlists.tenantId, params.tenantId),
      ),
    )
    .limit(1);
  if (!playlist) throw new Error("Playlist not found");

  const [content] = await db
    .select()
    .from(contents)
    .where(
      and(
        eq(contents.id, params.contentId),
        eq(contents.tenantId, params.tenantId),
      ),
    )
    .limit(1);
  if (!content) throw new Error("Content not found");

  const transition =
    params.transition !== undefined
      ? assertTransition(params.transition)
      : ("fade" satisfies Transition);

  const [{ value: maxPos }] = await db
    .select({ value: max(playlistItems.position) })
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, params.playlistId));

  const id = crypto.randomUUID();
  await db.insert(playlistItems).values({
    id,
    playlistId: params.playlistId,
    contentId: params.contentId,
    position: (maxPos ?? -1) + 1,
    durationOverrideMs: params.durationOverrideMs ?? null,
    transition,
  });

  await bumpPlaylistVersion(params.playlistId, params.tenantId);
  await logActivity({
    userId: params.userId,
    tenantId: params.tenantId,
    action: "playlist.item_added",
    resource: "playlist",
    resourceId: params.playlistId,
    metadata: { contentId: params.contentId },
  });
  return id;
}

export async function reorderPlaylistItems(
  playlistId: string,
  orderedItemIds: string[],
  tenantId: string,
  userId?: string,
) {
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.tenantId, tenantId)))
    .limit(1);
  if (!playlist) throw new Error("Playlist not found");

  for (let i = 0; i < orderedItemIds.length; i++) {
    await db
      .update(playlistItems)
      .set({ position: i })
      .where(
        and(
          eq(playlistItems.id, orderedItemIds[i]!),
          eq(playlistItems.playlistId, playlistId),
        ),
      );
  }
  await bumpPlaylistVersion(playlistId, tenantId);
  await logActivity({
    userId,
    tenantId,
    action: "playlist.reordered",
    resource: "playlist",
    resourceId: playlistId,
  });
}

export async function removePlaylistItem(
  playlistId: string,
  itemId: string,
  tenantId: string,
  userId?: string,
) {
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.tenantId, tenantId)))
    .limit(1);
  if (!playlist) throw new Error("Playlist not found");

  await db
    .delete(playlistItems)
    .where(
      and(
        eq(playlistItems.id, itemId),
        eq(playlistItems.playlistId, playlistId),
      ),
    );

  await bumpPlaylistVersion(playlistId, tenantId);
  await logActivity({
    userId,
    tenantId,
    action: "playlist.item_removed",
    resource: "playlist",
    resourceId: playlistId,
    metadata: { itemId },
  });
}

export async function updatePlaylistItem(
  playlistId: string,
  itemId: string,
  updates: {
    durationOverrideMs?: number | null;
    transition?: string;
    fitMode?: string;
  },
  tenantId: string,
  userId?: string,
) {
  const parsed = updatePlaylistItemSchema.parse(updates);

  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.tenantId, tenantId)))
    .limit(1);
  if (!playlist) throw new Error("Playlist not found");

  const patch: {
    durationOverrideMs?: number | null;
    transition?: Transition;
    fitMode?: string;
  } = {};
  if (parsed.durationOverrideMs !== undefined) {
    patch.durationOverrideMs = parsed.durationOverrideMs;
  }
  if (parsed.transition !== undefined) {
    patch.transition = parsed.transition;
  }
  if (parsed.fitMode !== undefined) {
    patch.fitMode = parsed.fitMode;
  }

  await db
    .update(playlistItems)
    .set(patch)
    .where(
      and(
        eq(playlistItems.id, itemId),
        eq(playlistItems.playlistId, playlistId),
      ),
    );

  await bumpPlaylistVersion(playlistId, tenantId);
  await logActivity({
    userId,
    tenantId,
    action: "playlist.item_updated",
    resource: "playlist",
    resourceId: playlistId,
    metadata: { itemId, ...patch },
  });
}

export async function bumpPlaylistVersion(
  playlistId: string,
  tenantId?: string,
) {
  const [row] = await db
    .select()
    .from(playlists)
    .where(
      tenantId
        ? and(eq(playlists.id, playlistId), eq(playlists.tenantId, tenantId))
        : eq(playlists.id, playlistId),
    )
    .limit(1);
  if (!row) return;
  await db
    .update(playlists)
    .set({
      version: row.version + 1,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(playlists.id, playlistId));

  const linked = await db
    .select()
    .from(devices)
    .where(eq(devices.currentPlaylistId, playlistId));
  const now = new Date().toISOString();
  for (const device of linked) {
    await db
      .update(devices)
      .set({
        manifestVersion: device.manifestVersion + 1,
        effectivePlaybackKey: null,
        updatedAt: now,
      })
      .where(eq(devices.id, device.id));
  }
}

export async function duplicatePlaylist(
  playlistId: string,
  tenantId: string,
  userId?: string,
) {
  const full = await getPlaylistWithItems(playlistId, tenantId);
  if (!full) throw new Error("Playlist not found");
  const newId = crypto.randomUUID();
  await db.insert(playlists).values({
    id: newId,
    name: `${full.name} (copy)`,
    description: full.description,
    tenantId,
  });
  for (const item of full.items) {
    await db.insert(playlistItems).values({
      id: crypto.randomUUID(),
      playlistId: newId,
      contentId: item.contentId,
      position: item.position,
      durationOverrideMs: item.durationOverrideMs,
      active: item.active,
      transition: item.transition,
    });
  }
  await logActivity({
    userId,
    tenantId,
    action: "playlist.duplicated",
    resource: "playlist",
    resourceId: newId,
    metadata: { from: playlistId },
  });
  return newId;
}

export async function deletePlaylist(
  playlistId: string,
  tenantId: string,
  userId?: string,
) {
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.tenantId, tenantId)))
    .limit(1);
  if (!playlist) throw new Error("Playlist not found");

  // 1. Safety Check: Active Devices
  const activeDevices = await db
    .select({ name: devices.name })
    .from(devices)
    .where(eq(devices.currentPlaylistId, playlistId))
    .limit(1);
    
  if (activeDevices.length > 0) {
    throw new Error(`A playlist está atualmente atribuída ao dispositivo "${activeDevices[0].name || 'Desconhecido'}". Atribua outra playlist antes de eliminar esta.`);
  }

  // (Legacy deviceAssignments check removed as it is deprecated and prevented deletion)

  // 3. Safety Check: Schedules
  const activeSchedules = await db
    .select({ name: schedules.name })
    .from(schedules)
    .where(eq(schedules.playlistId, playlistId))
    .limit(1);

  if (activeSchedules.length > 0) {
    throw new Error(`A playlist está a ser utilizada no agendamento "${activeSchedules[0].name}". Remova o agendamento primeiro.`);
  }

  // 4. Delete items and playlist
  // Manually delete items first to be safe (in case PRAGMA foreign_keys is OFF)
  await db.delete(playlistItems).where(eq(playlistItems.playlistId, playlistId));
  await db.delete(playlists).where(eq(playlists.id, playlistId));

  await logActivity({
    userId,
    tenantId,
    action: "playlist.deleted",
    resource: "playlist",
    resourceId: playlistId,
  });
}
