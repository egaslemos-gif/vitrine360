import { NextRequest } from "next/server";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";
import { authenticateDevice } from "@/services/devices";
import { buildDeviceManifest } from "@/services/manifest";

export async function GET(req: NextRequest) {
  try {
    const device = await authenticateDevice(
      req.headers.get("authorization"),
    );
    if (!device) return jsonError("Unauthorized", 401);

    const clientVersion = Number(
      req.nextUrl.searchParams.get("version") ?? "-1",
    );
    if (clientVersion === device.manifestVersion) {
      return new Response(null, { status: 304 });
    }

    const manifest = await buildDeviceManifest(device);
    return jsonOk(manifest);
  } catch (e) {
    return handleApiError(e);
  }
}
