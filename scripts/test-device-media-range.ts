/**
 * Device media proxy — HTTP Range / 206 live check (Smart TV video start).
 *
 * Why: Smart TV browsers need `206 Partial Content` to start MP4 playback and the
 * serverless response limit is 4.5 MB. The proxy used to ignore `Range` and send the
 * whole file in one 200.
 *
 * Run against a throwaway DB + local storage (never against production data):
 *   DATABASE_URL=file:./data/authz02-e2e.db MEDIA_STORAGE_PROVIDER=local \
 *   MEDIA_LOCAL_DIR=./data/authz02-media npx next start -p 3150
 *   BASE_URL=http://localhost:3150 npx tsx scripts/test-device-media-range.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3150";
const seed = JSON.parse(fs.readFileSync("data/authz02-e2e-seed.json", "utf8")) as {
  password: string;
  tenants: { ok: { users: { ADMIN: string } } };
};

const results: { id: string; ok: boolean; detail: string }[] = [];
function check(id: string, ok: boolean, detail = "") {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? " — " + detail : ""}`);
}

/** Minimal valid-looking MP4 prefix (ftyp box) + deterministic filler. */
function fakeMp4(bytes: number): Buffer {
  const buf = Buffer.alloc(bytes);
  buf.writeUInt32BE(24, 0);
  buf.write("ftyp", 4, "ascii");
  buf.write("isom", 8, "ascii");
  buf.writeUInt32BE(512, 12);
  buf.write("isomiso2", 16, "ascii");
  for (let i = 32; i < bytes; i++) buf[i] = (i * 31 + 7) & 0xff;
  return buf;
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

async function main() {
  // admin session
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: seed.tenants.ok.users.ADMIN, password: seed.password }),
  });
  assert.equal(login.status, 200, "admin login");
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  // device pairing → token
  const clientId = `rng-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pairingSecret = `rng-secret-${Date.now()}-${Math.random().toString(36).slice(2)}xx`;
  const boot = await fetch(`${BASE}/api/device/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "pair_start", clientId, pairingSecret }),
  });
  const bootBody = (await boot.json()) as { activationCode: string; deviceId: string };
  const pair = await fetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      activationCode: bootBody.activationCode,
      name: "Range test",
      deviceCode: `RNG-${Date.now().toString(36).toUpperCase()}`,
    }),
  });
  assert.equal(pair.status, 200, "admin pair");
  const claim = await fetch(`${BASE}/api/device/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "claim", deviceId: bootBody.deviceId, pairingSecret }),
  });
  const { deviceToken } = (await claim.json()) as { deviceToken: string };
  assert.ok(deviceToken, "device token");
  const auth = { Authorization: `Bearer ${deviceToken}` };

  // upload a 9 MB "video" (> 2 chunks of 4 MB)
  const SIZE = 9_000_000;
  const file = fakeMp4(SIZE);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(file)], { type: "video/mp4" }), `range-${Date.now()}.mp4`);
  const up = await fetch(`${BASE}/api/admin/media`, { method: "POST", headers: { Cookie: cookie }, body: form });
  assert.equal(up.status, 200, `upload ${up.status}`);
  const media = (await up.json()) as { id: string; mimeType?: string };
  const url = `${BASE}/api/device/media/${encodeURIComponent(media.id)}`;

  // 1. open range (what Chrome / Smart TVs send)
  const r0 = await fetch(url, { headers: { ...auth, Range: "bytes=0-" } });
  const b0 = Buffer.from(await r0.arrayBuffer());
  check("RANGE-open: 206", r0.status === 206, `status=${r0.status}`);
  check("RANGE-open: Content-Range", r0.headers.get("content-range") === `bytes 0-3999999/${SIZE}`, String(r0.headers.get("content-range")));
  check("RANGE-open: Content-Length = body = 4 MB (below the 4.5 MB serverless limit)", b0.length === 4_000_000 && r0.headers.get("content-length") === "4000000", `len=${b0.length}`);
  check("RANGE-open: bytes identical to source", sha(b0) === sha(file.subarray(0, 4_000_000)));
  check("RANGE-open: Accept-Ranges + video content-type", r0.headers.get("accept-ranges") === "bytes" && /^video\//.test(r0.headers.get("content-type") ?? ""), String(r0.headers.get("content-type")));

  // 2. continue mid-file, then the tail chunk
  const r1 = await fetch(url, { headers: { ...auth, Range: "bytes=4000000-" } });
  const b1 = Buffer.from(await r1.arrayBuffer());
  check("RANGE-mid: 206 + exact slice", r1.status === 206 && sha(b1) === sha(file.subarray(4_000_000, 8_000_000)), `status=${r1.status}`);
  const r2 = await fetch(url, { headers: { ...auth, Range: "bytes=8000000-" } });
  const b2 = Buffer.from(await r2.arrayBuffer());
  check("RANGE-tail: clamped to EOF", r2.status === 206 && r2.headers.get("content-range") === `bytes 8000000-${SIZE - 1}/${SIZE}` && sha(b2) === sha(file.subarray(8_000_000)), String(r2.headers.get("content-range")));

  // 3. reassembling the chunks reproduces the file (what the <video> does while playing)
  check("RANGE-reassemble: chunks == original file", sha(Buffer.concat([b0, b1, b2])) === sha(file));

  // 4. suffix range (moov atom at end) and tiny probe (Safari)
  const rs = await fetch(url, { headers: { ...auth, Range: "bytes=-2048" } });
  const bs = Buffer.from(await rs.arrayBuffer());
  check("RANGE-suffix: last 2048 bytes", rs.status === 206 && sha(bs) === sha(file.subarray(SIZE - 2048)), `status=${rs.status}`);
  const rp = await fetch(url, { headers: { ...auth, Range: "bytes=0-1" } });
  const bp = Buffer.from(await rp.arrayBuffer());
  check("RANGE-probe: bytes=0-1 → 2 bytes", rp.status === 206 && bp.length === 2);

  // 5. unsatisfiable
  const ru = await fetch(url, { headers: { ...auth, Range: `bytes=${SIZE + 10}-` } });
  check("RANGE-416: start beyond EOF", ru.status === 416 && ru.headers.get("content-range") === `bytes */${SIZE}`, `status=${ru.status}`);

  // 6. no Range header on a large file → streamed in chunks, complete and correct
  const rf = await fetch(url, { headers: auth });
  const bf = Buffer.from(await rf.arrayBuffer());
  check("FULL: 200, complete, identical", rf.status === 200 && bf.length === SIZE && sha(bf) === sha(file), `status=${rf.status} len=${bf.length}`);

  // 7. token via query string (Smart TV <video src="...?token=">)
  const rq = await fetch(`${url}?token=${encodeURIComponent(deviceToken)}`, { headers: { Range: "bytes=0-99" } });
  check("TOKEN-query: 206", rq.status === 206 && (await rq.arrayBuffer()).byteLength === 100, `status=${rq.status}`);

  // 8. security
  const rn = await fetch(url, { headers: { Range: "bytes=0-" } });
  check("SEC: no token → 401", rn.status === 401, `status=${rn.status}`);
  const rb = await fetch(url, { headers: { Authorization: "Bearer not-a-token", Range: "bytes=0-" } });
  check("SEC: bad token → 401", rb.status === 401, `status=${rb.status}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    console.log("FAILED:", failed.map((f) => f.id).join("; "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
