import test from "node:test";
import assert from "node:assert/strict";
import {
  clearMediaStorageCacheForTests,
  getMediaStorage,
  getMediaStorageFor,
  resolveMediaStorageForAsset,
} from "./index";
import { GoogleDriveTenantProvider } from "./google-drive-tenant-provider";
import {
  normalizeRangedBody,
  serveDeviceObject,
} from "./serve-device-object";
import type {
  MediaStorageProvider,
  StoredObject,
  StoredObjectBytes,
} from "./types";

test("getMediaStorageFor resolves by asset storage_provider", async (t) => {
  t.after(() => {
    clearMediaStorageCacheForTests();
    delete process.env.MEDIA_STORAGE_PROVIDER;
  });

  clearMediaStorageCacheForTests();

  await t.test("r2", () => {
    assert.equal(getMediaStorageFor("r2").name, "r2");
  });

  await t.test("google_drive (SA factory name only — not used by device-media)", () => {
    assert.equal(getMediaStorageFor("google_drive").name, "google_drive");
  });

  await t.test("drive alias → google_drive", () => {
    assert.equal(getMediaStorageFor("drive").name, "google_drive");
  });

  await t.test("local", () => {
    assert.equal(getMediaStorageFor("local").name, "local");
  });

  await t.test("case / trim insensitive", () => {
    assert.equal(getMediaStorageFor("  Google_Drive  ").name, "google_drive");
  });

  await t.test("unknown → throws", () => {
    assert.throws(() => getMediaStorageFor("s3"), /Unsupported storage provider/);
  });

  await t.test("empty → throws", () => {
    assert.throws(() => getMediaStorageFor(""), /Unsupported storage provider/);
  });

  await t.test("caches distinct providers", () => {
    clearMediaStorageCacheForTests();
    const a = getMediaStorageFor("r2");
    const b = getMediaStorageFor("google_drive");
    const a2 = getMediaStorageFor("r2");
    assert.notEqual(a.name, b.name);
    assert.equal(a, a2);
  });

  await t.test("getMediaStorage follows env default", () => {
    clearMediaStorageCacheForTests();
    process.env.MEDIA_STORAGE_PROVIDER = "r2";
    assert.equal(getMediaStorage().name, "r2");
    clearMediaStorageCacheForTests();
    process.env.MEDIA_STORAGE_PROVIDER = "local";
    assert.equal(getMediaStorage().name, "local");
  });
});

test("resolveMediaStorageForAsset (unit — no live Drive)", async (t) => {
  t.after(() => {
    clearMediaStorageCacheForTests();
    delete process.env.TENANT_DRIVE_ENABLED;
    delete process.env.MEDIA_STORAGE_PROVIDER;
  });

  await t.test("r2 → r2 provider", async () => {
    const p = await resolveMediaStorageForAsset({
      storageProvider: "r2",
      tenantId: "tenant-a",
      storageKey: "tenants/tenant-a/x.bin",
    });
    assert.equal(p.name, "r2");
  });

  await t.test("local → local provider", async () => {
    const p = await resolveMediaStorageForAsset({
      storageProvider: "local",
      tenantId: "tenant-a",
    });
    assert.equal(p.name, "local");
  });

  await t.test("google_drive with TENANT_DRIVE off → throws (no SA fallback)", async () => {
    process.env.TENANT_DRIVE_ENABLED = "false";
    await assert.rejects(
      () =>
        resolveMediaStorageForAsset({
          storageProvider: "google_drive",
          tenantId: "tenant-a",
          storageKey: "driveFileId",
        }),
      /tenant Drive is disconnected|TENANT_DRIVE_ENABLED/,
    );
  });

  await t.test("unknown provider → throws", async () => {
    await assert.rejects(
      () =>
        resolveMediaStorageForAsset({
          storageProvider: "azure",
          tenantId: "tenant-a",
        }),
      /Unsupported storage provider/,
    );
  });
});

test("GoogleDriveTenantProvider Range (unit — mocked fetch)", async (t) => {
  const payload = Buffer.from("ABCDEFGHIJKLMNOP");
  const originalFetch = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test("getObjectRange sends Range header and returns bytes", async () => {
    let seenRange: string | null = null;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      assert.match(url, /drive\/v3\/files\/file123/);
      seenRange = new Headers(init?.headers).get("Range");
      const auth = new Headers(init?.headers).get("Authorization");
      assert.equal(auth, "Bearer test-access");
      // Never assert token material beyond the fixture value above.
      return new Response(payload.subarray(0, 5), {
        status: 206,
        headers: {
          "Content-Range": "bytes 0-4/16",
          "Content-Type": "image/png",
        },
      });
    }) as typeof fetch;

    const storage = new GoogleDriveTenantProvider({
      folderId: "folder-x",
      getAccessToken: async () => "test-access",
    });
    const buf = await storage.getObjectRange("file123", 0, 4);
    assert.equal(seenRange, "bytes=0-4");
    assert.equal(buf.toString("utf8"), "ABCDE");
  });

  await t.test("serveDeviceObject uses tenant getObjectRange for 206", async () => {
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const range = new Headers(init?.headers).get("Range");
      if (range === "bytes=2-5") {
        return new Response(payload.subarray(2, 6), { status: 206 });
      }
      if (String(_input).includes("fields=size")) {
        return Response.json({ size: String(payload.byteLength), mimeType: "image/png" });
      }
      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

    const storage = new GoogleDriveTenantProvider({
      folderId: "folder-x",
      getAccessToken: async () => "test-access",
    });
    const res = await serveDeviceObject({
      storage,
      storageKey: "file123",
      contentType: "image/png",
      fileSize: payload.byteLength,
      rangeHeader: "bytes=2-5",
      baseHeaders: { "Accept-Ranges": "bytes" },
    });
    assert.equal(res.status, 206);
    assert.ok(res.headers.get("Content-Range")?.startsWith("bytes 2-5/"));
    assert.equal(Buffer.from(await res.arrayBuffer()).toString("utf8"), "CDEF");
  });

  await t.test("DriveAuthError on 401 does not include token", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "auth" }), {
        status: 401,
      })) as typeof fetch;
    const storage = new GoogleDriveTenantProvider({
      folderId: "folder-x",
      getAccessToken: async () => "secret-must-not-leak",
    });
    await assert.rejects(
      () => storage.getObjectRange("file123", 0, 1),
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        assert.ok(!msg.includes("secret-must-not-leak"));
        assert.match(msg, /auth failed|401/i);
        return true;
      },
    );
  });
});

/** C1 — Range integrity through serveDeviceObject + provider contracts */
test("C1 Range integrity (exact / full-body / edges / 416 / full GET)", async (t) => {
  const file = Buffer.from("0123456789ABCDEF"); // 16 bytes

  function rangeProvider(
    mode: "exact" | "full-body-ignore-range",
  ): MediaStorageProvider {
    return {
      name: "c1-fake",
      async put(): Promise<StoredObject> {
        throw new Error("unused");
      },
      async getUrl() {
        return "https://example.invalid/c1";
      },
      async getObject(): Promise<StoredObjectBytes> {
        return {
          body: file,
          contentType: "application/octet-stream",
          contentLength: file.byteLength,
        };
      },
      async delete() {},
      async headObject() {
        return { contentLength: file.byteLength };
      },
      async getObjectRange(_key: string, start: number, end: number) {
        if (mode === "exact") {
          return file.subarray(start, end + 1);
        }
        // Ignore Range — return entire object (the C1 regression case)
        return Buffer.from(file);
      },
    };
  }

  await t.test("normalizeRangedBody: exact pass-through", () => {
    const slice = file.subarray(4, 8);
    assert.equal(
      normalizeRangedBody(slice, 4, 7).toString("utf8"),
      "4567",
    );
  });

  await t.test("normalizeRangedBody: full body → extract window", () => {
    assert.equal(
      normalizeRangedBody(file, 4, 7).toString("utf8"),
      "4567",
    );
  });

  await t.test("normalizeRangedBody: unmappable oversize → throw", () => {
    // Requested [10,15] (6 bytes); body longer than expected but does not cover offset 15
    assert.throws(
      () => normalizeRangedBody(Buffer.alloc(8), 10, 15),
      /without covering offset/,
    );
  });

  async function assertRange(
    mode: "exact" | "full-body-ignore-range",
    rangeHeader: string,
    expectedBytes: string,
    expectedCr: string,
  ) {
    const res = await serveDeviceObject({
      storage: rangeProvider(mode),
      storageKey: "k",
      contentType: "application/octet-stream",
      fileSize: file.byteLength,
      rangeHeader,
      baseHeaders: { "Accept-Ranges": "bytes" },
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("Accept-Ranges"), "bytes");
    assert.equal(res.headers.get("Content-Range"), expectedCr);
    assert.equal(res.headers.get("Content-Length"), String(expectedBytes.length));
    assert.equal(
      Buffer.from(await res.arrayBuffer()).toString("utf8"),
      expectedBytes,
    );
  }

  await t.test("exact provider: start / mid / end", async () => {
    await assertRange("exact", "bytes=0-3", "0123", "bytes 0-3/16");
    await assertRange("exact", "bytes=4-7", "4567", "bytes 4-7/16");
    await assertRange("exact", "bytes=12-15", "CDEF", "bytes 12-15/16");
  });

  await t.test("full-body provider (ignored Range): start / mid / end", async () => {
    await assertRange(
      "full-body-ignore-range",
      "bytes=0-3",
      "0123",
      "bytes 0-3/16",
    );
    await assertRange(
      "full-body-ignore-range",
      "bytes=4-7",
      "4567",
      "bytes 4-7/16",
    );
    await assertRange(
      "full-body-ignore-range",
      "bytes=12-15",
      "CDEF",
      "bytes 12-15/16",
    );
  });

  await t.test("invalid / out-of-bounds → 416", async () => {
    const res = await serveDeviceObject({
      storage: rangeProvider("exact"),
      storageKey: "k",
      contentType: "application/octet-stream",
      fileSize: file.byteLength,
      rangeHeader: "bytes=100-200",
      baseHeaders: { "Accept-Ranges": "bytes" },
    });
    assert.equal(res.status, 416);
    assert.equal(res.headers.get("Content-Range"), "bytes */16");
    assert.equal((await res.arrayBuffer()).byteLength, 0);
  });

  await t.test("full GET without Range → 200 entire body", async () => {
    const res = await serveDeviceObject({
      storage: rangeProvider("exact"),
      storageKey: "k",
      contentType: "application/octet-stream",
      fileSize: file.byteLength,
      rangeHeader: null,
      baseHeaders: { "Accept-Ranges": "bytes" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Length"), "16");
    assert.equal(
      Buffer.from(await res.arrayBuffer()).toString("utf8"),
      file.toString("utf8"),
    );
  });

  await t.test(
    "Tenant Drive getObjectRange extracts window when fetch returns full body",
    async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (_i, init) => {
        assert.equal(
          new Headers(init?.headers).get("Range"),
          "bytes=4-7",
        );
        // Hostile: status 200 + full object
        return new Response(file, { status: 200 });
      }) as typeof fetch;
      try {
        const storage = new GoogleDriveTenantProvider({
          folderId: "f",
          getAccessToken: async () => "tok",
        });
        const buf = await storage.getObjectRange("fid", 4, 7);
        assert.equal(buf.toString("utf8"), "4567");
        const res = await serveDeviceObject({
          storage,
          storageKey: "fid",
          contentType: "image/png",
          fileSize: file.byteLength,
          rangeHeader: "bytes=4-7",
          baseHeaders: { "Accept-Ranges": "bytes" },
        });
        assert.equal(res.status, 206);
        assert.equal(res.headers.get("Content-Range"), "bytes 4-7/16");
        assert.equal(res.headers.get("Content-Length"), "4");
        assert.equal(
          Buffer.from(await res.arrayBuffer()).toString("utf8"),
          "4567",
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});
