import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  enforceRateLimit,
  handleApiError,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { DEVICE_COMMAND_TYPES } from "@/domain/device-command";
import { COMMAND_TRANSPORT } from "@/domain/command-transport";
import {
  DeviceCommandServiceError,
  enqueueDeviceCommand,
} from "@/services/device-commands";

const schema = z.object({
  type: z.enum(DEVICE_COMMAND_TYPES),
  payload: z.record(z.string(), z.unknown()).optional(),
  sessionId: z.string().max(80).nullable().optional(),
  binding: z.enum(["SESSION_BOUND", "DEVICE_BOUND"]).optional(),
  ttlMs: z.number().int().positive().optional(),
  correlationId: z.string().max(120).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const limited = enforceRateLimit(req, "admin-device-commands", 60, 60_000);
    if (limited) return limited;

    const session = await requireSession("manage_devices");
    const { id: deviceId } = await ctx.params;
    const body = schema.parse(await req.json());

    const result = await enqueueDeviceCommand({
      tenantId: session.tenantId,
      deviceId,
      userId: session.id,
      type: body.type,
      payload: (body.payload ?? {}) as never,
      sessionId: body.sessionId,
      binding: body.binding,
      ttlMs: body.ttlMs ?? COMMAND_TRANSPORT.DEFAULT_TTL_MS,
      correlationId: body.correlationId,
    });

    return jsonOk(result);
  } catch (e) {
    if (e instanceof DeviceCommandServiceError) {
      const status =
        e.code === "DEVICE_NOT_FOUND"
          ? 404
          : e.code === "DEVICE_NOT_OPERABLE" || e.code === "FORBIDDEN"
            ? 403
            : e.code === "INVALID_COMMAND" ||
                e.code === "INVALID_PAYLOAD" ||
                e.code === "COMMAND_TOO_LARGE"
              ? 422
              : 400;
      return jsonError(e.code, status);
    }
    return handleApiError(e);
  }
}
