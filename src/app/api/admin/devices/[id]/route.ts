import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";
import {
  rotateDeviceToken,
  setDeviceStatus,
  updateDevice,
  deleteDevice,
  getDeviceObservability,
} from "@/services/devices";
import { assertNoAuthTokenExposure } from "@/domain/runtime-policy";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_status"),
    status: z.enum(["ACTIVE", "DISABLED"]),
  }),
  z.object({
    action: z.literal("rotate_token"),
  }),
]);

/** Device detail + derived observability (tenant-scoped). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession("view_dashboard");
    const { id } = await ctx.params;
    const result = await getDeviceObservability(id, session.tenantId);
    if (!result) return jsonError("Not found", 404);
    assertNoAuthTokenExposure(result as unknown as Record<string, unknown>);
    return jsonOk(result);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession("manage_devices");
    const { id } = await ctx.params;
    const body = schema.parse(await req.json());
    if (body.action === "set_status") {
      await setDeviceStatus({
        deviceId: id,
        tenantId: session.tenantId,
        status: body.status,
        userId: session.id,
      });
      return jsonOk({ ok: true, status: body.status });
    }
    const result = await rotateDeviceToken({
      deviceId: id,
      tenantId: session.tenantId,
      userId: session.id,
    });
    // pairingSecret shown once so admin can re-claim on device if needed
    return jsonOk({ ok: true, pairingSecret: result.pairingSecret });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession("manage_devices");
    const { id } = await params;
    const body = await req.json();

    const result = await updateDevice(
      id,
      session.tenantId,
      {
        name: body.name,
        location: body.location,
        deviceCode: body.deviceCode,
      },
      session.id,
    );

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession("manage_devices");
    const { id } = await params;
    const result = await deleteDevice(id, session.tenantId, session.id);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
