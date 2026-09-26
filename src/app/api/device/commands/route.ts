import { NextRequest } from "next/server";
import {
  enforceRateLimit,
  handleApiError,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { authenticateDevice } from "@/services/devices";
import { claimDeviceCommands } from "@/services/device-commands";
import { cleanupExpiredCommandInbox } from "@/services/device-commands";

export async function GET(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, "device-commands-poll", 120, 60_000);
    if (limited) return limited;

    const device = await authenticateDevice(req.headers.get("authorization"));
    if (!device) return jsonError("UNAUTHORIZED", 401);
    if (!device.tenantId) return jsonError("UNAUTHORIZED", 401);

    // Lazy cleanup (bounded) — opportunistic
    void cleanupExpiredCommandInbox().catch(() => undefined);

    const commands = await claimDeviceCommands({
      deviceId: device.id,
      tenantId: device.tenantId,
    });

    return jsonOk(
      { commands },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return handleApiError(e);
  }
}
