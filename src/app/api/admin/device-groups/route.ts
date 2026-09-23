import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import {
  addDeviceToGroup,
  assignPlaylistToGroup,
  createDeviceGroup,
  createGroupSchema,
  listDeviceGroups,
  removeDeviceFromGroup,
  updateDeviceGroup,
  deleteDeviceGroup,
} from "@/services/device-groups";

export async function GET() {
  try {
    const session = await requireSession("manage_devices");
    const groups = await listDeviceGroups(session.tenantId);
    return jsonOk({ groups });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession("manage_devices");
    const json = await req.json();

    if (json.action === "add_member") {
      const body = z
        .object({
          action: z.literal("add_member"),
          groupId: z.string().uuid(),
          deviceId: z.string().uuid(),
        })
        .parse(json);
      await addDeviceToGroup(
        body.groupId,
        body.deviceId,
        session.tenantId,
        session.id,
      );
      return jsonOk({ ok: true });
    }

    if (json.action === "remove_member") {
      const body = z
        .object({
          action: z.literal("remove_member"),
          groupId: z.string().uuid(),
          deviceId: z.string().uuid(),
        })
        .parse(json);
      await removeDeviceFromGroup(
        body.groupId,
        body.deviceId,
        session.tenantId,
        session.id,
      );
      return jsonOk({ ok: true });
    }

    if (json.action === "assign_playlist") {
      const body = z
        .object({
          action: z.literal("assign_playlist"),
          groupId: z.string().uuid(),
          playlistId: z.string().uuid(),
        })
        .parse(json);
      const result = await assignPlaylistToGroup(
        body.groupId,
        body.playlistId,
        session.tenantId,
        session.id,
      );
      return jsonOk(result);
    }

    if (json.action === "update_group") {
      const body = z
        .object({
          action: z.literal("update_group"),
          groupId: z.string().uuid(),
          name: z.string().min(1).max(200).optional(),
          description: z.string().max(2000).optional().nullable(),
        })
        .parse(json);
      await updateDeviceGroup(
        body.groupId,
        { name: body.name, description: body.description },
        session.tenantId,
        session.id,
      );
      return jsonOk({ ok: true });
    }

    if (json.action === "delete_group") {
      const body = z
        .object({
          action: z.literal("delete_group"),
          groupId: z.string().uuid(),
        })
        .parse(json);
      await deleteDeviceGroup(
        body.groupId,
        session.tenantId,
        session.id,
      );
      return jsonOk({ ok: true });
    }

    const body = createGroupSchema.parse(json);
    const id = await createDeviceGroup(body, session.tenantId, session.id);
    return jsonOk({ id });
  } catch (e) {
    return handleApiError(e);
  }
}
