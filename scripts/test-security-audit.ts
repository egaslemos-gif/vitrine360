/**
 * Security audit tests: IDOR/cross-tenant, auth tokens, device claim, uploads, sync atomicity helpers.
 * Run: npm run test:security
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { createTenant } = await import("../src/services/tenants");
  const {
    createContent,
    listContents,
    uploadMediaAsset,
    getMediaAsset,
  } = await import("../src/services/contents");
  const {
    createPlaylist,
    addPlaylistItem,
  } = await import("../src/services/playlists");
  const {
    startDevicePairing,
    pairDevice,
    bootstrapClaim,
    authenticateDevice,
    setDeviceStatus,
    assignPlaylistToDevice,
    listDevicesWithPresence,
  } = await import("../src/services/devices");
  const { createSchedule } = await import("../src/services/schedules");
  const {
    createDeviceGroup,
    assignPlaylistToGroup,
  } = await import("../src/services/device-groups");
  const {
    resolveUnderRoot,
    resolveMediaRoot,
    safeFileExtension,
    sniffMime,
  } = await import("../src/services/media");
  const {
    createSessionToken,
    hashPassword,
    verifyPassword,
    hashToken,
    generateDeviceToken,
  } = await import("../src/lib/auth");
  const { jwtVerify } = await import("jose");
  const { db, schema } = await import("../src/db");
  const { eq } = await import("drizzle-orm");
  const { canActivateAssetSet, checksumMatches, shouldAttachDeviceBearer } = await import(
    "../src/player/sync/atomic"
  );

  const stamp = Date.now().toString(36);
  console.log("1. Path traversal / upload helpers");
  const root = resolveMediaRoot();
  assert.throws(() => resolveUnderRoot(root, "../etc/passwd"));
  assert.throws(() => resolveUnderRoot(root, "a/../../b"));
  assert.throws(() => resolveUnderRoot(root, "C:\\Windows\\system.ini"));
  assert.equal(safeFileExtension("../../evil.exe.png"), "png");
  assert.equal(safeFileExtension("noext"), "bin");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  assert.equal(sniffMime(png), "image/png");
  assert.equal(sniffMime(Buffer.from("not-image")), null);
  assert.equal(sniffMime(Buffer.from("MZ-fake-exe")), null);

  console.log("2. Password hashing + JWT");
  const hash = await hashPassword("SecretPass1!");
  assert.ok(await verifyPassword("SecretPass1!", hash));
  assert.equal(await verifyPassword("wrong", hash), false);
  process.env.AUTH_SECRET =
    process.env.AUTH_SECRET ?? "dev-secret-change-me-in-production-min-32-chars";
  const token = await createSessionToken({
    id: "u1",
    email: "a@test.local",
    name: "A",
    role: "ADMIN",
    tenantId: "t1",
    activeTenantId: "t1",
  });
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
  const { payload } = await jwtVerify(token, secret);
  assert.equal(payload.tenantId, "t1");
  assert.ok(typeof payload.exp === "number");

  console.log("3. Cross-tenant isolation + IDOR");
  const tenantA = await createTenant({
    name: `Sec A ${stamp}`,
    slug: `sec-a-${stamp}`,
  });
  const tenantB = await createTenant({
    name: `Sec B ${stamp}`,
    slug: `sec-b-${stamp}`,
  });

  const contentA = await createContent(
    {
      type: "TEXT",
      title: "A-only",
      durationMs: 3000,
      payload: { body: "a" },
      status: "ACTIVE",
    },
    tenantA,
  );
  const contentB = await createContent(
    {
      type: "TEXT",
      title: "B-only",
      durationMs: 3000,
      payload: { body: "b" },
      status: "ACTIVE",
    },
    tenantB,
  );
  assert.ok(!(await listContents(tenantA)).some((c) => c.id === contentB));
  assert.ok(!(await listContents(tenantB)).some((c) => c.id === contentA));

  const plA = await createPlaylist({ name: "PLA" }, tenantA);
  const plB = await createPlaylist({ name: "PLB" }, tenantB);
  await addPlaylistItem({
    playlistId: plA,
    contentId: contentA,
    tenantId: tenantA,
  });
  await assert.rejects(
    () =>
      addPlaylistItem({
        playlistId: plA,
        contentId: contentB,
        tenantId: tenantA,
      }),
  );

  console.log("3b. MIME Validation & Upload");
  // A. MIME declarado válido + assinatura válida
  const assetA = await uploadMediaAsset({
    fileName: "a.png",
    mimeType: "image/png",
    data: png,
    tenantId: tenantA,
  });
  assert.equal(await getMediaAsset(assetA.id, tenantB), null);
  assert.ok(await getMediaAsset(assetA.id, tenantA));

  // B. MIME declarado inválido + assinatura válida -> ACCEPT with detected MIME
  const assetB = await uploadMediaAsset({
    fileName: "b.xyz",
    mimeType: "application/xyz",
    data: png,
    tenantId: tenantA,
  });
  assert.equal(assetB.mimeType, "image/png");

  // C. MIME declarado de imagem + assinatura de executável -> REJECT
  await assert.rejects(() =>
    uploadMediaAsset({
      fileName: "evil.png",
      mimeType: "image/png",
      data: Buffer.from("MZ-fake-exe"),
      tenantId: tenantA,
    })
  );

  // D. MIME declarado de vídeo + conteúdo incompatível -> REJECT
  await assert.rejects(() =>
    uploadMediaAsset({
      fileName: "evil.mp4",
      mimeType: "video/mp4",
      data: Buffer.from("just-text-not-video"),
      tenantId: tenantA,
    })
  );

  // E. extensão enganosa + assinatura incompatível -> REJECT
  await assert.rejects(() =>
    uploadMediaAsset({
      fileName: "test.mp4",
      mimeType: "video/mp4",
      data: Buffer.from("just-text-not-video"),
      tenantId: tenantA,
    })
  );

  // F. magic number desconhecido + fallback fornecido -> REJECT
  await assert.rejects(() =>
    uploadMediaAsset({
      fileName: "fake.svg",
      mimeType: "image/svg+xml",
      data: Buffer.from("<svg></svg>"),
      tenantId: tenantA,
    })
  );

  // G. ficheiro vazio -> REJECT
  await assert.rejects(() =>
    uploadMediaAsset({
      fileName: "empty.png",
      mimeType: "image/png",
      data: Buffer.alloc(0),
      tenantId: tenantA,
    })
  );

  // H. ficheiro truncado -> REJECT
  await assert.rejects(() =>
    uploadMediaAsset({
      fileName: "trunc.png",
      mimeType: "image/png",
      data: Buffer.from([0x89, 0x50]), // Too short for png magic number
      tenantId: tenantA,
    })
  );

  // I. content type ausente -> ACCEPT se assinatura for válida
  const assetI = await uploadMediaAsset({
    fileName: "test.mp3",
    mimeType: "",
    data: Buffer.from([0xff, 0xe0, 0x00, 0x00]), // MPEG audio frame sync
    tenantId: tenantA,
  });
  assert.equal(assetI.mimeType, "audio/mpeg");

  console.log("4. Device claim / token / disable / wrong tenant");
  const pairingA = await startDevicePairing();
  await pairDevice({
    activationCode: pairingA.activationCode,
    name: "DevA",
    deviceCode: `SEC-A-${stamp.toUpperCase()}`,
    tenantId: tenantA,
  });
  const forbidden = await bootstrapClaim(pairingA.deviceId, "wrong-secret-xxxxxx");
  assert.equal(forbidden.status, "FORBIDDEN");
  const claimA = await bootstrapClaim(
    pairingA.deviceId,
    pairingA.pairingSecret,
  );
  assert.equal(claimA.status, "ACTIVE");
  assert.ok("deviceToken" in claimA && claimA.deviceToken);
  const device = await authenticateDevice(`Bearer ${claimA.deviceToken}`);
  assert.ok(device);
  assert.equal(device!.tenantId, tenantA);

  assert.equal(await authenticateDevice("Bearer invalid"), null);
  assert.equal(await authenticateDevice(null), null);

  // Cannot assign B playlist to A device
  await assert.rejects(() =>
    assignPlaylistToDevice(pairingA.deviceId, plB, tenantA),
  );
  // Cannot assign A playlist using tenant B scope
  await assert.rejects(() =>
    assignPlaylistToDevice(pairingA.deviceId, plA, tenantB),
  );

  await assignPlaylistToDevice(pairingA.deviceId, plA, tenantA);

  // Schedule cannot reference foreign playlist
  await assert.rejects(() =>
    createSchedule(
      {
        name: "bad",
        playlistId: plB,
        daysOfWeek: [],
        targets: [{ targetType: "ALL", targetId: null }],
        priority: "NORMAL",
        active: true,
      },
      tenantA,
    ),
  );

  const groupA = await createDeviceGroup({ name: "GA" }, tenantA);
  await assert.rejects(() =>
    assignPlaylistToGroup(groupA, plB, tenantA),
  );

  await setDeviceStatus({
    deviceId: pairingA.deviceId,
    tenantId: tenantA,
    status: "DISABLED",
  });
  assert.equal(
    await authenticateDevice(`Bearer ${claimA.deviceToken}`),
    null,
  );

  // Tenant B cannot disable tenant A device
  const pairingB = await startDevicePairing();
  await pairDevice({
    activationCode: pairingB.activationCode,
    name: "DevB",
    deviceCode: `SEC-B-${stamp.toUpperCase()}`,
    tenantId: tenantB,
  });
  await assert.rejects(() =>
    setDeviceStatus({
      deviceId: pairingB.deviceId,
      tenantId: tenantA,
      status: "DISABLED",
    }),
  );

  const devicesA = await listDevicesWithPresence(tenantA);
  assert.ok(!devicesA.some((d) => d.deviceCode?.startsWith("SEC-B-")));

  console.log("5. Atomic sync helpers");
  assert.equal(canActivateAssetSet(["a", "b"], new Set(["a", "b"])), true);
  assert.equal(canActivateAssetSet(["a", "b"], new Set(["a"])), false);
  assert.equal(canActivateAssetSet([], new Set()), true);
  const hex = createHash("sha256").update(png).digest("hex");
  assert.equal(checksumMatches(`sha256:${hex}`, hex), true);
  assert.equal(checksumMatches(`sha256:${hex}`, "deadbeef"), false);
  assert.equal(checksumMatches("", "anything"), true); // no checksum → skip
  assert.equal(
    shouldAttachDeviceBearer("/api/media/x", "https://example.com"),
    true,
  );
  assert.equal(
    shouldAttachDeviceBearer(
      "https://example.com/api/media/x",
      "https://example.com",
    ),
    true,
  );
  assert.equal(
    shouldAttachDeviceBearer(
      "https://bucket.r2.cloudflarestorage.com/obj?X-Amz-Signature=abc",
      "https://example.com",
    ),
    false,
    "signed R2 URL must not receive device Bearer",
  );

  // Interrupted sync simulation: partial download must not activate
  const present = new Set<string>(["asset-1"]);
  const required = ["asset-1", "asset-2"];
  assert.equal(
    canActivateAssetSet(required, present),
    false,
    "interrupted download keeps previous manifest",
  );

  console.log("6. Token hash uniqueness");
  const t1 = generateDeviceToken();
  const t2 = generateDeviceToken();
  assert.notEqual(t1, t2);
  assert.notEqual(hashToken(t1), t1);

  // Ensure schema columns exist
  const cols = await db.select().from(schema.devices).limit(1);
  void cols;
  const [sample] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, pairingA.deviceId))
    .limit(1);
  assert.ok(sample);
  assert.equal(sample!.status, "DISABLED");
  assert.equal(sample!.deviceTokenHash, null);

  console.log("Security audit tests OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
