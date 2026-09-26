/**
 * RUNTIME-PLAYBACK-09 — Device-side HTTP command poller (React Player).
 * Poll → claim → CommandDispatcher → ACK. No SSE/WS.
 */

import type { DeviceCommand, CommandResult } from "@/domain/device-command";
import { COMMAND_TRANSPORT } from "@/domain/command-transport";
import type { CommandDispatcher } from "@/player/command/command-dispatcher";

export type CommandPollerOptions = {
  getDeviceToken: () => string | null | Promise<string | null>;
  dispatcher: CommandDispatcher;
  intervalMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  onResult?: (result: CommandResult) => void;
  onError?: (err: unknown) => void;
};

type PollWire = {
  commandId: string;
  tenantId: string;
  deviceId: string;
  sessionId: string | null;
  binding: "SESSION_BOUND" | "DEVICE_BOUND";
  type: DeviceCommand["type"];
  payload: DeviceCommand["payload"];
  issuedAt: number;
  expiresAt: number;
  correlationId?: string;
};

export type CommandPoller = {
  start: () => void;
  stop: () => void;
  pollOnce: () => Promise<void>;
};

export function createCommandPoller(
  options: CommandPollerOptions,
): CommandPoller {
  const interval = options.intervalMs ?? COMMAND_TRANSPORT.POLL_INTERVAL_MS;
  const fetchFn = options.fetchImpl ?? fetch;
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  async function ack(commandId: string, result: CommandResult, token: string) {
    await fetchFn(
      `/api/device/commands/${encodeURIComponent(commandId)}/ack`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          status: result.status,
          sessionId: result.sessionId,
          reason: result.reason ?? null,
          observedAt: new Date().toISOString(),
        }),
      },
    );
  }

  async function pollOnce() {
    if (running) return;
    running = true;
    try {
      const token = await options.getDeviceToken();
      if (!token) return;

      const res = await fetchFn("/api/device/commands", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-store",
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { commands?: PollWire[] };
      const commands = data.commands ?? [];

      for (const wire of commands) {
        const command: DeviceCommand = {
          commandId: wire.commandId,
          tenantId: wire.tenantId,
          deviceId: wire.deviceId,
          sessionId: wire.sessionId ?? undefined,
          binding: wire.binding,
          type: wire.type,
          payload: wire.payload,
          issuedAt: wire.issuedAt,
          expiresAt: wire.expiresAt,
          correlationId: wire.correlationId,
        };
        const result = options.dispatcher.dispatch(command);
        options.onResult?.(result);
        try {
          await ack(wire.commandId, result, token);
        } catch (err) {
          options.onError?.(err);
        }
      }
    } catch (err) {
      options.onError?.(err);
    } finally {
      running = false;
    }
  }

  return {
    pollOnce,
    start() {
      if (timer) return;
      void pollOnce();
      timer = setInterval(() => {
        void pollOnce();
      }, interval);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
