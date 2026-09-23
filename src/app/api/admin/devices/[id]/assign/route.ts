import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { assignPlaylistToDevice } from "@/services/devices";

const schema = z.object({
  playlistId: z.string().uuid().nullable(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession("manage_devices");
    const { id } = await ctx.params;
    const body = schema.parse(await req.json());
    const result = await assignPlaylistToDevice(
      id,
      body.playlistId,
      session.tenantId,
      session.id,
    );
    return jsonOk(result);
  } catch (e) {
    return handleApiError(e);
  }
}
