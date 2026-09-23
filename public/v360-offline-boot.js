/**
 * Minimal Passive Runtime offline boot — no Next.js hydration required.
 * Reads vitrine360-player IndexedDB CURRENT_MANIFEST + asset blobs.
 */
(function () {
  const DB_NAME = "vitrine360-player";
  const root = document.getElementById("root");
  const meta = document.getElementById("meta");
  let index = 0;
  let items = [];
  let timer = null;

  function openDb() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function get(store, key) {
    return openDb().then(function (db) {
      return new Promise(function (resolve) {
        const tx = db.transaction(store, "readonly");
        const r = tx.objectStore(store).get(key);
        r.onsuccess = function () {
          resolve(r.result || null);
          db.close();
        };
        r.onerror = function () {
          resolve(null);
          db.close();
        };
      });
    });
  }

  function showEmpty(msg) {
    root.innerHTML =
      '<div><div class="brand">VITRINE360</div><h1>OFFLINE</h1><p>' +
      (msg || "Sem conteúdo local. Reconecte para sincronizar.") +
      "</p></div>";
  }

  function renderItem(item) {
    if (!item) {
      showEmpty();
      return;
    }
    const type = item.type || "";
    if (type === "IMAGE" || type === "VIDEO") {
      const assetId = item.assets && item.assets[0] && item.assets[0].id;
      if (!assetId) {
        showEmpty("Asset em falta");
        return;
      }
      get("blobs", assetId).then(function (blob) {
        if (!blob) {
          showEmpty("Media offline em falta");
          return;
        }
        const url = URL.createObjectURL(blob);
        if (type === "VIDEO") {
          root.innerHTML =
            '<video src="' +
            url +
            '" autoplay muted playsinline loop style="width:100%;height:100%;object-fit:cover"></video>';
        } else {
          root.innerHTML =
            '<img src="' + url + '" alt="" style="width:100%;height:100%;object-fit:cover" />';
        }
      });
      return;
    }

    const payload = item.payload || {};
    const body =
      payload.body ||
      payload.message ||
      payload.description ||
      item.title ||
      "";
    root.innerHTML =
      '<div><div class="brand">VITRINE360</div><h1>' +
      escapeHtml(item.title || "") +
      "</h1><p>" +
      escapeHtml(String(body)) +
      "</p></div>";
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tick() {
    if (!items.length) return;
    renderItem(items[index]);
    const duration = Math.max(Number(items[index].durationMs) || 8000, 2000);
    index = (index + 1) % items.length;
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(tick, duration);
  }

  function tryOnlineRedirect() {
    if (!navigator.onLine) return;
    fetch("/player", { method: "HEAD", cache: "no-store" })
      .then(function (res) {
        if (res.ok) location.replace("/player");
      })
      .catch(function () {});
  }

  function clearObjectStores(db) {
    return new Promise(function (resolve) {
      try {
        const names = Array.from(db.objectStoreNames || []);
        if (!names.length) {
          db.close();
          resolve(true);
          return;
        }
        const tx = db.transaction(names, "readwrite");
        names.forEach(function (name) {
          tx.objectStore(name).clear();
        });
        tx.oncomplete = function () {
          db.close();
          resolve(true);
        };
        tx.onerror = function () {
          db.close();
          resolve(false);
        };
      } catch (e) {
        try {
          db.close();
        } catch (e) {
          /* ignore */
        }
        resolve(false);
      }
    });
  }

  function clearLocalAndBoot() {
    return new Promise(function (resolve) {
      const open = indexedDB.open(DB_NAME);
      open.onsuccess = function () {
        clearObjectStores(open.result).then(function (ok) {
          const del = indexedDB.deleteDatabase(DB_NAME);
          del.onsuccess = function () {
            resolve(ok);
          };
          del.onerror = function () {
            resolve(ok);
          };
          del.onblocked = function () {
            resolve(ok);
          };
        });
      };
      open.onerror = function () {
        const del = indexedDB.deleteDatabase(DB_NAME);
        del.onsuccess = function () {
          resolve(true);
        };
        del.onerror = function () {
          resolve(false);
        };
        del.onblocked = function () {
          resolve(false);
        };
      };
      open.onupgradeneeded = function () {
        // empty DB created — still delete below via onsuccess path
      };
    });
  }

  var params = new URLSearchParams(window.location.search);
  if (params.get("reset") === "1") {
    clearLocalAndBoot().then(function () {
      var url = new URL(window.location.href);
      url.searchParams.delete("reset");
      if (navigator.onLine) {
        // Prefer live Player (Next) reset/pair path when network is up
        location.replace("/player");
        return;
      }
      history.replaceState({}, "", url.pathname);
      showEmpty("Cache limpo. Reconecte para emparelhar.");
      meta.textContent = "offline-boot · reset";
    });
    return;
  }

  get("meta", "CURRENT_MANIFEST")
    .then(function (manifest) {
      const playlist = manifest && manifest.playlist;
      items = (playlist && playlist.items) || [];
      meta.textContent =
        "offline-boot · manifest=v" +
        ((manifest && manifest.manifestVersion) || 0) +
        " · items=" +
        items.length;
      if (!items.length) {
        showEmpty();
      } else {
        tick();
      }
      window.setInterval(tryOnlineRedirect, 15000);
      window.addEventListener("online", tryOnlineRedirect);
    })
    .catch(function () {
      showEmpty("Falha a ler cache local");
    });
})();
