/**
 * Device-media provider-aware serve path (local fakes — no remote I/O).
 * Run: npx tsx scripts/test-device-media-provider.ts
 */
import assert from "node:assert/strict";
import {
  clearMediaStorageCacheForTests,
  getMediaStorageFor,
} from "../src/services/media";
import { serveDeviceObject } from "../src/services/media/serve-device-object";
import type {
  MediaStorageProvider,
  StoredObject,
  StoredObjectBytes,
} from "../src/services/media/types";

type Outcome = "PASS" | "FAIL";
const results: { id: string; outcome: Outcome; detail?: string }[] = [];

async function record(id: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    results.push({ id, outcome: "PASS" });
    console.log(`PASS ${id}`);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    results.push({ id, outcome: "FAIL", detail });
    console.log(`FAIL ${id} — ${detail}`);
  }
}

function fakeProvider(
  name: string,
  bytes: Buffer,
  opts?: { fail?: boolean; withRange?: boolean },
): MediaStorageProvider {
  const body = bytes;
  return {
    name,
    async put(): Promise<StoredObject> {
      throw new Error("not used");
    },
    async getUrl() {
      return `https://example.invalid/${name}/obj`;
    },
    async getObject(): Promise<StoredObjectBytes> {
      if (opts?.fail) throw new Error(`${name} getObject failed`);
      return {
        body,
        contentType: "image/png",
        contentLength: body.byteLength,
      };
    },
    async delete() {},
    ...(opts?.withRange
      ? {
          async getObjectRange(
            _key: string,
            start: number,
            end: number,
          ): Promise<Buffer> {
            if (opts?.fail) throw new Error(`${name} range failed`);
            return body.subarray(start, end + 1);
          },
          async headObject() {
            return { contentLength: body.byteLength };
          },
        }
      : {}),
  };
}

async function main() {
  clearMediaStorageCacheForTests();
  const payload = Buffer.from("HELLO-MEDIA-PROVIDER-BYTES-0123456789");

  await record("DMP-01 resolve r2 vs google_drive", () => {
    assert.equal(getMediaStorageFor("r2").name, "r2");
    assert.equal(getMediaStorageFor("google_drive").name, "google_drive");
    assert.notEqual(
      getMediaStorageFor("r2"),
      getMediaStorageFor("google_drive"),
    );
  });

  await record("DMP-02 R2-like (range) full GET", async () => {
    const storage = fakeProvider("r2", payload, { withRange: true });
    const res = await serveDeviceObject({
      storage,
      storageKey: "tenants/t/a.bin",
      contentType: "image/png",
      fileSize: payload.byteLength,
      rangeHeader: null,
      baseHeaders: { "Accept-Ranges": "bytes" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "image/png");
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.toString("utf8"), payload.toString("utf8"));
  });

  await record("DMP-03 R2-like Range → 206", async () => {
    const storage = fakeProvider("r2", payload, { withRange: true });
    const res = await serveDeviceObject({
      storage,
      storageKey: "tenants/t/a.bin",
      contentType: "image/png",
      fileSize: payload.byteLength,
      rangeHeader: "bytes=0-4",
      baseHeaders: { "Accept-Ranges": "bytes" },
    });
    assert.equal(res.status, 206);
    assert.ok(res.headers.get("Content-Range")?.startsWith("bytes 0-4/"));
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.toString("utf8"), "HELLO");
  });

  await record("DMP-04 Drive-like (getObject only) full GET", async () => {
    const storage = fakeProvider("google_drive", payload, { withRange: false });
    const res = await serveDeviceObject({
      storage,
      storageKey: "driveFileIdOnly",
      contentType: "video/mp4",
      fileSize: payload.byteLength,
      rangeHeader: null,
      baseHeaders: {},
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "video/mp4");
    assert.equal(
      Buffer.from(await res.arrayBuffer()).toString("utf8"),
      payload.toString("utf8"),
    );
  });

  await record("DMP-05 Drive-like Range via whole-object slice → 206", async () => {
    const storage = fakeProvider("google_drive", payload, { withRange: false });
    const res = await serveDeviceObject({
      storage,
      storageKey: "driveFileIdOnly",
      contentType: "image/jpeg",
      fileSize: payload.byteLength,
      rangeHeader: "bytes=6-10",
      baseHeaders: {},
    });
    assert.equal(res.status, 206);
    assert.equal(Buffer.from(await res.arrayBuffer()).toString("utf8"), "MEDIA");
  });

  await record("DMP-06 provider failure → throws (route maps to 502)", async () => {
    const storage = fakeProvider("google_drive", payload, { fail: true });
    await assert.rejects(
      () =>
        serveDeviceObject({
          storage,
          storageKey: "x",
          contentType: "image/png",
          fileSize: payload.byteLength,
          rangeHeader: null,
          baseHeaders: {},
        }),
      /getObject failed/,
    );
  });

  await record("DMP-07 wrong provider would not see R2 key on Drive fake", async () => {
    // Documents the bug class: selecting r2 for a drive key is a different
    // provider instance — selection must use asset.storageProvider.
    const drive = fakeProvider("google_drive", payload);
    const r2 = fakeProvider("r2", Buffer.from("OTHER"), { withRange: true });
    assert.equal(drive.name, "google_drive");
    assert.equal(r2.name, "r2");
    const viaDrive = await serveDeviceObject({
      storage: drive,
      storageKey: "fileId",
      contentType: "image/png",
      fileSize: payload.byteLength,
      rangeHeader: null,
      baseHeaders: {},
    });
    assert.equal(
      Buffer.from(await viaDrive.arrayBuffer()).toString("utf8"),
      payload.toString("utf8"),
    );
  });

  await record("DMP-08 unsupported provider name", () => {
    assert.throws(() => getMediaStorageFor("azure"), /Unsupported/);
  });

  const pass = results.filter((r) => r.outcome === "PASS").length;
  const fail = results.filter((r) => r.outcome === "FAIL").length;
  console.log(`\nsummary PASS=${pass} FAIL=${fail}`);
  if (fail) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
