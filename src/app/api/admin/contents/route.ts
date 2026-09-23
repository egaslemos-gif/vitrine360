import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import {
  createContent,
  createContentSchema,
  listContents,
  uploadMediaAsset,
} from "@/services/contents";

export async function GET() {
  try {
    const session = await requireSession("manage_contents");
    const items = await listContents(session.tenantId);
    return jsonOk({ contents: items });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession("manage_contents");
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return handleApiError(new Error("file required"));
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const asset = await uploadMediaAsset({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        data: buf,
        tenantId: session.tenantId,
        userId: session.id,
      });

      const type = String(form.get("type") ?? "IMAGE");
      const title = String(form.get("title") ?? file.name);
      const durationMs = Number(form.get("durationMs") ?? 10000);
      const status = String(form.get("status") ?? "ACTIVE");
      const descriptionRaw = form.get("description");
      const description =
        typeof descriptionRaw === "string" && descriptionRaw.trim()
          ? descriptionRaw
          : undefined;
      const id = await createContent(
        createContentSchema.parse({
          type,
          title,
          durationMs,
          status,
          description,
          payload: {},
          mediaAssetId: asset.id,
        }),
        session.tenantId,
        session.id,
      );
      return jsonOk({ id, mediaAssetId: asset.id });
    }

    const body = createContentSchema.parse(await req.json());
    const id = await createContent(body, session.tenantId, session.id);
    return jsonOk({ id });
  } catch (e) {
    return handleApiError(e);
  }
}
