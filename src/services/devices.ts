import { and, eq, gt, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  contentAssets,
  devices,
  mediaAssets,
  playlists,
  contents,
  playlistItems,
} from "@/db/schema";
import {
  generateActivationCode,
  generateDeviceToken,
  generatePairingSecret,
  hashToken,
} from "@/lib/auth";
import { logActivity } from "@/services/activity-log";
import { 
  derivePresence, 
  DEVICE_PRESENCE_ONLINE_WINDOW_MS, 
  DEVICE_PRESENCE_AWAY_WINDOW_MS 
} from "@/domain/types";
import {
  toDevicePolicyConfigWire,
  type DevicePolicyConfigWire,
} from "@/domain/runtime-policy";

const ACTIVATION_TTL_MS = 15 * 60 * 1000;
const DEVICE_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_PLAYLIST_NAME = "Playlist Padrão";

type DeviceRow = typeof devices.$inferSelect;

/**
 * Public Device fields used by Runtime Policy enrichment.
 * Never includes tokens, pairing secrets, or hashes.
 */
export type PublicDeviceConfigSlice = DevicePolicyConfigWire;

export function toPublicDeviceConfigSlice(device: {
  id: string;
  tenantId: string | null;
  displayType: string;
  interactionMode: string;
  orientation: string;
  timezone: string | null;
  status: string;
}): PublicDeviceConfigSlice {
  return toDevicePolicyConfigWire(device);
}

/** Tenant playlist used for every newly associated screen. */
export async function getOrCreateDefaultPlaylistId(tenantId: string) {
  const [defaultPlaylist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.name, DEFAULT_PLAYLIST_NAME), eq(playlists.tenantId, tenantId)))
    .limit(1);

  if (defaultPlaylist) return defaultPlaylist.id;

  const playlistId = crypto.randomUUID();
  const contentId = crypto.randomUUID();
  const [defaultVideoAsset] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.tenantId, tenantId),
        like(mediaAssets.mimeType, "video/%"),
      ),
    )
    .limit(1);

  await db.insert(contents).values({
    id: contentId,
    type: defaultVideoAsset ? "VIDEO" : "TEXT",
    title: defaultVideoAsset ? "Vídeo de Demonstração" : "Vitrine360 pronta",
    status: "ACTIVE",
    payload: defaultVideoAsset
      ? "{}"
      : JSON.stringify({ body: "Associe conteúdo para iniciar a apresentação." }),
    durationMs: 10000,
    tenantId,
  });

  if (defaultVideoAsset) {
    await db.insert(contentAssets).values({
      contentId,
      mediaAssetId: defaultVideoAsset.id,
      role: "primary",
    });
  }

  await db.insert(playlists).values({
    id: playlistId,
    name: DEFAULT_PLAYLIST_NAME,
    description: "Criada automaticamente. Edite ou remova esta playlist.",
    tenantId,
  });

  await db.insert(playlistItems).values({
    id: crypto.randomUUID(),
    playlistId,
    contentId,
    position: 0,
    transition: "fade",
  });

  return playlistId;
}

/**
 * Active screens must always have the default playlist.
 * Bumps manifestVersion so a player stuck on the empty state refetches.
 */
export async function ensureDefaultPlaylistAssigned(device: DeviceRow) {
  if (!device.tenantId || device.status !== "ACTIVE" || device.currentPlaylistId) {
    return device;
  }

  const playlistId = await getOrCreateDefaultPlaylistId(device.tenantId);
  const now = new Date().toISOString();
  const nextVersion = (device.manifestVersion ?? 0) + 1;
  const updated = await db
    .update(devices)
    .set({
      currentPlaylistId: playlistId,
      manifestVersion: nextVersion,
      effectivePlaybackKey: null,
      updatedAt: now,
    })
    .where(and(eq(devices.id, device.id), isNull(devices.currentPlaylistId)))
    .returning();

  if (!updated.length) {
    const [fresh] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, device.id))
      .limit(1);
    return fresh ?? device;
  }

  return updated[0];
}

export async function assignMissingDefaultPlaylists(tenantId: string) {
  const rows = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.tenantId, tenantId),
        eq(devices.status, "ACTIVE"),
        isNull(devices.currentPlaylistId),
      ),
    );

  for (const device of rows) {
    await ensureDefaultPlaylistAssigned(device);
  }
}

export function getHeartbeatWindows() {
  return {
    onlineWindowMs: Number(process.env.HEARTBEAT_ONLINE_WINDOW_MS ?? DEVICE_PRESENCE_ONLINE_WINDOW_MS),
    awayWindowMs: Number(process.env.HEARTBEAT_AWAY_WINDOW_MS ?? DEVICE_PRESENCE_AWAY_WINDOW_MS),
  };
}

export async function startDevicePairing(params: {
  clientId: string;
  pairingSecret: string;
} = {
  clientId: crypto.randomUUID(),
  pairingSecret: generatePairingSecret(),
}) {
  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.pairingClientId, params.clientId),
        eq(devices.status, "PENDING"),
        or(
          isNull(devices.activationExpiresAt),
          gt(devices.activationExpiresAt, now),
        ),
      ),
    )
    .limit(1);

  if (existing[0]) {
    if (existing[0].pairingSecretHash !== hashToken(params.pairingSecret)) {
      throw new Error("Pairing already in progress for this TV");
    }
    if (!existing[0].activationCode) {
      throw new Error("Pairing record is incomplete");
    }
    return {
      deviceId: existing[0].id,
      activationCode: existing[0].activationCode,
      pairingSecret: params.pairingSecret,
      expiresAt: existing[0].activationExpiresAt,
      reused: true,
    };
  }

  const activationCode = generateActivationCode();
  const pairingSecret = params.pairingSecret;
  const expires = new Date(Date.now() + ACTIVATION_TTL_MS).toISOString();
  const id = crypto.randomUUID();
  await db.insert(devices).values({
    id,
    status: "PENDING",
    activationCode,
    activationExpiresAt: expires,
    pairingClientId: params.clientId,
    pairingSecretHash: hashToken(pairingSecret),
    tenantId: null,
  });
  return {
    deviceId: id,
    activationCode,
    pairingSecret,
    expiresAt: expires,
  };
}

export async function pairDevice(params: {
  activationCode: string;
  name: string;
  location?: string;
  description?: string;
  deviceCode: string;
  tenantId: string;
  userId?: string;
}) {
  const now = new Date().toISOString();
  const [device] = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.activationCode, params.activationCode),
        eq(devices.status, "PENDING"),
        or(
          isNull(devices.activationExpiresAt),
          gt(devices.activationExpiresAt, now),
        ),
      ),
    )
    .limit(1);

  if (!device) {
    throw new Error("Invalid or expired activation code");
  }

  const existing = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.deviceCode, params.deviceCode),
        eq(devices.tenantId, params.tenantId),
      ),
    )
    .limit(1);
  if (existing.length) {
    throw new Error("Device code already in use");
  }

  const defaultPlaylistId = await getOrCreateDefaultPlaylistId(params.tenantId);

  // 2. Activate device — bump manifestVersion so the first sync actually
  // delivers the default playlist (fresh players report version -1/0).
  const result = await db
    .update(devices)
    .set({
      name: params.name,
      location: params.location ?? null,
      description: params.description ?? null,
      deviceCode: params.deviceCode,
      status: "ACTIVE",
      currentPlaylistId: defaultPlaylistId,
      manifestVersion: device.manifestVersion + 1,
      activationCode: null,
      activationExpiresAt: null,
      tenantId: params.tenantId,
      updatedAt: now,
    })
    .where(and(eq(devices.id, device.id), eq(devices.status, "PENDING")))
    .returning({ id: devices.id });

  if (!result.length) {
    throw new Error("Device already paired");
  }

  await logActivity({
    userId: params.userId,
    tenantId: params.tenantId,
    action: "device.paired",
    resource: "device",
    resourceId: device.id,
    metadata: { deviceCode: params.deviceCode },
  });

  return { deviceId: device.id };
}

export async function bootstrapByActivationCode(activationCode: string) {
  const now = new Date().toISOString();
  const [pending] = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.activationCode, activationCode),
        or(
          isNull(devices.activationExpiresAt),
          gt(devices.activationExpiresAt, now),
        ),
      ),
    )
    .limit(1);

  if (pending) {
    return {
      status: "PENDING" as const,
      deviceId: pending.id,
      paired: false as const,
    };
  }

  return null;
}

/**
 * Issue device token once after admin pairing.
 * Requires pairingSecret from pair_start (not guessable from deviceId alone).
 */
export async function bootstrapClaim(deviceId: string, pairingSecret: string) {
  const [device] = await db
    .select()
    .from(devices)
    .where(eq(devices.id, deviceId))
    .limit(1);
  if (!device) return { status: "NOT_FOUND" as const };
  if (!device.pairingSecretHash) {
    return {
      status: "ACTIVE_NO_TOKEN" as const,
      deviceId,
      deviceConfig: toPublicDeviceConfigSlice(device),
    };
  }
  if (hashToken(pairingSecret) !== device.pairingSecretHash) {
    return { status: "FORBIDDEN" as const };
  }
  if (device.status === "PENDING") {
    return {
      status: "PENDING" as const,
      deviceId,
      deviceConfig: toPublicDeviceConfigSlice(device),
    };
  }
  if (device.status === "DISABLED") {
    return {
      status: "DISABLED" as const,
      deviceId,
      deviceConfig: toPublicDeviceConfigSlice(device),
    };
  }
  if (device.status !== "ACTIVE") {
    return {
      status: device.status as "OFFLINE",
      deviceId,
      deviceConfig: toPublicDeviceConfigSlice(device),
    };
  }
  if (device.deviceTokenHash) {
    // Already claimed — do not re-issue plaintext token
    return {
      status: "ACTIVE_NO_TOKEN" as const,
      deviceId,
      deviceCode: device.deviceCode,
      deviceConfig: toPublicDeviceConfigSlice(device),
    };
  }

  const token = generateDeviceToken();
  const expires = new Date(Date.now() + DEVICE_TOKEN_TTL_MS).toISOString();
  const updated = await db
    .update(devices)
    .set({
      deviceTokenHash: hashToken(token),
      deviceTokenExpiresAt: expires,
      pairingSecretHash: null,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(devices.id, deviceId),
        eq(devices.status, "ACTIVE"),
        isNull(devices.deviceTokenHash),
      ),
    )
    .returning({ id: devices.id });

  if (!updated.length) {
    return {
      status: "ACTIVE_NO_TOKEN" as const,
      deviceId,
      deviceConfig: toPublicDeviceConfigSlice(device),
    };
  }

  return {
    status: "ACTIVE" as const,
    deviceId,
    deviceToken: token,
    deviceCode: device.deviceCode,
    expiresAt: expires,
    deviceConfig: toPublicDeviceConfigSlice(device),
  };
}

export async function authenticateDevice(bearer: string | null) {
  if (!bearer?.startsWith("Bearer ")) return null;
  const token = bearer.slice(7);
  const tokenHash = hashToken(token);
  const [device] = await db
    .select()
    .from(devices)
    .where(eq(devices.deviceTokenHash, tokenHash))
    .limit(1);
  if (!device || device.status === "DISABLED" || device.status === "PENDING") {
    return null;
  }
  if (
    device.deviceTokenExpiresAt &&
    Date.parse(device.deviceTokenExpiresAt) < Date.now()
  ) {
    return null;
  }
  return device;
}

export async function setDeviceStatus(params: {
  deviceId: string;
  tenantId: string;
  status: "ACTIVE" | "DISABLED";
  userId?: string;
}) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: params.status,
    updatedAt: now,
  };
  if (params.status === "DISABLED") {
    patch.deviceTokenHash = null;
    patch.deviceTokenExpiresAt = null;
    patch.pairingSecretHash = null;
  }
  const updated = await db
    .update(devices)
    .set(patch)
    .where(
      and(
        eq(devices.id, params.deviceId),
        eq(devices.tenantId, params.tenantId),
      ),
    )
    .returning({ id: devices.id });
  if (!updated.length) throw new Error("Device not found");
  await logActivity({
    userId: params.userId,
    tenantId: params.tenantId,
    action:
      params.status === "DISABLED" ? "device.disabled" : "device.reactivated",
    resource: "device",
    resourceId: params.deviceId,
  });
  return { ok: true };
}

export async function rotateDeviceToken(params: {
  deviceId: string;
  tenantId: string;
  userId?: string;
}) {
  const pairingSecret = generatePairingSecret();
  const updated = await db
    .update(devices)
    .set({
      deviceTokenHash: null,
      deviceTokenExpiresAt: null,
      pairingSecretHash: hashToken(pairingSecret),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(devices.id, params.deviceId),
        eq(devices.tenantId, params.tenantId),
        eq(devices.status, "ACTIVE"),
      ),
    )
    .returning({ id: devices.id });
  if (!updated.length) throw new Error("Device not found");
  await logActivity({
    userId: params.userId,
    tenantId: params.tenantId,
    action: "device.token_rotated",
    resource: "device",
    resourceId: params.deviceId,
  });
  return { pairingSecret };
}

export async function recordHeartbeat(params: {
  deviceId: string;
  playerVersion?: string;
  playlistId?: string;
  contentId?: string;
  playerState?: string;
  resolution?: string;
  runtimeState?: Record<string, unknown>;
  policy?: {
    policySource?: string;
    requested?: Record<string, unknown>;
    resolved?: Record<string, unknown>;
  };
  diagnostics?: Array<{
    code: string;
    severity?: "INFO" | "WARNING" | "ERROR";
    message?: string;
  }>;
  observedAt?: string;
}) {
  const now = new Date().toISOString();
  await db
    .update(devices)
    .set({
      lastSeenAt: now,
      softwareVersion: params.playerVersion ?? undefined,
      screenResolution: params.resolution ?? undefined,
      playerState: JSON.stringify({
        playlistId: params.playlistId,
        contentId: params.contentId,
        state: params.playerState,
        runtime: "PASSIVE",
        ...(params.runtimeState
          ? { runtimeState: params.runtimeState }
          : {}),
        ...(params.policy ? { policy: params.policy } : {}),
        ...(params.diagnostics ? { diagnostics: params.diagnostics } : {}),
        observedAt: params.observedAt ?? now,
      }),
      updatedAt: now,
    })
    .where(eq(devices.id, params.deviceId));
  return { ok: true, serverTime: now };
}

export async function listDevicesWithPresence(tenantId: string) {
  const rows = await db
    .select()
    .from(devices)
    .where(eq(devices.tenantId, tenantId));
  const { onlineWindowMs, awayWindowMs } = getHeartbeatWindows();
  return rows.map((d) => ({
    ...d,
    presence: derivePresence(d.lastSeenAt, onlineWindowMs, awayWindowMs),
  }));
}

/**
 * Aggregated observability for admin list/presence poll (one query + batch content).
 * Does not authorize from client-supplied tenantId.
 */
export async function listDeviceObservability(tenantId: string) {
  const rows = await listDevicesWithPresence(tenantId);
  const contentIds: string[] = [];
  for (const d of rows) {
    try {
      const parsed = d.playerState
        ? (JSON.parse(d.playerState) as {
            contentId?: string;
            runtimeState?: { currentContentId?: string };
          })
        : null;
      const cid =
        parsed?.runtimeState?.currentContentId ?? parsed?.contentId ?? null;
      if (typeof cid === "string") contentIds.push(cid);
    } catch {
      /* ignore */
    }
  }
  const { getContentsMetaByIds } = await import("@/services/contents");
  const meta = await getContentsMetaByIds(contentIds, tenantId);
  const { deriveDeviceRuntimeObservability } = await import(
    "@/domain/device-observability"
  );

  const map: Record<
    string,
    {
      presence: string;
      presenceLabel: string;
      manifestVersion: number | null;
      lastSeenAt: string | null;
      displayType: string;
      name: string | null;
      location: string | null;
      observability: ReturnType<typeof deriveDeviceRuntimeObservability>;
    }
  > = {};

  for (const d of rows) {
    let contentMeta = null;
    try {
      const parsed = d.playerState
        ? (JSON.parse(d.playerState) as {
            contentId?: string;
            runtimeState?: { currentContentId?: string };
          })
        : null;
      const cid =
        parsed?.runtimeState?.currentContentId ?? parsed?.contentId ?? null;
      if (typeof cid === "string") {
        contentMeta = meta.get(cid) ?? null;
      }
    } catch {
      /* ignore */
    }
    const obs = deriveDeviceRuntimeObservability({
      presence: d.presence,
      lastSeenAt: d.lastSeenAt,
      playerStateRaw: d.playerState,
      manifestVersion: d.manifestVersion,
      contentMeta,
    });
    map[d.id] = {
      presence: d.presence,
      presenceLabel: obs.presence.label,
      manifestVersion: d.manifestVersion,
      lastSeenAt: d.lastSeenAt,
      displayType: d.displayType,
      name: d.name,
      location: d.location,
      observability: obs,
    };
  }
  return map;
}

export async function getDeviceObservability(
  deviceId: string,
  tenantId: string,
) {
  const [row] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId)))
    .limit(1);
  if (!row) return null;
  const { onlineWindowMs, awayWindowMs } = getHeartbeatWindows();
  const presence = derivePresence(
    row.lastSeenAt,
    onlineWindowMs,
    awayWindowMs,
  );
  let contentMeta = null;
  try {
    const parsed = row.playerState
      ? (JSON.parse(row.playerState) as {
          contentId?: string;
          runtimeState?: { currentContentId?: string };
        })
      : null;
    const cid =
      parsed?.runtimeState?.currentContentId ?? parsed?.contentId ?? null;
    if (typeof cid === "string") {
      const { getContentsMetaByIds } = await import("@/services/contents");
      const meta = await getContentsMetaByIds([cid], tenantId);
      contentMeta = meta.get(cid) ?? null;
    }
  } catch {
    /* ignore */
  }
  const { deriveDeviceRuntimeObservability } = await import(
    "@/domain/device-observability"
  );
  const observability = deriveDeviceRuntimeObservability({
    presence,
    lastSeenAt: row.lastSeenAt,
    playerStateRaw: row.playerState,
    manifestVersion: row.manifestVersion,
    contentMeta,
  });
  return {
    device: {
      id: row.id,
      name: row.name,
      deviceCode: row.deviceCode,
      location: row.location,
      displayType: row.displayType,
      interactionMode: row.interactionMode,
      orientation: row.orientation,
      status: row.status,
      timezone: row.timezone,
      manifestVersion: row.manifestVersion,
      lastSeenAt: row.lastSeenAt,
      currentPlaylistId: row.currentPlaylistId,
    },
    presence,
    observability,
  };
}

export async function assignPlaylistToDevice(
  deviceId: string,
  playlistId: string | null,
  tenantId: string,
  userId?: string,
) {
  const now = new Date().toISOString();
  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId)))
    .limit(1);
  if (!device) throw new Error("Device not found");

  if (playlistId) {
    const [playlist] = await db
      .select()
      .from(playlists)
      .where(and(eq(playlists.id, playlistId), eq(playlists.tenantId, tenantId)))
      .limit(1);
    if (!playlist) throw new Error("Playlist not found");
  }

  const nextVersion = (device.manifestVersion ?? 0) + 1;
  await db
    .update(devices)
    .set({
      currentPlaylistId: playlistId,
      manifestVersion: nextVersion,
      effectivePlaybackKey: null,
      updatedAt: now,
    })
    .where(eq(devices.id, deviceId));

  await logActivity({
    userId,
    tenantId,
    action: "device.assign_playlist",
    resource: "device",
    resourceId: deviceId,
    metadata: { playlistId, manifestVersion: nextVersion },
  });

  return { manifestVersion: nextVersion };
}

export async function updateDevice(
  deviceId: string,
  tenantId: string,
  data: { name?: string; location?: string; deviceCode?: string },
  userId?: string
) {
  const now = new Date().toISOString();
  
  if (data.deviceCode) {
    const existing = await db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.deviceCode, data.deviceCode),
          eq(devices.tenantId, tenantId)
        )
      )
      .limit(1);
      
    if (existing.length && existing[0].id !== deviceId) {
      throw new Error("Device code already in use");
    }
  }

  const updated = await db
    .update(devices)
    .set({
      ...data,
      updatedAt: now,
    })
    .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId)))
    .returning({ id: devices.id });

  if (!updated.length) throw new Error("Device not found");

  await logActivity({
    userId,
    tenantId,
    action: "device.updated",
    resource: "device",
    resourceId: deviceId,
    metadata: data,
  });

  return { ok: true };
}

export async function deleteDevice(deviceId: string, tenantId: string, userId?: string) {
  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId)))
    .limit(1);

  if (!device) throw new Error("Device not found");

  await db
    .delete(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId)));

  await logActivity({
    userId,
    tenantId,
    action: "device.deleted",
    resource: "device",
    resourceId: deviceId,
    metadata: { name: device.name, deviceCode: device.deviceCode },
  });

  return { ok: true };
}

// silence unused sql import if drizzle returning needs it in some versions
void sql;
