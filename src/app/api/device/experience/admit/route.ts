import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";
import { authenticateDevice } from "@/services/devices";
import { getStoredExperiencePackage } from "@/services/experience-package-store";
import {
  admitExperienceForDevice,
  type ExperienceDeviceAssignment,
} from "@/domain/experience-admission";
import {
  DEFAULT_EXPERIENCE_PERMISSIONS,
  type ExperiencePermissions,
} from "@/domain/experience-manifest";
import {
  defaultPolicyFromDeviceConfig,
  UNKNOWN_CAPABILITIES,
  type DetectedRuntimeCapabilities,
} from "@/domain/runtime-policy";

/**
 * RUNTIME-EXPERIENCE-11 — Device admission gate for Player Experience playback.
 *
 * Bearer device auth only. Never returns JWT/device token to the Experience.
 * Package lookup stays server-side (in-memory store). Fail closed.
 */

const detectedSchema = z
  .object({
    video: z.boolean().optional(),
    image: z.boolean().optional(),
    gif: z.boolean().optional(),
    touch: z.boolean().optional(),
    pointer: z.boolean().optional(),
    keyboard: z.boolean().optional(),
    remote: z.boolean().optional(),
    fullscreen: z.boolean().optional(),
    orientation: z.boolean().optional(),
    network: z.boolean().optional(),
    serviceWorker: z.boolean().optional(),
    indexedDB: z.boolean().optional(),
  })
  .optional();

const bodySchema = z.object({
  experienceId: z.string().min(1).max(128),
  version: z.string().min(1).max(64),
  detected: detectedSchema,
});

function mergeDetected(
  partial?: z.infer<typeof detectedSchema>,
): DetectedRuntimeCapabilities {
  return {
    ...UNKNOWN_CAPABILITIES,
    image: true,
    video: true,
    ...partial,
  };
}

/**
 * EX-11 conceptual assignment: playlist-eligible published package for this device.
 * No ExperienceAssignment table — revoked=false; permissions from package defaults ∩ safe keys.
 */
function conceptualAssignment(params: {
  tenantId: string;
  deviceId: string;
  experienceId: string;
  version: string;
  packagePermissions: ExperiencePermissions;
}): ExperienceDeviceAssignment {
  return {
    tenantId: params.tenantId,
    deviceId: params.deviceId,
    experienceId: params.experienceId,
    version: params.version,
    grantedPermissions: {
      ...DEFAULT_EXPERIENCE_PERMISSIONS,
      ...params.packagePermissions,
      // EX-11: never grant elevated surfaces via assignment
      network: false,
      camera: false,
      microphone: false,
      offlineStorage: false,
      fullscreen: false,
      orientation: false,
    },
    revoked: false,
    allowFullNetwork: false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const device = await authenticateDevice(req.headers.get("authorization"));
    if (!device) {
      return jsonError("Unauthorized", 401);
    }
    if (!device.tenantId) {
      return jsonError("Device has no tenant", 403);
    }

    const body = bodySchema.parse(await req.json());
    const stored = getStoredExperiencePackage(
      device.tenantId,
      body.experienceId,
      body.version,
    );
    const record = stored?.record ?? null;
    const packagePermissions =
      record?.manifestSnapshot?.permissions ?? DEFAULT_EXPERIENCE_PERMISSIONS;

    const domainPolicy = defaultPolicyFromDeviceConfig({
      interactionMode:
        device.interactionMode === "TOUCH" ||
        device.interactionMode === "QR" ||
        device.interactionMode === "HYBRID"
          ? device.interactionMode
          : "PASSIVE",
      displayType:
        device.displayType === "TV" ||
        device.displayType === "TOUCH_DISPLAY" ||
        device.displayType === "LED" ||
        device.displayType === "KIOSK" ||
        device.displayType === "VIDEO_WALL" ||
        device.displayType === "TABLET"
          ? device.displayType
          : "OTHER",
      orientationStored: device.orientation ?? "auto",
    });

    const decision = admitExperienceForDevice({
      tenantId: device.tenantId,
      experienceId: body.experienceId,
      version: body.version,
      record,
      assignment: record
        ? conceptualAssignment({
            tenantId: device.tenantId,
            deviceId: device.id,
            experienceId: body.experienceId,
            version: body.version,
            packagePermissions,
          })
        : null,
      device: {
        tenantId: device.tenantId,
        deviceId: device.id,
        status: device.status,
        domainPolicy,
        detected: mergeDetected(body.detected),
      },
    });

    // Safe response: grant snapshot only — no tokens, no package bytes, no secrets.
    return jsonOk({ decision });
  } catch (e) {
    return handleApiError(e);
  }
}
