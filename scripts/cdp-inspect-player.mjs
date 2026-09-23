const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const prefer = process.env.CDP_URL_INCLUDES || "";
const page =
  (prefer &&
    list.find(
      (t) => t.type === "page" && String(t.url || "").includes(prefer),
    )) ||
  list.find(
    (t) =>
      t.type === "page" && String(t.url || "").includes("trycloudflare.com/player"),
  ) ||
  list.find(
    (t) =>
      t.type === "page" && String(t.url || "").includes("127.0.0.1:3000/player"),
  ) ||
  list.find(
    (t) =>
      t.type === "page" && String(t.url || "").includes("127.0.0.1:3006/player"),
  ) ||
  list.find(
    (t) => t.type === "page" && String(t.url || "").includes("/player"),
  );
if (!page?.webSocketDebuggerUrl) {
  console.error("No player tab", list.map((t) => t.url));
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

const action = process.argv[2] || "inspect";

if (action === "reload") {
  await send("Page.reload", { ignoreCache: false });
  await new Promise((r) => setTimeout(r, 6000));
}

if (action === "offline-reload") {
  await send("Network.enable");
  await send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await send("Page.reload", { ignoreCache: false });
  await new Promise((r) => setTimeout(r, 4000));
}

if (action === "online") {
  await send("Network.enable");
  await send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
}

const result = await send("Runtime.evaluate", {
  expression: `(() => ({
    href: location.href,
    title: document.title,
    text: (document.body && document.body.innerText || "").slice(0, 800),
    sw: !!navigator.serviceWorker.controller,
    readyState: document.readyState,
    caches: typeof caches !== "undefined"
  }))()`,
  returnByValue: true,
});
console.log(JSON.stringify(result.result?.value ?? result, null, 2));

if (action === "cache-keys") {
  const keys = await send("Runtime.evaluate", {
    expression: `(async () => {
      const names = await caches.keys();
      const out = {};
      for (const n of names) {
        const c = await caches.open(n);
        const reqs = await c.keys();
        out[n] = reqs.map(r => r.url);
      }
      const reg = await navigator.serviceWorker.getRegistration();
      return { names, out, sw: reg && reg.active && reg.active.scriptURL };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log(JSON.stringify(keys.result?.value ?? keys, null, 2));
}

ws.close();
