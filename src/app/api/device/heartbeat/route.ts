import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";
import {
  authenticateDevice,
  recordHeartbeat,
  toPublicDeviceConfigSlice,
} from "@/services/devices";

const schema = z.object({
  timestamp: z.string().optional(),
  playerVersion: z.string().optional(),
  playlistId: z.string().optional(),
  contentId: z.string().optional(),
  playerState: z.string().optional(),
  resolution: z.string().optional(),
  /** Observational Runtime State subset — never used for authorization. */
  runtimeState: z
    .object({
      isPlaying: z.boolean().optional(),
      currentContentId: z.string().nullable().optional(),
      currentManifestVersion: z.number().nullable().optional(),
      syncState: z.string().optional(),
      networkState: z.string().optional(),
      cursorVisible: z.boolean().optional(),
      fullscreenActive: z.boolean().optional(),
      fullscreenStatus: z.string().optional(),
      fullscreenDiagnosticCode: z.string().nullable().optional(),
      orientationActual: z.string().optional(),
      orientationStatus: z.string().optional(),
      orientationDiagnosticCode: z.string().nullable().optional(),
      lastInputAt: z.number().nullable().optional(),
      lastInputClass: z.string().nullable().optional(),
    })
    .optional(),
  /** Policy snapshot for admin observability — optional / backward-compatible. */
  policy: z
    .object({
      policySource: z.string().optional(),
      requested: z.record(z.string(), z.unknown()).optional(),
      resolved: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  diagnostics: z
    .array(
      z.object({
        code: z.string(),
        severity: z.enum(["INFO", "WARNING", "ERROR"]).optional(),
        message: z.string().optional(),
      }),
    )
    .optional(),
  observedAt: z.string().optional(),
  /** Client session id — observational only. */
  sessionId: z.string().max(80).optional(),
  /** Compact PlaybackObservation — OBSERVED, never command authority. */
  playback: z
    .object({
      status: z.string().optional(),
      contentId: z.string().nullable().optional(),
      contentType: z.string().nullable().optional(),
      playlistId: z.string().nullable().optional(),
      playlistItemId: z.string().nullable().optional(),
      generation: z.number().optional(),
      positionMs: z.number().optional(),
      durationMs: z.number().nullable().optional(),
      errorCode: z.string().nullable().optional(),
      observedAt: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const device = await authenticateDevice(
      req.headers.get("authorization"),
    );
    if (!device) {
      console.warn("[device] heartbeat unauthorized");
      return jsonError("Unauthorized", 401);
    }
    const body = schema.parse(await req.json());
    const result = await recordHeartbeat({
      deviceId: device.id,
      ...body,
    });
    return jsonOk({
      ...result,
      manifestVersion: device.manifestVersion,
      /** Existing Device row fields for Runtime Policy — not a new table. */
      deviceConfig: toPublicDeviceConfigSlice(device),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
