/**
 * RUNTIME-POLICY-05 — Bridge persisted Device fields → policy inputs.
 * Reuses LocalConfig (localStorage); no new IndexedDB store / table.
 */

import {
  getConfig,
  saveConfig,
  type LocalConfig,
} from "@/player/cache/indexed-db";
import type { DeviceConfigForPolicy } from "@/player/runtime/resolve-policy";
import type { DevicePolicyConfigWire } from "@/domain/runtime-policy";
import type { DisplayType, InteractionMode } from "@/domain/types";
import { DISPLAY_TYPES, INTERACTION_MODES } from "@/domain/types";

export const DEVICE_CONFIG_UPDATED_EVENT = "v360-device-config-updated";

const CONFIG_LS_KEY = "v360-player-config";

function isDisplayType(v: string): v is DisplayType {
  return (DISPLAY_TYPES as readonly string[]).includes(v);
}

function isInteractionMode(v: string): v is InteractionMode {
  return (INTERACTION_MODES as readonly string[]).includes(v);
}

/** Sync read of LocalConfig for policy resolution (shell boot path). */
export function readLocalConfigSync(): LocalConfig | null {
  try {
    const raw = window.localStorage.getItem(CONFIG_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalConfig;
  } catch {
    return null;
  }
}

/**
 * Map LocalConfig → DeviceConfigForPolicy.
 * Only marks hasDevicePolicy when server enrichment landed.
 */
export function localConfigToDevicePolicyInput(
  config: LocalConfig | null,
): DeviceConfigForPolicy {
  if (!config) {
    return { tenantId: "local", deviceId: null };
  }
  const base: DeviceConfigForPolicy = {
    tenantId: config.tenantId ?? "local",
    deviceId: config.deviceId,
    timezone: config.timezone ?? null,
  };
  if (!config.hasDevicePolicy) {
    return base;
  }
  return {
    ...base,
    hasDevicePolicy: true,
    displayType:
      config.displayType && isDisplayType(config.displayType)
        ? config.displayType
        : "TV",
    interactionMode:
      config.interactionMode && isInteractionMode(config.interactionMode)
        ? config.interactionMode
        : "PASSIVE",
    orientationStored: config.orientation ?? "auto",
  };
}

/**
 * Merge server Device slice into LocalConfig.
 * Rejects cross-device / cross-tenant writes.
 */
export async function applyServerDeviceConfig(
  slice: DevicePolicyConfigWire,
): Promise<boolean> {
  const current = await getConfig();
  if (!current?.deviceId) return false;
  if (current.deviceId !== slice.deviceId) return false;
  if (
    current.tenantId &&
    slice.tenantId &&
    current.tenantId !== slice.tenantId
  ) {
    return false;
  }

  const next: LocalConfig = {
    ...current,
    tenantId: slice.tenantId ?? current.tenantId ?? null,
    deviceName: slice.deviceName ?? current.deviceName ?? null,
    location: slice.location ?? current.location ?? null,
    groupName: slice.groupName ?? current.groupName ?? null,
    displayType: slice.displayType,
    interactionMode: slice.interactionMode,
    orientation: slice.orientation,
    timezone: slice.timezone,
    hasDevicePolicy: true,
  };
  await saveConfig(next);
  try {
    window.dispatchEvent(new Event(DEVICE_CONFIG_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
  return true;
}

/** Merge deviceConfig fields into a LocalConfig object (claim path). */
export function withServerDeviceConfig(
  config: LocalConfig,
  slice: DevicePolicyConfigWire | undefined | null,
): LocalConfig {
  if (!slice) return config;
  if (slice.deviceId !== config.deviceId) return config;
  return {
    ...config,
    tenantId: slice.tenantId ?? config.tenantId ?? null,
    deviceName: slice.deviceName ?? config.deviceName ?? null,
    location: slice.location ?? config.location ?? null,
    groupName: slice.groupName ?? config.groupName ?? null,
    displayType: slice.displayType,
    interactionMode: slice.interactionMode,
    orientation: slice.orientation,
    timezone: slice.timezone,
    hasDevicePolicy: true,
  };
}
