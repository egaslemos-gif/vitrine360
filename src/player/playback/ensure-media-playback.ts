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

  const isDevVideo = process.env.NODE_ENV === "development" && el instanceof HTMLVideoElement;
  const log = (msg: string) => {
    if (isDevVideo) console.log(`[VIDEO-DIAG-ENSURE] ${msg}`);
  };

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
        log("recoverIfPausedAfterUnmute calling play()");
        const again = el.play();
        if (again && typeof again.then === "function") {
          void again.then(() => {
            log("recoverIfPausedAfterUnmute play() resolved");
          }).catch((err: unknown) => {
            log(`recoverIfPausedAfterUnmute play() rejected: name=${(err as Error)?.name} msg=${(err as Error)?.message}`);
            fail("muted_autoplay_denied");
          });
        }
      } catch (err: unknown) {
        log(`recoverIfPausedAfterUnmute threw: ${(err as Error)?.message}`);
        fail("muted_autoplay_threw");
      }
    }
  };

  const startMuted = () => {
    try {
      el.muted = true;
      el.setAttribute("muted", "");
      el.volume = desiredVolume;
      log("startMuted calling play()");
      const mutedPlay = el.play();
      if (mutedPlay && typeof mutedPlay.then === "function") {
        void mutedPlay
          .then(() => {
            log("startMuted play() resolved");
            if (desiredMuted) return;
            applyDesiredAudio();
            recoverIfPausedAfterUnmute();
            window.setTimeout(() => {
              if (!desiredMuted && !el.paused && el.muted) {
                applyDesiredAudio();
                recoverIfPausedAfterUnmute();
                // If it STILL is muted (browser blocked our unmute attempt),
                // we register a one-time user interaction listener.
                if (el.muted) {
                  const unmuteOnInteract = () => {
                    if (!desiredMuted && el.muted && !el.paused) {
                      el.muted = false;
                      el.removeAttribute("muted");
                    }
                    window.removeEventListener("pointerdown", unmuteOnInteract, true);
                    window.removeEventListener("keydown", unmuteOnInteract, true);
                  };
                  window.addEventListener("pointerdown", unmuteOnInteract, true);
                  window.addEventListener("keydown", unmuteOnInteract, true);
                }
              }
            }, 250);
          })
          .catch((err: unknown) => {
            log(`startMuted play() rejected: name=${(err as Error)?.name} msg=${(err as Error)?.message}`);
            fail("muted_autoplay_denied");
          });
      }
    } catch (err: unknown) {
      log(`startMuted threw: ${(err as Error)?.message}`);
      fail("muted_autoplay_threw");
    }
  };

  if (desiredMuted) {
    startMuted();
    return;
  }

  try {
    applyDesiredAudio();
    log("audible calling play()");
    const audible = el.play();
    if (audible && typeof audible.then === "function") {
      void audible.then(() => {
        log("audible play() resolved");
      }).catch((err: unknown) => {
        log(`audible play() rejected: name=${(err as Error)?.name} msg=${(err as Error)?.message} - falling back to startMuted`);
        startMuted();
      });
      return;
    }
  } catch (err: unknown) {
    log(`audible play() threw: ${(err as Error)?.message} - falling back to startMuted`);
    startMuted();
  }
}

export function disposeMediaElement(el: HTMLMediaElement | null | undefined) {
  if (!el) return;
  try {
    // Nullify potential inline listeners
    el.onended = null;
    el.onerror = null;
    el.ontimeupdate = null;
    el.onloadeddata = null;
    el.onloadedmetadata = null;
    el.oncanplay = null;
    el.onplay = null;
    el.onplaying = null;
    el.onpause = null;

    el.pause();
    el.removeAttribute("src");
    el.load();
  } catch {
    /* ignore */
  }
}
