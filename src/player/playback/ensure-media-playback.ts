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
  /**
   * Reports that the element is playing silently only because of the autoplay policy
   * (true) or that audio is audible again (false). Presentation-only signal.
   */
  onAudioBlocked?: (blocked: boolean) => void;
  /** Injectable for tests. `undefined` = browser cannot tell (old TV browsers). */
  hasUserActivation?: () => boolean | undefined;
};

export function readUserActivation(): boolean | undefined {
  try {
    const ua = (typeof navigator !== "undefined"
      ? (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
      : undefined);
    return ua ? ua.hasBeenActive : undefined;
  } catch {
    return undefined;
  }
}

const gestureArmed = new WeakSet<HTMLMediaElement>();

/**
 * Inside a user gesture: restore the user's intended audio on the SAME element and make sure
 * it is playing. Never rebuilds the element.
 */
export function enableSoundOnElement(
  el: HTMLMediaElement,
  opts: { desiredMuted: boolean; desiredVolume: number; onUnrecoverable?: (reason: string) => void },
): void {
  try {
    el.volume = Math.min(1, Math.max(0, opts.desiredVolume));
    el.muted = opts.desiredMuted;
    if (!opts.desiredMuted) el.removeAttribute("muted");
    if (el.paused) {
      const p = el.play();
      if (p && typeof p.then === "function") {
        void p.catch(() => {
          // Still refused (even inside a gesture): keep it playing silently if possible.
          try {
            el.muted = true;
            const again = el.play();
            if (again && typeof again.catch === "function") {
              void again.catch(() => opts.onUnrecoverable?.("play_denied_in_gesture"));
            }
          } catch {
            opts.onUnrecoverable?.("play_threw_in_gesture");
          }
        });
      }
    }
  } catch {
    /* ignore */
  }
}

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
  const activation = opts?.hasUserActivation ?? readUserActivation;

  const fail = (reason: string) => {
    opts?.onUnrecoverable?.(reason);
  };
  const audioBlocked = (blocked: boolean) => opts?.onAudioBlocked?.(blocked);

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

  // The browser only allows sound after a user gesture: wait for the first one (no hacks),
  // then restore the intended audio on the same element.
  const armGesture = () => {
    if (gestureArmed.has(el)) return;
    gestureArmed.add(el);
    const types = ["pointerdown", "keydown", "touchend"];
    const onGesture = () => {
      for (const t of types) window.removeEventListener(t, onGesture, true);
      gestureArmed.delete(el);
      enableSoundOnElement(el, { desiredMuted, desiredVolume, onUnrecoverable: fail });
      audioBlocked(false);
    };
    for (const t of types) window.addEventListener(t, onGesture, true);
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
            // Playing, but silently only because of the policy.
            if (activation() === false) {
              // Known: no user activation yet → unmuting would make the browser pause the
              // element. Stay muted, say so, and wait for the first gesture.
              audioBlocked(true);
              armGesture();
              return;
            }
            // Activation present or unknown (old TV browsers): try once, then verify.
            applyDesiredAudio();
            window.setTimeout(() => {
              if (el.paused) {
                // The browser paused it on unmute: back to muted playback, same element.
                try {
                  el.muted = true;
                  el.setAttribute("muted", "");
                  const again = el.play();
                  if (again && typeof again.catch === "function") {
                    void again.catch(() => fail("muted_autoplay_denied"));
                  }
                } catch {
                  fail("muted_autoplay_threw");
                }
                audioBlocked(true);
                armGesture();
              } else if (el.muted) {
                audioBlocked(true);
                armGesture();
              } else {
                audioBlocked(false);
              }
            }, 300);
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
      void audible
        .then(() => audioBlocked(false))
        .catch(() => {
          startMuted();
        });
      return;
    }
  } catch {
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
