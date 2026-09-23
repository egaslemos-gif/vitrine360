import type { EffectivePlaybackState } from "@/domain/playback-resolver";

/** Stable fingerprint of what Sync should publish for a device. */
export function effectivePlaybackKey(
  state: Pick<
    EffectivePlaybackState,
    "source" | "playlistId" | "scheduleId" | "emergencyContentId" | "priority"
  >,
): string {
  return [
    state.source,
    state.playlistId ?? "",
    state.scheduleId ?? "",
    state.emergencyContentId ?? "",
    state.priority,
  ].join("|");
}
