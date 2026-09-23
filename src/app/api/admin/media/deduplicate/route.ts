import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { deduplicateMediaAssets } from "@/services/contents";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession("manage_contents");
    const deletedCount = await deduplicateMediaAssets(session.tenantId, session.id);
    return jsonOk({ ok: true, deletedCount });
  } catch (e) {
    return handleApiError(e);
  }
}
