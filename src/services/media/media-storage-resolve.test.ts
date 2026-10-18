import test from "node:test";
import assert from "node:assert/strict";
import {
  clearMediaStorageCacheForTests,
  getMediaStorage,
  getMediaStorageFor,
} from "./index";

test("getMediaStorageFor resolves by asset storage_provider", async (t) => {
  t.after(() => {
    clearMediaStorageCacheForTests();
    delete process.env.MEDIA_STORAGE_PROVIDER;
  });

  clearMediaStorageCacheForTests();

  await t.test("r2", () => {
    assert.equal(getMediaStorageFor("r2").name, "r2");
  });

  await t.test("google_drive", () => {
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
