import fs from "node:fs";

const base = "https://vitrine360-psi.vercel.app";
const html = await (await fetch(base + "/tv.html")).text();
console.log("tv.html len", html.length);
const scripts = [...html.matchAll(/src=["']([^"']+)["']/g)].map((m) => m[1]);
console.log("scripts", scripts);

for (const s of scripts) {
  const url = s.startsWith("http") ? s : base + (s.startsWith("/") ? s : "/" + s);
  const r = await fetch(url);
  const t = await r.text();
  console.log("\n===", s, "status", r.status, "len", t.length);
  console.log("head", JSON.stringify(t.slice(0, 280)));
  const line1 = t.split(/\r?\n/)[0] || "";
  console.log("line1 len", line1.length);
  if (line1.length >= 200) {
    console.log("around col 232", JSON.stringify(line1.slice(200, 280)));
  }
  // Also check for modern syntax Hisense may reject
  const modern = [];
  if (/\?\./.test(t)) modern.push("optional-chaining");
  if (/\?\?/.test(t)) modern.push("nullish");
  if (/=>/.test(t)) modern.push("arrow");
  if (/`/.test(t)) modern.push("template");
  if (/\b(const|let)\b/.test(t)) modern.push("const/let");
  if (/\basync\b|\bawait\b/.test(t)) modern.push("async/await");
  if (/\.\.\./.test(t)) modern.push("spread");
  console.log("modern features:", modern.join(", ") || "none obvious");

  // try parse with Function for syntax (Node is modern so won't catch old-engine issues)
  try {
    new Function(t);
    console.log("Node parse: OK");
  } catch (e) {
    console.log("Node parse FAIL:", e.message);
  }
}

// Also inspect local public/tv.js around any recent changes
const local = fs.readFileSync("public/tv.js", "utf8");
console.log("\nlocal tv.js len", local.length);
try {
  new Function(local);
  console.log("local tv.js Node parse: OK");
} catch (e) {
  console.log("local tv.js Node parse FAIL:", e.message);
}
