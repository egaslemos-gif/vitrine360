/**
 * Digital-signage media start: prefer audible autoplay; if the browser blocks
 * sound, start muted so the presentation never freezes on frame 0, then try
 * to unmute after playback begins (Smart TVs often allow it).
 *
 * RP-05: if even muted play() rejects, invoke onUnrecoverable (→ MEDIA_PLAY_ERROR).
 */

export type EnsureMediaPlaybackOptions = {
  onUnrecoverable?: (reason: string) => void;
};

export function ensureMediaPlayback(
  el: HTMLMediaElement | null | undefined,
  opts?: EnsureMediaPlaybackOptions,
) {
  if (!el) return;

  const fail = (reason: string) => {
    opts?.onUnrecoverable?.(reason);
  };

  const attemptUnmute = () => {
    try {
      el.muted = false;
      el.removeAttribute("muted");
      el.volume = 1;
    } catch {
      /* ignore */
    }
  };

  const startMuted = () => {
    try {
      el.muted = true;
      el.setAttribute("muted", "");
      const mutedPlay = el.play();
      if (mutedPlay && typeof mutedPlay.then === "function") {
        void mutedPlay
          .then(() => {
            attemptUnmute();
            window.setTimeout(attemptUnmute, 250);
          })
          .catch(() => {
            fail("muted_autoplay_denied");
          });
      }
    } catch {
      fail("muted_autoplay_threw");
    }
  };

  try {
    attemptUnmute();
    const audible = el.play();
    if (audible && typeof audible.then === "function") {
      void audible.catch(() => startMuted());
      return;
    }
  } catch {
    startMuted();
  }
}
