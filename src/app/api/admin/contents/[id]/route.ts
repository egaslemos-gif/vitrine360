import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { updateContent, deleteContent, updateContentSchema } from "@/services/contents";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession("manage_contents");
    const id = (await params).id;
    const body = updateContentSchema.parse(await req.json());
    
    await updateContent(id, body, session.tenantId, session.id);
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession("manage_contents");
    const id = (await params).id;
    
    await deleteContent(id, session.tenantId, session.id);
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
