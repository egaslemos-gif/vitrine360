import { NextRequest } from "next/server";
import { enforceRateLimit, handleApiError, jsonOk, jsonError } from "@/lib/api";
import { authenticateDevice } from "@/services/devices";
import { buildSyncDelta } from "@/services/manifest";

export async function GET(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, "device-sync", 120, 60_000);
    if (limited) return limited;
    const device = await authenticateDevice(
      req.headers.get("authorization"),
    );
    if (!device) return jsonError("Unauthorized", 401);
    const clientVersion = Number(
      req.nextUrl.searchParams.get("version") ?? "0",
    );
    const delta = await buildSyncDelta(device, clientVersion);
    return jsonOk(delta);
  } catch (e) {
    return handleApiError(e);
  }
}
