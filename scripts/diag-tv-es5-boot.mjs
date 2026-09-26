/**
 * ES5 / Smart-TV safety scan for public/tv.js (PLAYER BOOT FIX).
 * Fails on trailing commas in CallExpression argument lists and
 * common modern syntax that Sraf/VIDAA cannot parse.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tvJs = path.join(root, "public", "tv.js");
const tvHtml = path.join(root, "public", "tv.html");
const tvSw = path.join(root, "public", "tv-sw.js");

const src = fs.readFileSync(tvJs, "utf8");
const lines = src.split(/\n/);
const html = fs.readFileSync(tvHtml, "utf8");
const sw = fs.readFileSync(tvSw, "utf8");

const issues = [];

for (let i = 0; i < lines.length; i++) {
  if (/,\s*$/.test(lines[i]) && /^\s*\)/.test(lines[i + 1] || "")) {
    issues.push({
      id: "TRAILING_CALL_COMMA",
      line: i + 1,
      text: lines[i].trim(),
    });
  }
}

const modern = [
  { id: "ARROW", re: /=>/ },
  { id: "OPTIONAL_CHAIN", re: /\?\./ },
  { id: "NULLISH", re: /\?\?/ },
  // Ignore backticks that only appear inside block comments.
  {
    id: "TEMPLATE_LITERAL",
    re: /`/,
    filter: (full) => {
      const withoutBlockComments = full.replace(/\/\*[\s\S]*?\*\//g, "");
      return /`/.test(withoutBlockComments);
    },
  },
  { id: "CONST", re: /\bconst\b/ },
  { id: "LET", re: /\blet\b/ },
  { id: "CLASS", re: /\bclass\s+[A-Za-z]/ },
  { id: "ASYNC", re: /\basync\s+function\b/ },
  { id: "AWAIT", re: /\bawait\b/ },
];
for (const m of modern) {
  if (m.filter) {
    if (!m.filter(src)) continue;
  } else if (!m.re.test(src)) {
    continue;
  }
  const idx = m.filter ? src.search(m.re) : src.search(m.re);
  const line = src.slice(0, Math.max(0, idx)).split(/\n/).length;
  issues.push({ id: m.id, line, text: lines[line - 1]?.trim()?.slice(0, 80) });
}

let parseOk = false;
try {
  // eslint-disable-next-line no-new-func
  new Function(src);
  parseOk = true;
} catch (e) {
  issues.push({ id: "PARSE_FAIL", line: 0, text: String(e.message || e) });
}

const versionMatch = src.match(/var VERSION = "([^"]+)"/);
const htmlScript = html.match(/tv\.js\?v=(\d+)/);
const swScript = sw.match(/tv\.js\?v=(\d+)/);
const swCache = sw.match(/v360-tv-shell-v(\d+)/);

const require = createRequire(import.meta.url);
let acornOk = null;
try {
  const acorn = require("acorn");
  acorn.parse(src, { ecmaVersion: 5, source: true });
  acornOk = true;
} catch (e) {
  acornOk = false;
  issues.push({
    id: "ACORN_ES5_FAIL",
    line: e.loc?.line || 0,
    text: String(e.message || e),
  });
}

const report = {
  parseOk,
  acornEs5: acornOk,
  version: versionMatch?.[1] || null,
  htmlTvJsV: htmlScript?.[1] || null,
  swTvJsV: swScript?.[1] || null,
  swCacheV: swCache?.[1] || null,
  issues,
  lines: lines.length,
};

console.log(JSON.stringify(report, null, 2));
if (issues.length || !parseOk || acornOk === false) {
  process.exitCode = 1;
} else if (
  htmlScript?.[1] !== swScript?.[1] ||
  htmlScript?.[1] !== swCache?.[1]
) {
  console.error("CACHE_VERSION_MISMATCH");
  process.exitCode = 1;
} else {
  console.log("ES5_BOOT_SCAN_PASS");
}
