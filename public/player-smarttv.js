/**
 * Vanilla Smart TV player — full slideshow + pairing.
 * No React, no IndexedDB, no Service Worker — ES5 safe.
 * v0.1.3: Plays content after pairing (images, videos, text, clock).
 */
(function () {
  var LS_KEY = "v360-player-config";
  var VERSION = "0.1.3-smarttv-static";
  var root = document.getElementById("root");
  var claimTimer = null;
  var bootSec = 0;
  var bootTick = null;
  var PAIR_CLIENT_ID_KEY = "v360-pairing-client-id";
  var PAIR_SECRET_KEY = "v360-pairing-secret";

  function randomPairingValue(prefix) {
    return (
      prefix +
      "-" +
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2)
    );
  }

  function getPairingIdentity() {
    var clientId = null;
    var pairingSecret = null;
    try {
      clientId = localStorage.getItem(PAIR_CLIENT_ID_KEY);
      pairingSecret = localStorage.getItem(PAIR_SECRET_KEY);
    } catch (e) {
      /* continue with an ephemeral identity */
    }
    clientId = clientId || randomPairingValue("tv");
    pairingSecret = pairingSecret || randomPairingValue("pair");
    try {
      localStorage.setItem(PAIR_CLIENT_ID_KEY, clientId);
      localStorage.setItem(PAIR_SECRET_KEY, pairingSecret);
    } catch (e) {
      /* storage may be unavailable */
    }
    return { clientId: clientId, pairingSecret: pairingSecret };
  }

  /* ── persisted config ────────────────────────────────── */

  function readConfig() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeConfig(cfg) {
    try {
      if (!cfg) localStorage.removeItem(LS_KEY);
      else localStorage.setItem(LS_KEY, JSON.stringify(cfg));
    } catch (e) {
      /* ignore */
    }
  }

  /* ── DOM helpers ─────────────────────────────────────── */

  function setHtml(html) {
    root.innerHTML = html;
  }

  function showBoot(hint) {
    setHtml(
      '<p class="muted" style="font-size:28px;margin:0">' +
        (hint || "A iniciar…") +
        '</p><p id="boot-ver" class="muted" style="font-size:14px;margin-top:16px">' +
        bootSec +
        "s · v" +
        VERSION +
        "</p>"
    );
  }

  function showError(msg) {
    if (bootTick) clearInterval(bootTick);
    setHtml(
      '<p style="font-size:28px;margin:0">Não foi possível iniciar</p>' +
        '<p class="muted" style="font-size:16px;margin-top:16px;max-width:480px">' +
        msg +
        "</p>" +
        '<p class="muted" style="font-size:14px;margin-top:12px">Limpe a cache do browser e abra de novo.</p>' +
        '<button type="button" id="retry">Tentar novamente</button>'
    );
    var btn = document.getElementById("retry");
    if (btn) btn.onclick = function () { location.reload(); };
  }

  function showPairing(code) {
    if (bootTick) clearInterval(bootTick);
    setHtml(
      '<p class="brand">Vitrine360</p>' +
        '<p class="muted" style="margin-top:16px">Código de activação</p>' +
        '<p class="code">' +
        (code || "———") +
        "</p>" +
        '<p class="muted" style="margin-top:40px;max-width:420px;font-size:16px">' +
        "Introduza este código no Admin Console para associar este dispositivo." +
        "</p>" +
        '<p class="muted" style="margin-top:24px;font-size:12px">v' +
        VERSION +
        " · Smart TV</p>"
    );
  }

  /* ── Network helpers (XHR, ES5 safe) ─────────────────── */

  function fetchJson(url, body, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error("fetch timed out after " + timeoutMs + "ms"));
      }, timeoutMs);

      var xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || done) return;
        done = true;
        clearTimeout(timer);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText || "{}"));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error("HTTP " + xhr.status));
        }
      };
      xhr.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error("network error"));
      };
      xhr.send(JSON.stringify(body));
    });
  }

  function fetchGet(url, token, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error("fetch timed out after " + timeoutMs + "ms"));
      }, timeoutMs);

      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || done) return;
        done = true;
        clearTimeout(timer);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText || "{}"));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error("HTTP " + xhr.status));
        }
      };
      xhr.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error("network error"));
      };
      xhr.send();
    });
  }

  function fetchPostAuth(url, token, body, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error("fetch timed out after " + timeoutMs + "ms"));
      }, timeoutMs);

      var xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || done) return;
        done = true;
        clearTimeout(timer);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText || "{}"));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error("HTTP " + xhr.status));
        }
      };
      xhr.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error("network error"));
      };
      xhr.send(JSON.stringify(body));
    });
  }

  /* ── Pairing flow ────────────────────────────────────── */

  function startClaim(cfg) {
    if (claimTimer) clearInterval(claimTimer);
    claimTimer = setInterval(function () {
      fetchJson(
        "/api/device/bootstrap",
        {
          action: "claim",
          deviceId: cfg.deviceId,
          pairingSecret: cfg.pairingSecret,
        },
        8000
      )
        .then(function (data) {
          if (data.status === "ACTIVE" && data.deviceToken) {
            var next = {
              deviceId: cfg.deviceId,
              deviceToken: data.deviceToken,
              deviceCode: data.deviceCode || null,
            };
            writeConfig(next);
            clearInterval(claimTimer);
            claimTimer = null;
            startPlayback(next);
          } else if (data.status === "ACTIVE_NO_TOKEN") {
            clearInterval(claimTimer);
            claimTimer = null;
            showError(
              "Esta TV já está associada. Feche outra aba do Player ou use o dispositivo existente no Admin; não será criado um novo código."
            );
          } else if (data.status === "FORBIDDEN") {
            clearInterval(claimTimer);
            claimTimer = null;
            showError("Pairing inválido. A limpar esta tentativa...");
            setTimeout(function () {
              writeConfig(null);
              window.location.reload();
            }, 3000);
          }
        })
        .catch(function () {
          /* keep polling */
        });
    }, 2500);
  }

  function startPairing() {
    showBoot("A pedir código de activação…");
    var identity = getPairingIdentity();
    fetchJson(
      "/api/device/bootstrap",
      {
        action: "pair_start",
        clientId: identity.clientId,
        pairingSecret: identity.pairingSecret,
      },
      12000
    )
      .then(function (data) {
        if (!data.pairingSecret || !data.deviceId || !data.activationCode) {
          throw new Error("resposta incompleta do servidor");
        }
        var cfg = {
          deviceId: data.deviceId,
          deviceToken: "",
          clientId: identity.clientId,
          activationCode: data.activationCode,
          pairingSecret: data.pairingSecret,
        };
        writeConfig(cfg);
        showPairing(data.activationCode);
        startClaim(cfg);
      })
      .catch(function (e) {
        showError(
          e && e.message
            ? "Sem resposta do servidor: " + e.message
            : "Sem resposta do servidor. Verifique a rede."
        );
      });
  }

  /* ── Slideshow Engine ────────────────────────────────── */

  var playState = {
    items: [],
    index: 0,
    // -1 = no local manifest yet: forces initial manifest delivery.
    manifestVersion: -1,
    slideTimer: null,
    heartbeatTimer: null,
    syncTimer: null,
    clockTimer: null,
    token: null,
    deviceId: null,
    deviceCode: null,
  };

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildMediaUrl(item) {
    if (!item.assets || !item.assets.length) return null;
    var asset = item.assets[0];
    return asset.url || null;
  }

  function renderSlide(item) {
    if (!item) {
      renderNoContent();
      return;
    }

    var type = item.type || "";

    if (type === "IMAGE") {
      var imgUrl = buildMediaUrl(item);
      if (!imgUrl) { renderNoContent(); return; }
      setHtml(
        '<div class="slide fade-in" style="display:flex;align-items:center;justify-content:center;background:#000">' +
          '<img src="' + escapeHtml(imgUrl) + '" alt="' + escapeHtml(item.title) + '"' +
          ' style="width:100%;height:100%;object-fit:contain;background:#000" />' +
        '</div>'
      );
      return;
    }

    if (type === "VIDEO") {
      var vidUrl = buildMediaUrl(item);
      if (!vidUrl) { renderNoContent(); return; }
      setHtml(
        '<div class="slide fade-in" style="display:flex;align-items:center;justify-content:center;background:#000">' +
          '<video src="' + escapeHtml(vidUrl) + '" autoplay playsinline' +
          ' style="width:100%;height:100%;object-fit:contain;background:#000"></video>' +
        '</div>'
      );
      return;
    }

    if (type === "CLOCK") {
      renderClock();
      return;
    }

    // TEXT, NOTICE, EVENT, NEWS, QR_CODE — render as text card
    var payload = item.payload || {};
    var body = payload.body || payload.message || payload.description || "";
    setHtml(
      '<div class="slide fade-in" style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'height:100%;padding:60px;background:linear-gradient(160deg,#0b1220 0%,#132033 55%,#1a2740 100%);text-align:center">' +
        '<p style="font-size:14px;letter-spacing:0.4em;opacity:0.4;margin:0">VITRINE360</p>' +
        '<h1 style="font-size:clamp(2rem,5vw,3.5rem);font-weight:600;margin:32px 0 0;max-width:900px;line-height:1.2">' +
          escapeHtml(item.title) +
        '</h1>' +
        (body ? '<p style="font-size:clamp(1.1rem,3vw,1.6rem);margin:32px auto 0;max-width:800px;opacity:0.8;line-height:1.5">' +
          escapeHtml(body) + '</p>' : '') +
      '</div>'
    );
  }

  function renderClock() {
    if (playState.clockTimer) clearInterval(playState.clockTimer);

    function update() {
      var now = new Date();
      var h = String(now.getHours()).length < 2 ? "0" + now.getHours() : String(now.getHours());
      var m = String(now.getMinutes()).length < 2 ? "0" + now.getMinutes() : String(now.getMinutes());
      var dateStr = now.toLocaleDateString();
      setHtml(
        '<div class="slide" style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
          'height:100%;background:#0b1220">' +
          '<p style="font-size:clamp(4rem,12vw,10rem);font-weight:600;margin:0;font-variant-numeric:tabular-nums">' +
            h + ":" + m +
          '</p>' +
          '<p style="font-size:clamp(1.2rem,3vw,2rem);margin-top:16px;opacity:0.7">' +
            dateStr +
          '</p>' +
        '</div>'
      );
    }

    update();
    playState.clockTimer = setInterval(update, 5000);
  }

  function renderNoContent() {
    setHtml(
      '<div class="slide" style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'height:100%;background:#070b14;text-align:center">' +
        '<p style="font-size:14px;letter-spacing:0.35em;opacity:0.4;margin:0">VITRINE360</p>' +
        '<p style="font-size:clamp(1.5rem,4vw,2.5rem);font-weight:600;margin:24px 0 0">SEM CONTEÚDO</p>' +
        '<p style="font-size:16px;opacity:0.5;margin:16px 0 0">Aguardando playlist sincronizada</p>' +
        '<p style="font-size:12px;opacity:0.35;margin:24px 0 0">v' + VERSION +
        ' · ' + (playState.deviceCode || playState.deviceId || '') + '</p>' +
      '</div>'
    );
  }

  function advanceSlide() {
    if (playState.clockTimer) { clearInterval(playState.clockTimer); playState.clockTimer = null; }
    if (!playState.items.length) {
      renderNoContent();
      return;
    }
    var item = playState.items[playState.index];
    renderSlide(item);
    var duration = Math.max(Number(item.durationMs) || 8000, 2000);
    playState.index = (playState.index + 1) % playState.items.length;
    if (playState.slideTimer) clearTimeout(playState.slideTimer);
    playState.slideTimer = setTimeout(advanceSlide, duration);
  }

  /* ── Sync + Heartbeat ────────────────────────────────── */

  function doSync() {
    if (!playState.token) return;
    fetchGet(
      "/api/device/sync?version=" + playState.manifestVersion,
      playState.token,
      15000
    )
      .then(function (data) {
        if (data.upToDate || !data.manifest) return;
        var manifest = data.manifest;
        playState.manifestVersion = manifest.manifestVersion || 0;

        var playlist = manifest.playlist;
        if (playlist && playlist.items && playlist.items.length) {
          playState.items = playlist.items;
          playState.index = 0;
          advanceSlide();
        } else {
          playState.items = [];
          renderNoContent();
        }
      })
      .catch(function (e) {
        /* silent — keep playing current content */
      });
  }

  function doHeartbeat() {
    if (!playState.token) return;
    var currentItem = playState.items.length
      ? playState.items[(playState.index - 1 + playState.items.length) % playState.items.length]
      : null;
    fetchPostAuth(
      "/api/device/heartbeat",
      playState.token,
      {
        timestamp: new Date().toISOString(),
        playerVersion: VERSION,
        playerState: playState.items.length ? "PLAYING" : "IDLE",
        contentId: currentItem ? currentItem.contentId : undefined,
        resolution: window.innerWidth + "x" + window.innerHeight,
      },
      10000
    )
      .then(function (data) {
        if (data && data.manifestVersion > playState.manifestVersion) {
          doSync();
        }
      })
      .catch(function () {
        /* silent */
      });
  }

  /* ── Playback entry point ────────────────────────────── */

  function startPlayback(cfg) {
    if (bootTick) { clearInterval(bootTick); bootTick = null; }
    if (claimTimer) { clearInterval(claimTimer); claimTimer = null; }

    playState.token = cfg.deviceToken;
    playState.deviceId = cfg.deviceId;
    playState.deviceCode = cfg.deviceCode || null;

    // Apply full-screen playback styles
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    document.body.style.cursor = "none";
    document.body.style.background = "#070b14";
    root.style.width = "100%";
    root.style.height = "100%";
    root.style.minHeight = "100vh";
    root.style.padding = "0";
    root.style.display = "block";

    // Show loading state
    setHtml(
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column">' +
        '<p class="muted" style="font-size:24px;margin:0">A sincronizar conteúdo…</p>' +
        '<p class="muted" style="font-size:12px;margin-top:16px">v' + VERSION + '</p>' +
      '</div>'
    );

    // Initial sync
    doSync();

    // Periodic sync every 60s
    if (playState.syncTimer) clearInterval(playState.syncTimer);
    playState.syncTimer = setInterval(doSync, 60000);

    // Heartbeat every 30s
    if (playState.heartbeatTimer) clearInterval(playState.heartbeatTimer);
    playState.heartbeatTimer = setInterval(doHeartbeat, 30000);

    // First heartbeat after 3s
    setTimeout(doHeartbeat, 3000);
  }

  /* ── Boot ─────────────────────────────────────────────── */

  bootTick = setInterval(function () {
    bootSec += 1;
    var ver = document.getElementById("boot-ver");
    if (ver) ver.textContent = bootSec + "s · v" + VERSION;
  }, 1000);

  showBoot("A iniciar…");

  var existing = readConfig();
  if (existing && existing.deviceToken) {
    startPlayback(existing);
    return;
  }
  if (existing && existing.deviceId && existing.pairingSecret && !existing.deviceToken) {
    showPairing(existing.activationCode || "———");
    startClaim(existing);
    return;
  }

  // First boot — start pairing
  setTimeout(startPairing, 0);
})();
