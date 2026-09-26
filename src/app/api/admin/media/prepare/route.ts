import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { prepareMediaUpload } from "@/services/contents";

const bodySchema = z.object({
  fileName: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(128),
  fileSize: z.number().int().positive(),
  checksum: z.string().min(64).max(80),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession("manage_contents");
    const body = bodySchema.parse(await req.json());
    const result = await prepareMediaUpload({
      fileName: body.fileName,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      checksum: body.checksum,
      tenantId: session.tenantId,
    });

    if (result.existing) {
      return jsonOk({
        existing: true,
        asset: {
          id: result.asset.id,
          fileName: result.asset.fileName,
          mimeType: result.asset.mimeType,
          fileSize: result.asset.fileSize,
          url: result.asset.url,
          checksum: result.asset.checksum,
        },
      });
    }

    return jsonOk({
      existing: false,
      assetId: result.assetId,
      storageKey: result.storageKey,
      uploadUrl: result.uploadUrl,
      expiresIn: result.expiresIn,
      mimeType: result.mimeType,
      fileSize: result.fileSize,
      contentLength: result.contentLength,
      requiredHeaders: result.requiredHeaders,
      checksum: result.checksum,
      fileName: result.fileName,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
