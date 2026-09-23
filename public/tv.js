/**
 * Vanilla Smart TV player — full slideshow + pairing.
 * No React, no IndexedDB, no Service Worker — ES5 safe.
 * v0.1.9: Preserves media aspect ratio without cropping.
 */
(function () {
  var LS_KEY = "v360-player-config";
  var VERSION = "0.1.20-smarttv-static";
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

  var pairingClockTimer = null;
  var claimInFlight = false;

  function showPairing(code, expiresAt) {
    if (bootTick) clearInterval(bootTick);
    if (pairingClockTimer) clearInterval(pairingClockTimer);
    
    var expiresTime = expiresAt ? new Date(expiresAt).getTime() : 0;

    function renderCode(timeLeftStr) {
    setHtml(
      '<p class="brand">Vitrine360</p>' +
        '<p class="muted" style="margin-top:16px">Código de activação</p>' +
        '<p class="code">' +
        (code || "———") +
        "</p>" +
          (timeLeftStr ? '<p style="color:#ff6b6b;margin-top:16px;font-size:18px;font-weight:bold">' + timeLeftStr + '</p>' : '') +
        '<p class="muted" style="margin-top:40px;max-width:420px;font-size:16px">' +
        "Introduza este código no Admin Console para associar este dispositivo." +
        "</p>" +
        '<p class="muted" style="margin-top:24px;font-size:12px">v' +
        VERSION +
          " · Smart TV</p>"
      );
    }
    
    renderCode("");

    if (expiresTime > 0) {
      pairingClockTimer = setInterval(function() {
        var now = new Date().getTime();
        var diff = expiresTime - now;
        if (diff <= 0) {
          clearInterval(pairingClockTimer);
          renderCode("O código expirou. A recarregar...");
          setTimeout(function() { location.reload(); }, 3000);
          return;
        }
        var m = Math.floor(diff / 60000);
        var s = Math.floor((diff % 60000) / 1000);
        renderCode("Expira em " + m + ":" + (s < 10 ? "0" + s : s));
      }, 1000);
    }
  }

  /* ── Network helpers (XHR, ES5 safe) ─────────────────── */

  function handleUnauthorized() {
    writeConfig(null);
    location.reload();
  }

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
        } else if (xhr.status === 401) {
          handleUnauthorized();
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
        } else if (xhr.status === 401) {
          handleUnauthorized();
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
      if (claimInFlight) return;
      claimInFlight = true;
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
          claimInFlight = false;
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
          claimInFlight = false;
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
          expiresAt: data.expiresAt,
        };
        writeConfig(cfg);
        showPairing(data.activationCode, data.expiresAt);
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
    // -1 = no local manifest yet: guarantees the server sends the current
    // manifest on first sync even when the device manifestVersion is still 0.
    manifestVersion: -1,
    slideTimer: null,
    heartbeatTimer: null,
    syncTimer: null,
    onlineHandler: null,
    clockTimer: null,
    fingerprint: "",
    generation: 0,
    token: null,
    deviceId: null,
    deviceCode: null,
  };
  var MANIFEST_KEY = "v360-tv-current-manifest";
  var MEDIA_CACHE_NAME = "v360-tv-media-v1";
  var MEDIA_DB_NAME = "v360-tv-media-v1";
  var MEDIA_DB_STORE = "assets";
  var mediaObjectUrls = {};
  var emptyManifestRecoveryAttempted = false;

  function readCachedManifest() {
    try {
      var raw = localStorage.getItem(MANIFEST_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeCachedManifest(manifest) {
    try {
      localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
    } catch (e) {
      /* storage may be unavailable or full */
    }
  }

  function isSameOriginUrl(url) {
    return url && (url.charAt(0) === "/" ||
      url.indexOf(window.location.origin) === 0);
  }

  function loadAssetBlob(url) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var xhr = new XMLHttpRequest();
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        try { xhr.abort(); } catch (e) { /* ignore */ }
        reject(new Error("asset timeout"));
      }, 8000);
      xhr.open("GET", url, true);
      if (isSameOriginUrl(url) && playState.token) {
        xhr.setRequestHeader("Authorization", "Bearer " + playState.token);
      }
      xhr.responseType = "blob";
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || settled) return;
        settled = true;
        clearTimeout(timer);
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
          resolve(xhr.response);
        } else {
          reject(new Error("asset HTTP " + xhr.status));
        }
      };
      xhr.onerror = function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error("asset network error"));
      };
      xhr.send();
    });
  }

  function openMediaDb() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      var request;
      try {
        request = window.indexedDB.open(MEDIA_DB_NAME, 1);
      } catch (e) {
        resolve(null);
        return;
      }
      request.onupgradeneeded = function () {
        try {
          request.result.createObjectStore(MEDIA_DB_STORE, { keyPath: "id" });
        } catch (e) {
          /* store already exists */
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { resolve(null); };
    });
  }

  function readStoredAsset(asset) {
    return openMediaDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(MEDIA_DB_STORE, "readonly");
          var request = tx.objectStore(MEDIA_DB_STORE).get(asset.id || asset.url);
          request.onsuccess = function () {
            resolve(request.result && request.result.blob ? request.result.blob : null);
          };
          request.onerror = function () { resolve(null); };
        } catch (e) {
          resolve(null);
        }
      });
    });
  }

  function storeAsset(asset, blob) {
    return openMediaDb().then(function (db) {
      if (!db || !blob) return;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(MEDIA_DB_STORE, "readwrite");
          tx.objectStore(MEDIA_DB_STORE).put({
            id: asset.id || asset.url,
            url: asset.url,
            checksum: asset.checksum || "",
            blob: blob
          });
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
          tx.onabort = function () { resolve(); };
        } catch (e) {
          resolve();
        }
      });
    });
  }

  function blobObjectUrl(asset, blob) {
    if (!blob) return asset.url;
    var key = asset.id || asset.url;
    if (mediaObjectUrls[key]) return mediaObjectUrls[key];
    var objectUrl = URL.createObjectURL(blob);
    mediaObjectUrls[key] = objectUrl;
    return objectUrl;
  }

  function isVideoAsset(asset) {
    return (
      (asset.mimeType && asset.mimeType.indexOf("video/") === 0) ||
      /\.(mp4|webm|ogg|mov)(\?|$)/i.test(asset.fileName || asset.url || "")
    );
  }

  function cacheVideoAsset(asset, cacheUrl) {
    return readStoredAsset(asset).then(function (storedBlob) {
      if (storedBlob) return blobObjectUrl(asset, storedBlob);
      if (!navigator.onLine) return asset.url;
      return loadAssetBlob(cacheUrl).then(function (blob) {
        return storeAsset(asset, blob).then(function () {
          return blobObjectUrl(asset, blob);
        });
      });
    });
  }

  function cacheAsset(asset) {
    if (!asset || !asset.url) return Promise.resolve(asset && asset.url);
    var assetKey = asset.id || asset.url;
    var cacheUrl = asset.offlineUrl || asset.url;
    if (mediaObjectUrls[assetKey]) return Promise.resolve(mediaObjectUrls[assetKey]);
    if (isVideoAsset(asset)) {
      return cacheVideoAsset(asset, cacheUrl).catch(function () {
        return asset.url;
      });
    }

    var cachePromise = window.caches
      ? caches.open(MEDIA_CACHE_NAME).then(function (cache) {
          return cache.match(cacheUrl).then(function (cached) {
            if (cached) return cached;
            if (!navigator.onLine) return null;
            if (typeof window.fetch === "function") {
              var fetchOptions = isSameOriginUrl(cacheUrl) && playState.token
                ? { headers: { Authorization: "Bearer " + playState.token } }
                : {};
              return window.fetch(cacheUrl, fetchOptions).then(function (response) {
                if (!response.ok) return null;
                return cache.put(cacheUrl, response.clone())
                  .then(function () { return response; })
                  .catch(function () { return response; });
              });
            }
            return loadAssetBlob(cacheUrl).then(function (blob) {
              if (typeof window.Response === "function") {
                return cache.put(cacheUrl, new window.Response(blob))
                  .then(function () {
                    return { blob: function () { return Promise.resolve(blob); } };
                  })
                  .catch(function () {
                    return { blob: function () { return Promise.resolve(blob); } };
                  });
              }
              return { blob: function () { return Promise.resolve(blob); } };
            });
          });
        })
      : Promise.resolve(null);

    var boundedCachePromise = Promise.race([
      cachePromise,
      new Promise(function (resolve) {
        setTimeout(function () { resolve(null); }, 3000);
      })
    ]);

    return readStoredAsset(asset)
      .then(function (storedBlob) {
        if (storedBlob) return blobObjectUrl(asset, storedBlob);
        return boundedCachePromise.then(function (response) {
          if (!response) return asset.url;
          return response.blob().then(function (blob) {
            return storeAsset(asset, blob).then(function () {
              return blobObjectUrl(asset, blob);
            });
          });
        });
      })
      .catch(function () {
        return asset.url;
      });
  }

  function prepareItems(items) {
    return Promise.all((items || []).map(function (item) {
      if (!item.assets || !item.assets.length) return Promise.resolve(item);
      return Promise.all(item.assets.map(function (asset) {
        return cacheAsset(asset).then(function (url) {
          return Object.assign({}, asset, { url: url });
        });
      })).then(function (assets) {
        return Object.assign({}, item, { assets: assets });
      });
    }));
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Sraf/Hisense often ignore CSS clamp()/vw — size type from viewport height in px. */
  function tvFontPx(fractionOfHeight, minPx, maxPx) {
    var h =
      window.innerHeight ||
      (document.documentElement && document.documentElement.clientHeight) ||
      720;
    var px = Math.round(Number(h) * Number(fractionOfHeight));
    if (!(px > 0)) px = minPx;
    if (px < minPx) px = minPx;
    if (px > maxPx) px = maxPx;
    return px;
  }

  function buildMediaUrl(item) {
    if (item.assets && item.assets.length) return item.assets[0].url;
    if (item.payload && item.payload.url) return item.payload.url;
    return null;
  }

  function assetPixelSize(item) {
    var asset = item.assets && item.assets[0];
    if (!asset) return { w: 0, h: 0 };
    return { w: Number(asset.width) || 0, h: Number(asset.height) || 0 };
  }

  function slideDuration(item) {
    var duration = Number(item && item.durationMs);
    if (duration > 0) return duration;
    return 8000;
  }

  function isGifItem(item) {
    var asset = item && item.assets && item.assets[0];
    var mime = asset && asset.mimeType ? String(asset.mimeType) : "";
    var name = asset && asset.fileName ? String(asset.fileName) : "";
    var url = buildMediaUrl(item) || "";
    if (/image\/gif/i.test(mime)) return true;
    if (/\.gif(\?|#|$)/i.test(name)) return true;
    if (/\.gif(\?|#|$)/i.test(url)) return true;
    return false;
  }

  /**
   * Animated GIF decode can stall Sraf/Hisense so setTimeout never arms if
   * hold() runs after inserting <img src="…gif">. Always arm the timer first.
   * Prefer a static first frame (canvas) — never keep an animated GIF in the DOM.
   */
  function renderGifTitleCard(item) {
    setHtml(
      '<div class="slide ' +
        transitionClass(item.transition) +
        '" style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'height:100%;padding:60px;background:#0b1220;text-align:center">' +
        '<p style="font-size:14px;letter-spacing:0.4em;opacity:0.4;margin:0">VITRINE360</p>' +
        '<h1 style="font-size:clamp(2rem,5vw,3.5rem);font-weight:600;margin:32px 0 0;max-width:900px;line-height:1.2">' +
        escapeHtml(item.title || "GIF") +
        "</h1>" +
        '<p style="font-size:16px;margin-top:24px;opacity:0.55">GIF (frame estático · Smart TV)</p>' +
        "</div>"
    );
  }

  function renderImageSlide(item, generation) {
    var imgUrl = buildMediaUrl(item);
    if (!imgUrl) {
      renderNoContent();
      return;
    }
    var duration = slideDuration(item);
    // Arm advance BEFORE any GIF decode / DOM work.
    hold(duration, generation);

    if (!isGifItem(item)) {
      setHtml(
        '<div class="slide ' +
          transitionClass(item.transition) +
          '" style="background:#000;display:flex;align-items:center;justify-content:center">' +
          '<img src="' +
          escapeHtml(imgUrl) +
          '" alt="' +
          escapeHtml(item.title) +
          '"' +
          ' style="position:relative;width:100%;height:100%;object-fit:contain" />' +
          "</div>"
      );
      return;
    }

    var asset0 = item.assets && item.assets[0];
    var fetchUrl =
      asset0 && asset0.offlineUrl ? String(asset0.offlineUrl) : imgUrl;

    function paintStaticFromBlob(blob) {
      if (playState.generation !== generation) return;
      var blobUrl = null;
      try {
        blobUrl =
          (window.URL && URL.createObjectURL)
            ? URL.createObjectURL(blob)
            : null;
      } catch (eBlob) {
        blobUrl = null;
      }
      if (!blobUrl) {
        renderGifTitleCard(item);
        return;
      }
      var loader = new Image();
      loader.onload = function () {
        if (playState.generation !== generation) {
          try {
            URL.revokeObjectURL(blobUrl);
          } catch (eRev) {
            /* ignore */
          }
          return;
        }
        var staticUrl = null;
        try {
          var canvas = document.createElement("canvas");
          var w = loader.naturalWidth || loader.width || 1;
          var h = loader.naturalHeight || loader.height || 1;
          // Cap decode cost on low-end TVs
          var maxEdge = 1280;
          if (w > maxEdge || h > maxEdge) {
            var scale = Math.min(maxEdge / w, maxEdge / h);
            w = Math.max(1, Math.round(w * scale));
            h = Math.max(1, Math.round(h * scale));
          }
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(loader, 0, 0, w, h);
            staticUrl = canvas.toDataURL("image/jpeg", 0.8);
          }
        } catch (eCanvas) {
          staticUrl = null;
        }
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (eRev2) {
          /* ignore */
        }
        if (staticUrl) {
          setHtml(
            '<div class="slide ' +
              transitionClass(item.transition) +
              '" style="background:#000;display:flex;align-items:center;justify-content:center">' +
              '<img src="' +
              staticUrl +
              '" alt="' +
              escapeHtml(item.title) +
              '"' +
              ' style="position:relative;width:100%;height:100%;object-fit:contain" />' +
              "</div>"
          );
          return;
        }
        renderGifTitleCard(item);
      };
      loader.onerror = function () {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (eRev3) {
          /* ignore */
        }
        if (playState.generation !== generation) return;
        renderGifTitleCard(item);
      };
      loader.src = blobUrl;
    }

    loadAssetBlob(fetchUrl)
      .then(paintStaticFromBlob)
      .catch(function () {
        // Fallback: try remote URL once; if that also stalls, hold() still advances.
        if (fetchUrl === imgUrl) {
          if (playState.generation === generation) renderGifTitleCard(item);
          return;
        }
        loadAssetBlob(imgUrl)
          .then(paintStaticFromBlob)
          .catch(function () {
            if (playState.generation === generation) renderGifTitleCard(item);
          });
      });
  }

  function playlistFingerprint(items) {
    var parts = [];
    var i;
    for (i = 0; i < items.length; i++) {
      var item = items[i];
      var asset = item.assets && item.assets[0];
      parts.push(
        [
          item.playlistItemId || "",
          item.contentId || "",
          item.type || "",
          item.durationMs || 0,
          asset ? asset.id || "" : "",
        ].join(":")
      );
    }
    return parts.join("|");
  }

  function hold(ms, generation) {
    if (playState.slideTimer) {
      clearTimeout(playState.slideTimer);
      playState.slideTimer = null;
    }
    playState.slideTimer = setTimeout(function () {
      if (playState.generation !== generation) return;
      advanceSlide();
    }, ms > 0 ? ms : 8000);
  }

  // Sraf paints object-fit:contain in a corner of a full-screen box.
  // Size the element to the contained rectangle and center that box.
  function placeContained(el, nw, nh) {
    nw = Number(nw) || 0;
    nh = Number(nh) || 0;
    if (!el || nw < 1 || nh < 1) return false;
    var stage = el.parentNode;
    var sw = stage && stage.clientWidth ? stage.clientWidth : 0;
    var sh = stage && stage.clientHeight ? stage.clientHeight : 0;
    if (sw < 2) sw = window.innerWidth || document.documentElement.clientWidth || 0;
    if (sh < 2) sh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (sw < 2 || sh < 2) return false;
    var scale = Math.min(sw / nw, sh / nh);
    var w = Math.max(1, Math.round(nw * scale));
    var h = Math.max(1, Math.round(nh * scale));
    el.style.position = "absolute";
    el.style.left = Math.round((sw - w) / 2) + "px";
    el.style.top = Math.round((sh - h) / 2) + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.style.width = w + "px";
    el.style.height = h + "px";
    el.style.maxWidth = "none";
    el.style.maxHeight = "none";
    el.style.margin = "0";
    el.style.opacity = "1";
    el.setAttribute("width", String(w));
    el.setAttribute("height", String(h));
    return true;
  }

  function renderSlide(item, generation) {
    if (!item) {
      renderNoContent();
      return;
    }

    var type = item.type || "";

    if (type === "EXPERIENCE") {
      /* EXPERIENCE-09: Legacy must NOT execute Experience packages. */
      var expBrand = tvFontPx(0.028, 20, 36);
      var expTitle = tvFontPx(0.1, 56, 140);
      var expSub = tvFontPx(0.04, 28, 56);
      setHtml(
        '<div class="slide ' + transitionClass(item.transition) + '" style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
          'height:100%;padding:6vh 8vw;box-sizing:border-box;background:linear-gradient(160deg,#0b1220 0%,#132033 55%,#1a2740 100%);text-align:center">' +
          '<p style="font-size:' + expBrand + 'px;letter-spacing:0.35em;opacity:0.45;margin:0;font-weight:600">VITRINE360</p>' +
          '<h1 style="font-size:' + expTitle + 'px;font-weight:700;margin:' + Math.round(expTitle * 0.35) + 'px 0 0;max-width:92vw;line-height:1.15">' +
            escapeHtml(item.title || "Experience") +
          '</h1>' +
          '<p style="font-size:' + expSub + 'px;margin:' + Math.round(expSub * 0.7) + 'px 0 0;opacity:0.65">EXPERIENCE_UNSUPPORTED</p>' +
        '</div>'
      );
      hold(slideDuration(item), generation);
      return;
    }

    if (type === "IMAGE") {
      renderImageSlide(item, generation);
      return;
    }

    if (type === "VIDEO") {
      showVideo(item, true, generation);
      return;
    }

    if (type === "CLOCK") {
      renderClock(item);
      return;
    }

    // TEXT, NOTICE, EVENT, NEWS, QR_CODE — TV-scale type (no clamp — Sraf drops it)
    var payload = item.payload || {};
    var body = payload.body || payload.message || payload.description || "";
    var brandPx = tvFontPx(0.028, 20, 36);
    var titlePx = tvFontPx(0.11, 64, 160);
    var bodyPx = tvFontPx(0.055, 36, 84);
    setHtml(
      '<div class="slide ' + transitionClass(item.transition) + '" style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'height:100%;padding:6vh 8vw;box-sizing:border-box;background:linear-gradient(160deg,#0b1220 0%,#132033 55%,#1a2740 100%);text-align:center">' +
        '<p style="font-size:' + brandPx + 'px;letter-spacing:0.35em;opacity:0.45;margin:0;font-weight:600">VITRINE360</p>' +
        '<h1 style="font-size:' + titlePx + 'px;font-weight:700;margin:' + Math.round(titlePx * 0.35) + 'px 0 0;max-width:92vw;line-height:1.15">' +
          escapeHtml(item.title) +
        '</h1>' +
        (body ? '<p style="font-size:' + bodyPx + 'px;margin:' + Math.round(bodyPx * 0.7) + 'px auto 0;max-width:88vw;opacity:0.88;line-height:1.35;font-weight:500">' +
          escapeHtml(body) + '</p>' : '') +
      '</div>'
    );
  }

  var preloadedVideo = null;

  function playVideoElement(video) {
    if (!video || !video.play) return;
    try {
      var attempt = video.play();
      if (attempt && attempt.catch) attempt.catch(function () {});
    } catch (e) {
      /* the autoplay attribute remains the fallback */
    }
  }

  function stopVideoElement(video) {
    if (!video) return;
    video.onended = null;
    video.onerror = null;
    try { video.pause(); } catch (e) { /* already stopped */ }
    try {
      video.removeAttribute("src");
      video.src = "";
      if (video.load) video.load();
    } catch (e2) { /* release the TV video plane */ }
  }

  function preloadNextVideo() {
    /* A hidden <video> on Hisense is promoted to a fullscreen white plane
       and covers the slides. The next video is created only when it plays. */
  }

  function showVideo(item, replaceAll, generation) {
    var vidUrl = buildMediaUrl(item);
    if (!vidUrl) { renderNoContent(); return; }
    var host = document.getElementById("root");
    var layer = document.createElement("div");
    layer.className = "slide";
    layer.style.cssText = "background:#000;z-index:2;display:none;align-items:center;justify-content:center";

    var video = document.createElement("video");
    video.id = "v360-video";
    video.muted = true;
    video.autoplay = true;
    video.preload = "auto";
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");
    video.style.cssText = "width:100%;height:100%;object-fit:contain;background:#000";
    layer.appendChild(video);

    var duration = Number(item.durationMs);
    var revealed = false;
    var clockStarted = false;

    function armClock() {
      if (clockStarted || playState.generation !== generation) return;
      clockStarted = true;
      if (duration > 0) {
        video.onended = function () {
          if (playState.generation !== generation) return;
          try {
            video.currentTime = 0;
            playVideoElement(video);
          } catch (e) { /* keep the slide until the configured time */ }
        };
        hold(duration, generation);
        return;
      }
      video.onended = function () {
        if (playState.generation !== generation) return;
        advanceSlide();
      };
      video.onerror = function () {
        hold(2000, generation);
      };
      var seconds = Number(video.duration);
      if (seconds && isFinite(seconds) && seconds > 0.2) {
        hold(Math.round(seconds * 1000) + 400, generation);
      }
    }

    function reveal() {
      if (revealed || playState.generation !== generation) return;
      revealed = true;
      layer.style.display = "flex";
      if (!replaceAll) {
        var slides = host.getElementsByClassName("slide");
        var i;
        for (i = slides.length - 1; i >= 0; i--) {
          if (slides[i] !== layer) host.removeChild(slides[i]);
        }
      }
      armClock();
    }

    if (replaceAll) setHtml("");
    host.appendChild(layer);
    video.src = vidUrl;
    video.addEventListener("playing", reveal);
    video.addEventListener("timeupdate", function () {
      if (video.currentTime > 0) reveal();
    });
    playVideoElement(video);
    setTimeout(function () {
      if (revealed || playState.generation !== generation) return;
      stopVideoElement(video);
      advanceSlide();
    }, 8000);
  }

  function transitionClass(value) {
    if (value === "slide-left") return "slide-left";
    if (value === "zoom") return "zoom";
    if (value === "cut") return "cut";
    return "fade-in";
  }

  function renderClock(item) {
    if (playState.clockTimer) clearInterval(playState.clockTimer);

    var payload = (item && item.payload) || {};
    var showSeconds = payload.showSeconds === true;
    var showDate = payload.showDate !== false;
    var showTime = payload.showTime !== false;
    var hour12 = payload.format === "12h";

    function pad2(n) {
      var s = String(n);
      return s.length < 2 ? "0" + s : s;
    }

    function update() {
      var now = new Date();
      var h = now.getHours();
      var m = now.getMinutes();
      var sec = now.getSeconds();
      if (hour12) {
        var ampm = h >= 12 ? "PM" : "AM";
        h = h % 12;
        if (h === 0) h = 12;
        var timeStr = pad2(h) + ":" + pad2(m) + (showSeconds ? ":" + pad2(sec) : "") + " " + ampm;
      } else {
        var timeStr2 = pad2(h) + ":" + pad2(m) + (showSeconds ? ":" + pad2(sec) : "");
        timeStr = timeStr2;
      }
      var dateStr = now.toLocaleDateString();
      var timePx = tvFontPx(0.32, 120, 320);
      var datePx = tvFontPx(0.07, 40, 88);
      var html =
        '<div class="slide" style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'height:100%;background:#0b1220;text-align:center;padding:4vh 6vw;box-sizing:border-box">';
      if (showTime) {
        html +=
          '<p style="font-size:' +
          timePx +
          'px;font-weight:700;margin:0;line-height:1;letter-spacing:0.04em;' +
          'font-variant-numeric:tabular-nums;font-family:ui-monospace,Consolas,monospace">' +
          timeStr +
          "</p>";
      }
      if (showDate) {
        html +=
          '<p style="font-size:' +
          datePx +
          "px;margin-top:" +
          Math.round(datePx * 0.55) +
          'px;opacity:0.78;font-weight:500">' +
          dateStr +
          "</p>";
      }
      html += "</div>";
      setHtml(html);
    }

    update();
    playState.clockTimer = setInterval(update, showSeconds ? 1000 : 5000);
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
    if (playState.slideTimer) { clearTimeout(playState.slideTimer); playState.slideTimer = null; }
    
    // Cleanup previous video listeners if any
    var oldVid = document.getElementById("v360-video");
    stopVideoElement(oldVid);
    if (preloadedVideo) {
      stopVideoElement(preloadedVideo);
      if (preloadedVideo.parentNode) preloadedVideo.parentNode.removeChild(preloadedVideo);
      preloadedVideo = null;
    }

    if (!playState.items.length) {
      renderNoContent();
      return;
    }

    playState.generation += 1;
    var generation = playState.generation;
    var item = playState.items[playState.index];
    var previousSlides = document.getElementsByClassName("slide");
    if (item.type === "VIDEO") {
      showVideo(item, previousSlides.length === 0, generation);
    } else {
      renderSlide(item, generation);
      if (item.type !== "IMAGE") hold(slideDuration(item), generation);
    }

    playState.index = (playState.index + 1) % playState.items.length;
    preloadNextVideo();
  }

  function applyPlaylist(items) {
    if (!items || !items.length) return;
    var fingerprint = playlistFingerprint(items);
    var same = fingerprint === playState.fingerprint && playState.items.length;
    playState.items = items;
    playState.fingerprint = fingerprint;
    if (same) return;
    playState.index = 0;
    advanceSlide();
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
        if (data.upToDate || !data.manifest) {
          // A previous sync may have persisted only the manifest version
          // before its playlist was written. Force one uncached recovery
          // request instead of accepting an empty local state forever.
          if (
            !playState.items.length &&
            !emptyManifestRecoveryAttempted
          ) {
            emptyManifestRecoveryAttempted = true;
            playState.manifestVersion = -1;
            setTimeout(doSync, 250);
            return;
          }
          if (!playState.items.length) renderNoContent();
          return;
        }
        var manifest = data.manifest;
        playState.manifestVersion = manifest.manifestVersion || 0;

        var playlist = manifest.playlist;
        if (playlist && playlist.items && playlist.items.length) {
          writeCachedManifest(manifest);
          // Play remote URLs immediately (Sraf freezes if we block on IDB/Cache).
          // Background prepareItems swaps in local blob/cache URLs when ready;
          // fingerprint ignores URL so same content does not restart the slideshow.
          applyPlaylist(playlist.items);
          prepareItems(playlist.items).then(function (prepared) {
            applyPlaylist(prepared);
          }).catch(function () { /* keep remote URLs */ });
        } else {
          // Keep any previously cached playlist when the server temporarily
          // returns an empty manifest during assignment/update.
          if (!playState.items.length && !emptyManifestRecoveryAttempted) {
            emptyManifestRecoveryAttempted = true;
            playState.manifestVersion = -1;
            setTimeout(doSync, 250);
          } else if (!playState.items.length) {
            renderNoContent();
          }
        }
      })
      .catch(function (e) {
        // Never leave a fresh device stuck on the sync screen forever.
        if (!playState.items.length) renderNoContent();
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
    if (playState.onlineHandler) {
      window.removeEventListener("online", playState.onlineHandler);
    }

    playState.token = cfg.deviceToken;
    playState.deviceId = cfg.deviceId;
    playState.deviceCode = cfg.deviceCode || null;

    // Apply full-bleed playback styles (not Fullscreen API)
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    document.body.style.background = "#070b14";
    // Cursor owned by canonical AUTO_HIDE controller on documentElement
    document.body.style.cursor = "";
    document.documentElement.style.cursor = "none";
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

    var cached = readCachedManifest();
    if (cached && cached.playlist && cached.playlist.items && cached.playlist.items.length) {
      playState.manifestVersion = cached.manifestVersion || 0;
      applyPlaylist(cached.playlist.items);
      prepareItems(cached.playlist.items).then(function (prepared) {
        applyPlaylist(prepared);
      }).catch(function () { /* keep cached remote URLs */ });
    }

    // Initial sync
    doSync();
    playState.onlineHandler = function () {
      doSync();
    };
    window.addEventListener("online", playState.onlineHandler);

    // Periodic sync every 60s
    if (playState.syncTimer) clearInterval(playState.syncTimer);
    playState.syncTimer = setInterval(doSync, 60000);

    // Heartbeat every 30s
    if (playState.heartbeatTimer) clearInterval(playState.heartbeatTimer);
    playState.heartbeatTimer = setInterval(doHeartbeat, 30000);

    // First heartbeat after 3s
    setTimeout(doHeartbeat, 3000);
  }

  /* ── Cursor Idle Interaction (RUNTIME-POLICY-02) ─────────
   * Canonical target: document.documentElement
   * AUTO_HIDE: hidden → input visible → 3000ms idle → hidden
   * Single timer; Pointer Events preferred over mouse when available.
   */

  var CURSOR_IDLE_TIMEOUT_MS = 3000;
  var cursorTimeout = null;
  var cursorAttached = false;
  var cursorHandler = null;
  var cursorEventTypes = null;

  function cursorTarget() {
    return document.documentElement;
  }

  function setCursorHidden() {
    cursorTarget().style.cursor = "none";
  }

  function setCursorVisible() {
    cursorTarget().style.cursor = "auto";
  }

  function clearCursorTimer() {
    if (cursorTimeout) {
      clearTimeout(cursorTimeout);
      cursorTimeout = null;
    }
  }

  function showCursorTemporarily() {
    setCursorVisible();
    clearCursorTimer();
    cursorTimeout = setTimeout(function () {
      cursorTimeout = null;
      setCursorHidden();
    }, CURSOR_IDLE_TIMEOUT_MS);
  }

  function cursorEventList() {
    var types = ["touchstart", "keydown"];
    if (typeof window.PointerEvent === "function") {
      types.push("pointermove", "pointerdown");
    } else {
      types.push("mousemove", "mousedown");
    }
    return types;
  }

  function attachCursorIdle() {
    if (cursorAttached) return;
    cursorHandler = function () {
      showCursorTemporarily();
    };
    cursorEventTypes = cursorEventList();
    for (var i = 0; i < cursorEventTypes.length; i++) {
      window.addEventListener(cursorEventTypes[i], cursorHandler, false);
    }
    cursorAttached = true;
    document.body.style.cursor = "";
    setCursorHidden();
  }

  function detachCursorIdle() {
    clearCursorTimer();
    if (!cursorAttached || !cursorHandler || !cursorEventTypes) return;
    for (var i = 0; i < cursorEventTypes.length; i++) {
      window.removeEventListener(cursorEventTypes[i], cursorHandler, false);
    }
    cursorAttached = false;
    cursorHandler = null;
    cursorEventTypes = null;
  }

  attachCursorIdle();

  if (typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", detachCursorIdle, false);
  }

  /* ── Capability Probe (RUNTIME-POLICY-03) — diagnostics only ─
   * Minimal ES5 mirror of React probeRuntimeCapabilities.
   * Does NOT call requestFullscreen / orientation.lock / open IDB / register SW.
   * remote always false without vendor evidence.
   */
  function probeLegacyCapabilities() {
    var caps = {
      video: false,
      image: false,
      gif: false,
      touch: false,
      pointer: false,
      keyboard: false,
      remote: false,
      fullscreen: false,
      orientation: false,
      network: false,
      serviceWorker: false,
      indexedDB: false,
    };
    try {
      caps.image = typeof window.HTMLImageElement !== "undefined";
      caps.gif = caps.image;
      caps.pointer = typeof window.PointerEvent !== "undefined";
      caps.keyboard = typeof window.addEventListener === "function";
      caps.touch =
        typeof navigator.maxTouchPoints === "number" &&
        navigator.maxTouchPoints > 0;
      caps.network = typeof navigator.onLine === "boolean";
      caps.serviceWorker = "serviceWorker" in navigator;
      caps.indexedDB = "indexedDB" in window;
      try {
        var v = document.createElement("video");
        if (v && typeof v.canPlayType === "function") {
          var t =
            v.canPlayType("video/mp4") ||
            v.canPlayType('video/mp4; codecs="avc1.42E01E"');
          caps.video = t === "probably" || t === "maybe" || !!window.HTMLVideoElement;
        } else {
          caps.video = typeof window.HTMLVideoElement !== "undefined";
        }
      } catch (eVid) {
        caps.video = false;
      }
      var de = document.documentElement;
      caps.fullscreen = !!(
        de &&
        (typeof de.requestFullscreen === "function" ||
          typeof de.webkitRequestFullscreen === "function" ||
          typeof de.msRequestFullscreen === "function")
      );
      caps.orientation = !!(
        typeof screen !== "undefined" && screen.orientation
      );
      caps.remote = false;
    } catch (eProbe) {
      /* keep defaults */
    }
    var ua = (navigator.userAgent || "").slice(0, 240);
    window.__v360_runtime_capabilities = {
      capabilities: caps,
      environment: {
        userAgent: ua,
        fragileSmartTv:
          /Sraf|Web0S|Tizen|SmartTV|NetRange|HbbTV|Maple|Viera|Hisense|VIDAA/i.test(ua),
        secureContext: window.isSecureContext === true,
        language: navigator.language || "",
      },
      probedAt: new Date().toISOString(),
      ok: true,
      error: null,
      source: "legacy-tv.js",
    };
  }
  try {
    probeLegacyCapabilities();
  } catch (eCap) {
    /* non-fatal */
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
    if (existing.expiresAt && new Date(existing.expiresAt).getTime() <= Date.now()) {
      writeConfig(null);
      setTimeout(startPairing, 0);
      return;
    }
    showPairing(existing.activationCode || "———", existing.expiresAt);
    startClaim(existing);
    return;
  }

  // First boot — start pairing
  setTimeout(startPairing, 0);
})();
