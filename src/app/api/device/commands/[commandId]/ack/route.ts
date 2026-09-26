import { NextRequest } from "next/server";
import { z } from "zod";
import {
  enforceRateLimit,
  handleApiError,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { ACK_RESULT_STATUSES } from "@/domain/command-transport";
import { authenticateDevice } from "@/services/devices";
import {
  acknowledgeDeviceCommand,
  DeviceCommandServiceError,
} from "@/services/device-commands";

const schema = z.object({
  status: z.enum(ACK_RESULT_STATUSES),
  sessionId: z.string().max(80).nullable().optional(),
  reason: z.string().max(80).nullable().optional(),
  observedAt: z.string().max(64).nullable().optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ commandId: string }> },
) {
  try {
    const limited = enforceRateLimit(req, "device-commands-ack", 180, 60_000);
    if (limited) return limited;

    const device = await authenticateDevice(req.headers.get("authorization"));
    if (!device || !device.tenantId) return jsonError("UNAUTHORIZED", 401);

    const { commandId } = await ctx.params;
    const body = schema.parse(await req.json());

    const result = await acknowledgeDeviceCommand({
      commandId,
      deviceId: device.id,
      tenantId: device.tenantId,
      status: body.status,
      sessionId: body.sessionId,
      reason: body.reason,
      observedAt: body.observedAt,
    });

    return jsonOk(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof DeviceCommandServiceError) {
      const status =
        e.code === "COMMAND_NOT_FOUND"
          ? 404
          : e.code === "WRONG_DEVICE"
            ? 403
            : e.code === "COMMAND_EXPIRED"
              ? 409
              : e.code === "INVALID_ACK"
                ? 422
                : 400;
      return jsonError(e.code, status);
    }
    return handleApiError(e);
  }
}
