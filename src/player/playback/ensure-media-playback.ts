/**
 * Digital-signage media start: prefer audible autoplay; if the browser blocks
 * sound (common after reload), start muted so the presentation never freezes,
 * then try to unmute once playback has begun.
 *
 * CRITICAL: callers must NOT overwrite `el.muted` immediately after calling
 * this — that undoes the muted fallback and leaves the element paused.
 *
 * RP-05: if even muted play() rejects, invoke onUnrecoverable (→ MEDIA_PLAY_ERROR).
 */

export type EnsureMediaPlaybackOptions = {
  onUnrecoverable?: (reason: string) => void;
  /** Desired mute after a successful start (default false). */
  desiredMuted?: boolean;
  /** Desired volume 0..1 (default 1). */
  desiredVolume?: number;
};

export function ensureMediaPlayback(
  el: HTMLMediaElement | null | undefined,
  opts?: EnsureMediaPlaybackOptions,
) {
  if (!el) return;

  const desiredMuted = opts?.desiredMuted === true;
  const desiredVolume =
    typeof opts?.desiredVolume === "number" &&
    Number.isFinite(opts.desiredVolume)
      ? Math.min(1, Math.max(0, opts.desiredVolume))
      : 1;

  const fail = (reason: string) => {
    opts?.onUnrecoverable?.(reason);
  };

  const applyDesiredAudio = () => {
    try {
      el.volume = desiredVolume;
      if (desiredMuted) {
        el.muted = true;
        el.setAttribute("muted", "");
      } else {
        el.muted = false;
        el.removeAttribute("muted");
      }
    } catch {
      /* ignore */
    }
  };

  const recoverIfPausedAfterUnmute = () => {
    if (el.paused) {
      try {
        el.muted = true;
        el.setAttribute("muted", "");
        const again = el.play();
        if (again && typeof again.then === "function") {
          void again.catch(() => fail("muted_autoplay_denied"));
        }
      } catch {
        fail("muted_autoplay_threw");
      }
    }
  };

  const startMuted = () => {
    try {
      el.muted = true;
      el.setAttribute("muted", "");
      el.volume = desiredVolume;
      const mutedPlay = el.play();
      if (mutedPlay && typeof mutedPlay.then === "function") {
        void mutedPlay
          .then(() => {
            if (desiredMuted) return;
            applyDesiredAudio();
            recoverIfPausedAfterUnmute();
            window.setTimeout(() => {
              if (!desiredMuted && !el.paused && el.muted) {
                applyDesiredAudio();
                recoverIfPausedAfterUnmute();
              }
            }, 250);
          })
          .catch(() => {
            fail("muted_autoplay_denied");
          });
      }
    } catch {
      fail("muted_autoplay_threw");
    }
  };

  if (desiredMuted) {
    startMuted();
    return;
  }

  try {
    applyDesiredAudio();
    const audible = el.play();
    if (audible && typeof audible.then === "function") {
      void audible.catch(() => startMuted());
      return;
    }
  } catch {
    startMuted();
  }
}
