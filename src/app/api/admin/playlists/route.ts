import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import {
  addPlaylistItem,
  createPlaylist,
  createPlaylistSchema,
  listPlaylists,
  reorderPlaylistItems,
  removePlaylistItem,
} from "@/services/playlists";

export async function GET() {
  try {
    const session = await requireSession("manage_playlists");
    const items = await listPlaylists(session.tenantId);
    return jsonOk({ playlists: items });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession("manage_playlists");
    const body = createPlaylistSchema.parse(await req.json());
    const id = await createPlaylist(body, session.tenantId, session.id);
    return jsonOk({ id });
  } catch (e) {
    return handleApiError(e);
  }
}

const itemSchema = z.object({
  action: z.literal("add_item"),
  playlistId: z.string().uuid(),
  contentId: z.string().uuid(),
  durationOverrideMs: z.number().int().positive().optional(),
});

const reorderSchema = z.object({
  action: z.literal("reorder"),
  playlistId: z.string().uuid(),
  orderedItemIds: z.array(z.string().uuid()),
});

const removeSchema = z.object({
  action: z.literal("remove_item"),
  playlistId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession("manage_playlists");
    const json = await req.json();
    if (json.action === "add_item") {
      const body = itemSchema.parse(json);
      const id = await addPlaylistItem({
        ...body,
        tenantId: session.tenantId,
        userId: session.id,
      });
      return jsonOk({ id });
    }
    if (json.action === "reorder") {
      const body = reorderSchema.parse(json);
      await reorderPlaylistItems(
        body.playlistId,
        body.orderedItemIds,
        session.tenantId,
        session.id,
      );
      return jsonOk({ ok: true });
    }
    if (json.action === "remove_item") {
      const body = removeSchema.parse(json);
      await removePlaylistItem(
        body.playlistId,
        body.itemId,
        session.tenantId,
        session.id,
      );
      return jsonOk({ ok: true });
    }
    throw new Error("Unknown action");
  } catch (e) {
    return handleApiError(e);
  }
}
