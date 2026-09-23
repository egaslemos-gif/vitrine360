import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { deleteMediaAsset } from "@/services/contents";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession("manage_contents");
    const { id } = await ctx.params;
    if (!id?.trim()) {
      throw new Error("Media asset id required");
    }
    await deleteMediaAsset(id, session.tenantId, session.id);
    return jsonOk({ ok: true, id });
  } catch (e) {
    return handleApiError(e);
  }
}
