import fs from "node:fs";

const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const page =
  list.find(
    (t) => t.type === "page" && String(t.url || "").includes("/player"),
  ) ||
  list.find(
    (t) =>
      t.type === "page" && String(t.url || "").includes("v360-offline.html"),
  ) ||
  list.find((t) => t.type === "page");

if (!page?.webSocketDebuggerUrl) {
  console.error("No Chrome page", list.map((t) => t.url));
  process.exit(1);
}

console.log("target", { title: page.title, url: page.url });

const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});

await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", reject);
});

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("ServiceWorker.enable").catch(() => undefined);

// Force SW update to pick up shell-v7 + reset-capable boot.js
const swUpdate = await send("Runtime.evaluate", {
  expression: `(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.update();
    return {
      script: reg && reg.active && reg.active.scriptURL,
      waiting: !!(reg && reg.waiting),
      installing: !!(reg && reg.installing),
    };
  })()`,
  returnByValue: true,
  awaitPromise: true,
});
console.log("SW_UPDATE", JSON.stringify(swUpdate.result?.value ?? swUpdate, null, 2));

await new Promise((r) => setTimeout(r, 2500));

// Hard reload to activate new SW
await send("Page.reload", { ignoreCache: true });
await new Promise((r) => setTimeout(r, 4000));

const before = await send("Runtime.evaluate", {
  expression: `(async () => {
    const dbs = (await indexedDB.databases?.()) || [];
    const names = await caches.keys();
    return {
      href: location.href,
      text: (document.body && document.body.innerText || "").slice(0, 300),
      dbs,
      caches: names,
    };
  })()`,
  returnByValue: true,
  awaitPromise: true,
});
console.log("BEFORE", JSON.stringify(before.result?.value ?? before, null, 2));

// Offline path: emulate offline then open offline html with reset
await send("Network.emulateNetworkConditions", {
  offline: true,
  latency: 0,
  downloadThroughput: 0,
  uploadThroughput: 0,
});
await send("Page.navigate", {
  url: "http://127.0.0.1:3000/v360-offline.html?reset=1",
});
await new Promise((r) => setTimeout(r, 4500));

const after = await send("Runtime.evaluate", {
  expression: `(async () => {
    const dbs = (await indexedDB.databases?.()) || [];
    const meta = document.getElementById("meta")?.textContent || "";
    return {
      href: location.href,
      title: document.title,
      text: (document.body && document.body.innerText || "").slice(0, 600),
      meta,
      dbs,
    };
  })()`,
  returnByValue: true,
  awaitPromise: true,
});
console.log("AFTER_RESET_OFFLINE", JSON.stringify(after.result?.value ?? after, null, 2));

const shot = await send("Page.captureScreenshot", { format: "png" });
const out = "docs/evidence/emu-fail-reset1.png";
fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log("wrote", out, Buffer.from(shot.data, "base64").length);

// Restore online for later tests
await send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});
ws.close();
