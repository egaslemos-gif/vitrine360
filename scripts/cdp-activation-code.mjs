/**
 * Read activation code from emulator Chrome /player via CDP (:9222).
 */
const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const page =
  list.find(
    (t) => t.type === "page" && String(t.url || "").includes("/player"),
  ) || list.find((t) => t.type === "page");

if (!page?.webSocketDebuggerUrl) {
  console.error("No Chrome page", list.map((t) => t.url));
  process.exit(1);
}

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
await send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});
await send("Page.navigate", { url: "http://127.0.0.1:3000/player" });
await new Promise((r) => setTimeout(r, 5000));

const result = await send("Runtime.evaluate", {
  expression: `(() => {
    const text = (document.body && document.body.innerText) || "";
    const m = text.match(/\\b(\\d{6})\\b/);
    return {
      href: location.href,
      title: document.title,
      text: text.slice(0, 500),
      code: m ? m[1] : null,
    };
  })()`,
  returnByValue: true,
});

const value = result.result?.value ?? result;
console.log(JSON.stringify(value, null, 2));
if (!value.code) process.exitCode = 1;
else process.stdout.write(`\nACTIVATION_CODE=${value.code}\n`);
ws.close();
