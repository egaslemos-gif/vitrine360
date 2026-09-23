import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  deviceAssignments,
  deviceGroupMembers,
  deviceGroups,
  devices,
  playlists,
} from "@/db/schema";
import { logActivity } from "@/services/activity-log";
import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export async function listDeviceGroups(tenantId: string) {
  const groups = await db
    .select()
    .from(deviceGroups)
    .where(eq(deviceGroups.tenantId, tenantId));
  const result = [];
  for (const g of groups) {
    const members = await db
      .select()
      .from(deviceGroupMembers)
      .where(eq(deviceGroupMembers.groupId, g.id));
    result.push({ ...g, memberIds: members.map((m) => m.deviceId) });
  }
  return result;
}

export async function createDeviceGroup(
  input: z.infer<typeof createGroupSchema>,
  tenantId: string,
  userId?: string,
) {
  const id = crypto.randomUUID();
  await db.insert(deviceGroups).values({
    id,
    name: input.name,
    description: input.description ?? null,
    tenantId,
  });
  await logActivity({
    userId,
    tenantId,
    action: "device_group.created",
    resource: "device_group",
    resourceId: id,
  });
  return id;
}

export async function addDeviceToGroup(
  groupId: string,
  deviceId: string,
  tenantId: string,
  userId?: string,
) {
  const [group] = await db
    .select()
    .from(deviceGroups)
    .where(and(eq(deviceGroups.id, groupId), eq(deviceGroups.tenantId, tenantId)))
    .limit(1);
  if (!group) throw new Error("Group not found");

  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId)))
    .limit(1);
  if (!device) throw new Error("Device not found");

  await db
    .insert(deviceGroupMembers)
    .values({ groupId, deviceId })
    .onConflictDoNothing();
  await logActivity({
    userId,
    tenantId,
    action: "device_group.member_added",
    resource: "device_group",
    resourceId: groupId,
    metadata: { deviceId },
  });
}

export async function removeDeviceFromGroup(
  groupId: string,
  deviceId: string,
  tenantId: string,
  userId?: string,
) {
  const [group] = await db
    .select()
    .from(deviceGroups)
    .where(and(eq(deviceGroups.id, groupId), eq(deviceGroups.tenantId, tenantId)))
    .limit(1);
  if (!group) throw new Error("Group not found");

  await db
    .delete(deviceGroupMembers)
    .where(
      and(
        eq(deviceGroupMembers.groupId, groupId),
        eq(deviceGroupMembers.deviceId, deviceId),
      ),
    );
  await logActivity({
    userId,
    tenantId,
    action: "device_group.member_removed",
    resource: "device_group",
    resourceId: groupId,
    metadata: { deviceId },
  });
}

export async function assignPlaylistToGroup(
  groupId: string,
  playlistId: string,
  tenantId: string,
  userId?: string,
) {
  const [group] = await db
    .select()
    .from(deviceGroups)
    .where(and(eq(deviceGroups.id, groupId), eq(deviceGroups.tenantId, tenantId)))
    .limit(1);
  if (!group) throw new Error("Group not found");

  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.tenantId, tenantId)))
    .limit(1);
  if (!playlist) throw new Error("Playlist not found");

  const assignmentId = crypto.randomUUID();
  await db.insert(deviceAssignments).values({
    id: assignmentId,
    deviceGroupId: groupId,
    playlistId,
    priority: 0,
  });

  const members = await db
    .select()
    .from(deviceGroupMembers)
    .where(eq(deviceGroupMembers.groupId, groupId));

  const now = new Date().toISOString();
  for (const m of members) {
    const [device] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.id, m.deviceId), eq(devices.tenantId, tenantId)))
      .limit(1);
    if (!device) continue;
    await db
      .update(devices)
      .set({
        currentPlaylistId: playlistId,
        manifestVersion: device.manifestVersion + 1,
        effectivePlaybackKey: null,
        updatedAt: now,
      })
      .where(eq(devices.id, device.id));
  }

  await logActivity({
    userId,
    tenantId,
    action: "device_group.assign_playlist",
    resource: "device_group",
    resourceId: groupId,
    metadata: { playlistId, devices: members.length },
  });

  return { assignmentId, devicesUpdated: members.length };
}

export async function updateDeviceGroup(
  groupId: string,
  data: { name?: string; description?: string | null },
  tenantId: string,
  userId?: string,
) {
  const [group] = await db
    .select()
    .from(deviceGroups)
    .where(and(eq(deviceGroups.id, groupId), eq(deviceGroups.tenantId, tenantId)))
    .limit(1);
  if (!group) throw new Error("Group not found");

  await db
    .update(deviceGroups)
    .set({ 
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      updatedAt: new Date().toISOString()
    })
    .where(eq(deviceGroups.id, groupId));

  await logActivity({
    userId,
    tenantId,
    action: "device_group.updated",
    resource: "device_group",
    resourceId: groupId,
    metadata: { oldName: group.name, newData: data },
  });
}

export async function deleteDeviceGroup(
  groupId: string,
  tenantId: string,
  userId?: string,
) {
  const [group] = await db
    .select()
    .from(deviceGroups)
    .where(and(eq(deviceGroups.id, groupId), eq(deviceGroups.tenantId, tenantId)))
    .limit(1);
  if (!group) throw new Error("Group not found");

  await db
    .delete(deviceGroupMembers)
    .where(eq(deviceGroupMembers.groupId, groupId));
  
  await db
    .delete(deviceAssignments)
    .where(eq(deviceAssignments.deviceGroupId, groupId));

  await db
    .delete(deviceGroups)
    .where(eq(deviceGroups.id, groupId));

  await logActivity({
    userId,
    tenantId,
    action: "device_group.deleted",
    resource: "device_group",
    resourceId: groupId,
    metadata: { name: group.name },
  });
}
