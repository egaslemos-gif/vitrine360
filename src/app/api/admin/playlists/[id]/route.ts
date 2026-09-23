import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { deletePlaylist } from "@/services/playlists";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession("manage_playlists");
    const { id } = await params;
    await deletePlaylist(id, session.tenantId, session.id);
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
