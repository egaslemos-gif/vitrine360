/**
 * PI-10O Phase C — Preview R2 probe only (bucket vitrine360-preview).
 * Never targets Production bucket name from env without override.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });

async function main() {
  const required = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ENDPOINT",
  ] as const;
  const presence = Object.fromEntries(
    required.map((k) => [k, process.env[k] ? "SET" : "NOT SET"]),
  );
  const productionBucketConfigured = process.env.R2_BUCKET_NAME
    ? "SET"
    : "NOT SET";
  const previewBucket = "vitrine360-preview";

  if (presence.R2_ACCESS_KEY_ID !== "SET") {
    const out = { ok: false, reason: "R2 creds NOT SET", presence };
    write(out);
    console.log(JSON.stringify(out));
    return;
  }

  process.env.R2_BUCKET_NAME = previewBucket;
  process.env.MEDIA_STORAGE_PROVIDER = "r2";

  const { R2StorageProvider } = await import("../src/services/media/r2-provider");
  const storage = new R2StorageProvider();
  const body = Buffer.from(`pi10o-preview-probe-${Date.now()}`);
  const putResult = await storage.put({
    key: `pi10o-probe/${randomUUID()}.bin`,
    data: body,
    mimeType: "application/octet-stream",
    fileName: "probe.bin",
  });
  const head = storage.headObject
    ? await storage.headObject(putResult.storageKey)
    : null;
  await storage.delete(putResult.storageKey);
  let gone = true;
  try {
    const h = storage.headObject
      ? await storage.headObject(putResult.storageKey)
      : null;
    gone = !(h && h.contentLength != null && h.contentLength > 0);
  } catch {
    gone = true;
  }

  const out = {
    ok:
      Boolean(putResult.storageKey) &&
      Number(head?.contentLength) === body.length &&
      gone,
    previewBucket,
    productionBucketConfigured,
    put: "OK",
    headBytes: head?.contentLength ?? null,
    delete: gone ? "OK" : "FAIL",
    presence,
    note: "Only R2_BUCKET_NAME=vitrine360-preview used; Production bucket not targeted",
  };
  write(out);
  console.log(JSON.stringify(out));
}

function write(out: unknown) {
  const dir = path.join(process.cwd(), "docs/evidence/platform-identity-10o");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "R2-PREVIEW-PROBE.json"),
    JSON.stringify(out, null, 2) + "\n",
  );
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  const out = { ok: false, error: msg.replace(/[A-Za-z0-9+/]{20,}/g, "REDACTED") };
  write(out);
  console.log(JSON.stringify(out));
  process.exit(1);
});
