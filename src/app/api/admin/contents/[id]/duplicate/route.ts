import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { duplicateContent } from "@/services/contents";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession("manage_contents");
    const { id } = await ctx.params;
    if (!id?.trim()) throw new Error("Content id required");
    const newId = await duplicateContent(id, session.tenantId, session.id);
    return jsonOk({ id: newId, sourceId: id });
  } catch (e) {
    return handleApiError(e);
  }
}
