/**
 * RUNTIME-CACHE-02 — Persistent media cache & idempotent sync (unit probes).
 * Pure helpers only — no IndexedDB / network.
 */
import assert from "node:assert/strict";
import {
  assetsRequiringDownload,
  canActivateAssetSet,
  checksumMatches,
  diffChangedAssetIds,
  shouldAttachDeviceBearer,
} from "../src/player/sync/atomic";

function section(title: string) {
  console.log(`\n== ${title} ==`);
}

async function main() {
  section("1. Atomic activation gate");
  assert.equal(canActivateAssetSet(["a", "b"], new Set(["a", "b"])), true);
  assert.equal(canActivateAssetSet(["a", "b"], new Set(["a"])), false);
  assert.equal(canActivateAssetSet([], new Set()), true);

  section("2. assetsRequiringDownload — skip present checksums");
  const local = new Map<string, string>([
    ["img1", "sha256:aaa"],
    ["vid1", "sha256:bbb"],
  ]);
  const isPresent = (id: string, checksum: string) =>
    local.get(id) === checksum;

  const need = assetsRequiringDownload(
    [
      { id: "img1", checksum: "sha256:aaa" },
      { id: "vid1", checksum: "sha256:bbb" },
      { id: "img2", checksum: "sha256:ccc" },
      { id: "img1", checksum: "sha256:aaa" }, // dup
    ],
    isPresent,
  );
  assert.deepEqual(
    need.map((a) => a.id),
    ["img2"],
  );

  section("3. Checksum change forces re-download");
  const needChanged = assetsRequiringDownload(
    [{ id: "img1", checksum: "sha256:NEW" }],
    isPresent,
  );
  assert.deepEqual(
    needChanged.map((a) => a.id),
    ["img1"],
  );

  section("4. diffChangedAssetIds — true delta");
  const prev = [
    { id: "a", checksum: "1" },
    { id: "b", checksum: "2" },
  ];
  const next = [
    { id: "a", checksum: "1" },
    { id: "b", checksum: "2x" },
    { id: "c", checksum: "3" },
  ];
  assert.deepEqual(diffChangedAssetIds(prev, next).sort(), ["b", "c"]);
  assert.deepEqual(diffChangedAssetIds(next, next), []);

  section("5. upToDate idle contract (documented)");
  // Warm cache + upToDate must not enqueue downloads. Enforced in
  // runSyncCycle by returning early without assetsRequiringDownload.
  const warmNeed = assetsRequiringDownload(
    [
      { id: "img1", checksum: "sha256:aaa" },
      { id: "vid1", checksum: "sha256:bbb" },
    ],
    isPresent,
  );
  assert.equal(warmNeed.length, 0, "warm cache → zero downloads");

  section("6. Bearer policy unchanged");
  assert.equal(shouldAttachDeviceBearer("/api/device/media/x"), true);
  assert.equal(
    shouldAttachDeviceBearer(
      "https://bucket.r2.cloudflarestorage.com/o?X-Amz-Signature=1",
      "https://app.example",
    ),
    false,
  );
  assert.equal(checksumMatches("sha256:ab", "ab"), true);

  section("7. Incomplete set must not activate");
  const required = ["a", "b", "c"];
  const present = new Set(["a", "b"]);
  assert.equal(
    canActivateAssetSet(required, present),
    false,
    "incomplete NEXT must not become CURRENT",
  );

  console.log("\nRUNTIME-CACHE-02 probes OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
