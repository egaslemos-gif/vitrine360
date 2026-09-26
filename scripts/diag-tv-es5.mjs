import fs from "node:fs";

const t = await (await fetch("https://vitrine360-psi.vercel.app/tv.js?v=044")).text();
fs.writeFileSync("scripts/_prod-tv.js", t);

const checks = [
  ["optional chaining", /\?\./g],
  ["nullish", /\?\?/g],
  ["arrow", /=>/g],
  ["async", /\basync\b/g],
  ["await", /\bawait\b/g],
  ["class", /\bclass\s+[A-Za-z]/g],
  ["const", /\bconst\b/g],
  ["let", /\blet\b/g],
  ["Object.assign", /Object\.assign/g],
  ["Array.from", /Array\.from/g],
  ["includes", /\.includes\(/g],
  ["startsWith", /\.startsWith\(/g],
  ["trailing comma call", /,\s*\)/g],
  ["trailing comma array", /,\s*\]/g],
  ["trailing comma object", /,\s*\}/g],
];

for (const [name, re] of checks) {
  const m = [...t.matchAll(re)];
  if (!m.length) continue;
  const idx = m[0].index;
  const line = t.slice(0, idx).split(/\n/).length;
  console.log(
    name,
    "count",
    m.length,
    "line",
    line,
    "snippet",
    JSON.stringify(t.slice(Math.max(0, idx - 40), idx + 50)),
  );
}

// Simulate single-line: find col 232 of entire file if flattened? Or first physical line after strip comments
const lines = t.split(/\n/);
console.log("total lines", lines.length);
for (let i = 0; i < Math.min(20, lines.length); i++) {
  if (lines[i].length >= 200) {
    console.log("long line", i + 1, "len", lines[i].length, "col232", JSON.stringify(lines[i].slice(220, 250)));
  }
}

// Also check if any line has Unexpected patterns near )
const bad = [];
for (let i = 0; i < lines.length; i++) {
  if (/,\s*\)/.test(lines[i])) bad.push({ line: i + 1, text: lines[i].trim().slice(0, 120) });
}
console.log("trailing-comma-call lines", bad.slice(0, 10));
