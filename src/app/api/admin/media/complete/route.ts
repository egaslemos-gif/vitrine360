import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { completeMediaUpload } from "@/services/contents";

const bodySchema = z.object({
  assetId: z.string().uuid(),
  fileName: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(128),
  fileSize: z.number().int().positive(),
  checksum: z.string().min(64).max(80),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession("manage_contents");
    const body = bodySchema.parse(await req.json());
    const asset = await completeMediaUpload({
      assetId: body.assetId,
      fileName: body.fileName,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      checksum: body.checksum,
      tenantId: session.tenantId,
      userId: session.id,
    });
    return jsonOk({
      id: asset.id,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      url: asset.url,
      checksum: asset.checksum,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
