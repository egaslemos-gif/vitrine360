import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listDeviceObservability } from "@/services/devices";
import { handleApiError } from "@/lib/api";
import { assertNoAuthTokenExposure } from "@/domain/runtime-policy";

export const dynamic = "force-dynamic";

/**
 * Aggregated presence + runtime observability for the Devices admin list.
 * Single request — no N+1 per device.
 */
export async function GET() {
  try {
    const session = await requireSession("view_dashboard");
    const devices = await listDeviceObservability(session.tenantId);
    assertNoAuthTokenExposure(devices as unknown as Record<string, unknown>);
    return NextResponse.json({ devices });
  } catch (err: unknown) {
    console.error("Failed to query device presence:", err);
    return handleApiError(err);
  }
}
