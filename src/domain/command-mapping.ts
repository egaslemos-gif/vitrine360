/**
 * RUNTIME-PLAYBACK-07 — Central DeviceCommand → PlaybackAction mapping.
 * Single source — do not duplicate in UI/transport layers.
 */

import type { DeviceCommand } from "@/domain/device-command";
import type { PlaybackAction, RepeatMode } from "@/domain/playback-state";

export function mapCommandToPlaybackAction(
  command: DeviceCommand,
): PlaybackAction {
  switch (command.type) {
    case "PLAY":
      return { type: "PLAY" };
    case "PAUSE":
      return { type: "PAUSE" };
    case "STOP":
      return { type: "STOP" };
    case "NEXT":
      return { type: "NEXT" };
    case "PREVIOUS":
      return { type: "PREVIOUS" };
    case "RESTART":
      return { type: "RESTART" };
    case "SEEK": {
      const positionMs = (command.payload as { positionMs: number }).positionMs;
      return { type: "SEEK", positionMs };
    }
    case "SET_VOLUME": {
      const volume = (command.payload as { volume: number }).volume;
      return { type: "SET_VOLUME", volume };
    }
    case "SET_MUTED": {
      const muted = (command.payload as { muted: boolean }).muted;
      return { type: "SET_MUTED", muted };
    }
    case "SET_REPEAT_MODE": {
      const repeatMode = (command.payload as { repeatMode: RepeatMode })
        .repeatMode;
      return { type: "SET_REPEAT_MODE", mode: repeatMode };
    }
    default: {
      const _exhaustive: never = command.type;
      void _exhaustive;
      throw new Error("UNSUPPORTED_COMMAND");
    }
  }
}
