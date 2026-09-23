import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "https://vitrine360-psi.vercel.app";
const contentId = JSON.parse(fs.readFileSync(path.join(__dirname, "content-response.json"), "utf8")).id;
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@vitrine360.local", password: "Admin123!" }),
});
const cookie = (loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const res = await fetch(`${BASE}/api/admin/contents`, { headers: { Cookie: cookie } });
const json = await res.json();
const items = json.contents || json;
const row = (Array.isArray(items) ? items : []).find((c) => c.id === contentId);
console.log(JSON.stringify(row, null, 2));
fs.writeFileSync(path.join(__dirname, "content-list-row.json"), JSON.stringify(row, null, 2));
