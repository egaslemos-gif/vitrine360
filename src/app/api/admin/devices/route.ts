import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { listDevicesWithPresence, pairDevice } from "@/services/devices";

export async function GET() {
  try {
    const session = await requireSession("manage_devices");
    const devices = await listDevicesWithPresence(session.tenantId);
    return jsonOk({ devices });
  } catch (e) {
    return handleApiError(e);
  }
}

const pairSchema = z.object({
  activationCode: z.string().length(6),
  name: z.string().min(1).max(120),
  location: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  deviceCode: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, numbers, hyphens"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession("manage_devices");
    const body = pairSchema.parse(await req.json());
    const result = await pairDevice({
      ...body,
      tenantId: session.tenantId,
      userId: session.id,
    });
    return jsonOk({
      deviceId: result.deviceId,
      paired: true,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
