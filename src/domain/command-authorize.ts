/**
 * RUNTIME-PLAYBACK-07 — Authorization boundary for DeviceCommand.
 *
 * Fail closed. Does NOT implement network transport or Admin UI.
 * Required tenant permission (existing): manage_devices
 * (future dedicated remote-control permission may replace this).
 */

import type { DeviceCommand } from "@/domain/device-command";
import type { Permission, UserRole } from "@/domain/types";
import { hasPermission } from "@/domain/types";

/** Documented required permission for issuing device playback commands. */
export const DEVICE_COMMAND_PERMISSION: Permission = "manage_devices";

export type DeviceCommandAuthContext = {
  /** Issuer tenant — must match command.tenantId. */
  tenantId: string;
  /** Target device must belong to this tenant. */
  deviceTenantId: string;
  deviceId: string;
  deviceStatus?: string;
  role?: UserRole;
  /** When false, deny even if role would allow (local harness can set true). */
  authorized: boolean;
};

export type AuthorizeDeviceCommandResult =
  | { ok: true }
  | { ok: false; reason: "WRONG_TENANT" | "UNKNOWN_DEVICE" | "DEVICE_MISMATCH" | "UNAUTHORIZED" | "NOT_AUTHORIZED" };

/**
 * Structure/target authorization only — not presence/ONLINE.
 * ONLINE ≠ commandable.
 */
export function authorizeDeviceCommand(
  command: DeviceCommand,
  ctx: DeviceCommandAuthContext,
): AuthorizeDeviceCommandResult {
  if (!ctx.authorized) {
    return { ok: false, reason: "UNAUTHORIZED" };
  }
  if (command.tenantId !== ctx.tenantId) {
    return { ok: false, reason: "WRONG_TENANT" };
  }
  if (command.tenantId !== ctx.deviceTenantId) {
    return { ok: false, reason: "WRONG_TENANT" };
  }
  if (!ctx.deviceId || command.deviceId !== ctx.deviceId) {
    return { ok: false, reason: "DEVICE_MISMATCH" };
  }
  if (ctx.deviceStatus === "DISABLED" || ctx.deviceStatus === "PENDING") {
    return { ok: false, reason: "UNKNOWN_DEVICE" };
  }
  if (ctx.role != null && !hasPermission(ctx.role, DEVICE_COMMAND_PERMISSION)) {
    return { ok: false, reason: "NOT_AUTHORIZED" };
  }
  return { ok: true };
}
