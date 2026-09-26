/**
 * RUNTIME-PLAYBACK-07 — LocalCommandTransport (test/lab only).
 * No network. Command → CommandDispatcher → PlaybackController.
 */

import type { DeviceCommand, CommandResult } from "@/domain/device-command";
import type { CommandDispatcher } from "@/player/command/command-dispatcher";

export type LocalCommandTransport = {
  send: (command: DeviceCommand) => CommandResult;
};

export function createLocalCommandTransport(
  dispatcher: CommandDispatcher,
): LocalCommandTransport {
  return {
    send(command) {
      return dispatcher.dispatch(command);
    },
  };
}
