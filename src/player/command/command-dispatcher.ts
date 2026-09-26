/**
 * RUNTIME-PLAYBACK-07 — CommandDispatcher
 *
 * validate → expiry → target → session → auth → map → PlaybackController.dispatch
 * MUST NOT touch HTMLMediaElement / renderer / playlist index.
 */

import {
  authorizeDeviceCommand,
  type DeviceCommandAuthContext,
} from "@/domain/command-authorize";
import { mapCommandToPlaybackAction } from "@/domain/command-mapping";
import {
  isCommandExpired,
  type CommandRejectReason,
  type CommandResult,
  type DeviceCommand,
} from "@/domain/device-command";
import type { PlaybackController } from "@/player/playback/playback-controller";
import {
  createIdempotencyStore,
  type IdempotencyStore,
} from "@/player/command/idempotency-store";

export type ActivePlayerSessionRef = {
  sessionId: string;
  deviceId: string | null;
  tenantId: string | null;
};

export type CommandDispatcherOptions = {
  controller: PlaybackController;
  getSession: () => ActivePlayerSessionRef | null;
  auth: DeviceCommandAuthContext;
  now?: () => number;
  idempotency?: IdempotencyStore;
  /** Extend idempotency retention beyond command expiry (ms). */
  idempotencyGraceMs?: number;
  onTelemetry?: (event: {
    type:
      | "COMMAND_RECEIVED"
      | "COMMAND_APPLIED"
      | "COMMAND_REJECTED"
      | "COMMAND_EXPIRED"
      | "COMMAND_DUPLICATE";
    commandId: string;
    commandType?: string;
    reason?: string;
  }) => void;
};

function reject(
  command: DeviceCommand,
  reason: CommandRejectReason,
  extras?: Partial<CommandResult>,
): CommandResult {
  return {
    commandId: command.commandId,
    status: reason === "EXPIRED" ? "EXPIRED" : reason === "STALE_SESSION" ? "STALE_SESSION" : "REJECTED",
    deviceId: command.deviceId,
    sessionId: command.sessionId ?? null,
    action: null,
    reason,
    correlationId: command.correlationId,
    ...extras,
  };
}

export type CommandDispatcher = {
  dispatch: (command: DeviceCommand) => CommandResult;
  getIdempotencyStore: () => IdempotencyStore;
};

export function createCommandDispatcher(
  options: CommandDispatcherOptions,
): CommandDispatcher {
  const now = options.now ?? (() => Date.now());
  const store = options.idempotency ?? createIdempotencyStore();
  const grace = options.idempotencyGraceMs ?? 60_000;
  const telem = options.onTelemetry;

  return {
    getIdempotencyStore: () => store,
    dispatch(command) {
      const t = now();
      telem?.({
        type: "COMMAND_RECEIVED",
        commandId: command.commandId,
        commandType: command.type,
      });

      // 1–2 structure already assumed valid DeviceCommand from create/parse
      // Idempotency first (same commandId must not re-dispatch)
      const prior = store.get(command.commandId, t);
      if (prior) {
        telem?.({
          type: "COMMAND_DUPLICATE",
          commandId: command.commandId,
          commandType: command.type,
        });
        return {
          ...prior,
          status: "DUPLICATE",
          correlationId: command.correlationId ?? prior.correlationId,
        };
      }

      // Expiry
      if (isCommandExpired(command, t)) {
        const result = reject(command, "EXPIRED");
        store.set(command.commandId, result, command.expiresAt + grace);
        telem?.({
          type: "COMMAND_EXPIRED",
          commandId: command.commandId,
          commandType: command.type,
          reason: "EXPIRED",
        });
        return result;
      }

      // Target + tenant (auth context)
      const auth = authorizeDeviceCommand(command, options.auth);
      if (!auth.ok) {
        const result = reject(command, auth.reason);
        store.set(command.commandId, result, command.expiresAt + grace);
        telem?.({
          type: "COMMAND_REJECTED",
          commandId: command.commandId,
          commandType: command.type,
          reason: auth.reason,
        });
        return result;
      }

      // Session binding
      if (command.binding === "SESSION_BOUND") {
        const session = options.getSession();
        if (!session || !command.sessionId) {
          const result = reject(command, "STALE_SESSION");
          store.set(command.commandId, result, command.expiresAt + grace);
          telem?.({
            type: "COMMAND_REJECTED",
            commandId: command.commandId,
            reason: "STALE_SESSION",
          });
          return result;
        }
        if (session.sessionId !== command.sessionId) {
          const result = reject(command, "STALE_SESSION");
          store.set(command.commandId, result, command.expiresAt + grace);
          telem?.({
            type: "COMMAND_REJECTED",
            commandId: command.commandId,
            reason: "STALE_SESSION",
          });
          return result;
        }
        if (
          session.deviceId != null &&
          session.deviceId !== command.deviceId
        ) {
          const result = reject(command, "DEVICE_MISMATCH");
          store.set(command.commandId, result, command.expiresAt + grace);
          telem?.({
            type: "COMMAND_REJECTED",
            commandId: command.commandId,
            reason: "DEVICE_MISMATCH",
          });
          return result;
        }
        if (
          session.tenantId != null &&
          session.tenantId !== command.tenantId
        ) {
          const result = reject(command, "WRONG_TENANT");
          store.set(command.commandId, result, command.expiresAt + grace);
          telem?.({
            type: "COMMAND_REJECTED",
            commandId: command.commandId,
            reason: "WRONG_TENANT",
          });
          return result;
        }
      }

      // Map + dispatch to PlaybackController only
      let action;
      try {
        action = mapCommandToPlaybackAction(command);
      } catch {
        const result = reject(command, "UNSUPPORTED_COMMAND");
        store.set(command.commandId, result, command.expiresAt + grace);
        telem?.({
          type: "COMMAND_REJECTED",
          commandId: command.commandId,
          reason: "UNSUPPORTED_COMMAND",
        });
        return result;
      }

      options.controller.dispatch(action);
      const appliedAt = now();
      const result: CommandResult = {
        commandId: command.commandId,
        status: "APPLIED",
        deviceId: command.deviceId,
        sessionId: command.sessionId ?? options.getSession()?.sessionId ?? null,
        action: command.type,
        appliedAt,
        correlationId: command.correlationId,
      };
      store.set(command.commandId, result, command.expiresAt + grace);
      telem?.({
        type: "COMMAND_APPLIED",
        commandId: command.commandId,
        commandType: command.type,
      });
      return result;
    },
  };
}
