/**
 * Playback Lab guard (server-side only).
 *
 * - development / test: lab available.
 * - production build (includes Vercel Preview, where NODE_ENV=production):
 *   available only when PLAYBACK_LAB_ENABLED === "true". Default: blocked.
 *
 * Deliberately NOT a NEXT_PUBLIC_ variable: the flag is never exposed to the browser.
 */
export function isPlaybackLabEnabled(env: {
  NODE_ENV?: string;
  PLAYBACK_LAB_ENABLED?: string;
}): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.PLAYBACK_LAB_ENABLED === "true";
}
