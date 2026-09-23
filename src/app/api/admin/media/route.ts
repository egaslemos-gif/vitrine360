import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { listMediaAssets, uploadMediaAsset } from "@/services/contents";

export async function GET() {
  try {
    const session = await requireSession("manage_contents");
    const assets = await listMediaAssets(session.tenantId);
    return jsonOk({ assets });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession("manage_contents");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Error("file required");
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const asset = await uploadMediaAsset({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      data: buf,
      tenantId: session.tenantId,
      userId: session.id,
    });
    return jsonOk(asset);
  } catch (e) {
    return handleApiError(e);
  }
}
