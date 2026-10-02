/* PLAYER-PRO-01 — external, removable media instrumentation (injected by Playwright addInitScript).
 * Not part of the application bundle. Never records tokens (query is masked). */
(function () {
  var w = window;
  w.__pp = { ev: [], playRej: [] };
  var t0 = performance.now();
  function mask(s) { return (s || "").replace(/token=[^&]+/, "token=***"); }

  var SIM = !!w.__SIM; // emulate Chrome/SRAF autoplay policy (automation Chrome does not enforce it)
  var activated = false;
  if (SIM) {
    ["pointerdown", "keydown", "touchstart"].forEach(function (t) {
      window.addEventListener(t, function () { activated = true; }, true);
    });
  }

  var orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    // SIM=1: unmuted play needs a gesture. SIM=2: ANY play needs a gesture (even muted).
    if (SIM && !activated && (w.__SIM === 2 || !this.muted)) {
      var e = new DOMException("play() failed because the user didn't interact with the document first.", "NotAllowedError");
      w.__pp.playRej.push("NotAllowedError: simulated");
      return Promise.reject(e);
    }
    var p = orig.call(this);
    if (p && p.catch) p.catch(function (e) { w.__pp.playRej.push((e.name + ": " + e.message).slice(0, 120)); });
    return p;
  };

  if (SIM) {
    var d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "muted");
    Object.defineProperty(HTMLMediaElement.prototype, "muted", {
      get: d.get,
      set: function (v) {
        d.set.call(this, v);
        // Chrome: unmuting an autoplayed element without user activation pauses it.
        if (v === false && !activated && !this.paused) Promise.resolve().then(this.pause.bind(this));
      }
    });
  }

  var names = ["loadstart", "loadedmetadata", "canplay", "playing", "pause", "waiting", "stalled", "error", "ended", "volumechange", "seeked"];
  function hook(el) {
    if (el.__hk) return;
    el.__hk = true;
    names.forEach(function (n) {
      el.addEventListener(n, function () {
        w.__pp.ev.push({
          t: Math.round(performance.now() - t0), k: n,
          d: el.tagName.toLowerCase() + " paused=" + el.paused + " muted=" + el.muted + " vol=" + el.volume +
            " cur=" + el.currentTime.toFixed(2) + " rs=" + el.readyState + " err=" + (el.error ? el.error.code : "") +
            " src=" + mask(el.currentSrc).slice(-40)
        });
      });
    });
  }
  new MutationObserver(function () {
    document.querySelectorAll("video,audio").forEach(hook);
  }).observe(document, { childList: true, subtree: true });
})();
