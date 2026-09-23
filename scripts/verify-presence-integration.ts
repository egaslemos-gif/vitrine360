import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function runVerification() {
  const { db } = await import("../src/db");
  const { tenants, devices } = await import("../src/db/schema");
  const { listDevicesWithPresence, getHeartbeatWindows } = await import("../src/services/devices");
  const { derivePresence } = await import("../src/domain/types");
  console.log("=== STARTING INTEGRATION VERIFICATION ===");

  const stamp = Date.now().toString(36).toUpperCase();
  
  console.log("\\n1. Multi-tenant Setup");
  const { createTenant } = await import("../src/services/tenants");
  const tenantAId = await createTenant({ name: `Tenant A ${stamp}`, slug: `tenant-a-${stamp}` });
  const tenantBId = await createTenant({ name: `Tenant B ${stamp}`, slug: `tenant-b-${stamp}` });
  
  console.log(`Created Tenant A: ${tenantAId}`);
  console.log(`Created Tenant B: ${tenantBId}`);

  const now = Date.now();
  const times = {
    now: new Date(now).toISOString(),
    minus2m: new Date(now - 2 * 60 * 1000).toISOString(),
    minus3m: new Date(now - 3 * 60 * 1000 + 5000).toISOString(), // +5s to ensure it stays < 3m during execution
    minus5m: new Date(now - 5 * 60 * 1000).toISOString(),
    minus15m: new Date(now - 15 * 60 * 1000 + 5000).toISOString(), // +5s to ensure it stays < 15m
    minus30m: new Date(now - 30 * 60 * 1000).toISOString(),
    nullTime: null,
  };

  const { startDevicePairing, pairDevice, bootstrapClaim } = await import("../src/services/devices");

  async function createTestDevice(name: string, code: string, tenantId: string, lastSeenAt: string | null) {
    const pairing = await startDevicePairing();
    const paired = await pairDevice({ activationCode: pairing.activationCode, name, location: "Test", deviceCode: code, tenantId });
    await bootstrapClaim(paired.deviceId, pairing.pairingSecret);
    await db.update(devices).set({ lastSeenAt }).where(eq(devices.id, paired.deviceId));
    return paired.deviceId;
  }

  const d1 = await createTestDevice("Device A_Now", `A1-${stamp}`, tenantAId, times.now);
  const d2 = await createTestDevice("Device A_2m", `A2-${stamp}`, tenantAId, times.minus2m);
  const d3 = await createTestDevice("Device A_3m", `A3-${stamp}`, tenantAId, times.minus3m);
  const d4 = await createTestDevice("Device A_5m", `A4-${stamp}`, tenantAId, times.minus5m);
  const d5 = await createTestDevice("Device A_15m", `A5-${stamp}`, tenantAId, times.minus15m);
  const d6 = await createTestDevice("Device A_30m", `A6-${stamp}`, tenantAId, times.minus30m);
  
  const devicesA = [{ id: d1 }, { id: d2 }, { id: d3 }, { id: d4 }, { id: d5 }, { id: d6 }];

  const b1 = await createTestDevice("Device B_30m", `B1-${stamp}`, tenantBId, times.minus30m);
  const b2 = await createTestDevice("Device B_null", `B2-${stamp}`, tenantBId, times.nullTime);
  const devicesB = [{ id: b1 }, { id: b2 }];

  console.log("\\n2. Testing listDevicesWithPresence (Service Integration)");
  const listA = await listDevicesWithPresence(tenantAId);
  
  const devNow = listA.find(d => d.name === "Device A_Now")!;
  const dev2m = listA.find(d => d.name === "Device A_2m")!;
  const dev3m = listA.find(d => d.name === "Device A_3m")!;
  const dev5m = listA.find(d => d.name === "Device A_5m")!;
  const dev15m = listA.find(d => d.name === "Device A_15m")!;
  const dev30m = listA.find(d => d.name === "Device A_30m")!;

  assert.equal(devNow.presence, "ONLINE");
  assert.equal(dev2m.presence, "ONLINE");
  assert.equal(dev3m.presence, "ONLINE");
  assert.equal(dev5m.presence, "AWAY");
  assert.equal(dev15m.presence, "AWAY");
  assert.equal(dev30m.presence, "OFFLINE");
  console.log("-> listDevicesWithPresence returned correct 3-state values for all timestamps.");

  console.log("\\n3. Testing Dashboard API logic & Multi-tenant isolation");
  const { onlineWindowMs, awayWindowMs } = getHeartbeatWindows();
  
  const getCounts = (list: { lastSeenAt: string | null }[]) => {
    return list.reduce(
      (acc, d) => {
        const presence = derivePresence(d.lastSeenAt, onlineWindowMs, awayWindowMs);
        if (presence === "ONLINE") acc.onlineCount++;
        else if (presence === "AWAY") acc.awayCount++;
        else acc.offlineCount++;
        return acc;
      },
      { onlineCount: 0, awayCount: 0, offlineCount: 0 }
    );
  };

  const listB = await listDevicesWithPresence(tenantBId);
  
  const countsA = getCounts(listA);
  const countsB = getCounts(listB);

  assert.equal(countsA.onlineCount, 3);
  assert.equal(countsA.awayCount, 2);
  assert.equal(countsA.offlineCount, 1);
  assert.equal(listA.length, 6);
  assert.equal(countsA.onlineCount + countsA.awayCount + countsA.offlineCount, listA.length);
  console.log("-> Tenant A counts match exactly: 3 ONLINE, 2 AWAY, 1 OFFLINE. Total = 6.");

  assert.equal(countsB.onlineCount, 0);
  assert.equal(countsB.awayCount, 0);
  assert.equal(countsB.offlineCount, 2);
  assert.equal(listB.length, 2);
  console.log("-> Tenant B counts match exactly: 0 ONLINE, 0 AWAY, 2 OFFLINE. Total = 2.");
  
  console.log("-> Multi-tenant isolation verified (A does not leak to B, B does not leak to A).");

  console.log("\\n4. Testing Device Transition (ONLINE -> AWAY -> OFFLINE -> ONLINE)");
  const targetId = devicesA[0].id;
  
  await db.update(devices).set({ lastSeenAt: times.minus5m }).where(eq(devices.id, targetId));
  let updatedList = await listDevicesWithPresence(tenantAId);
  assert.equal(updatedList.find(d => d.id === targetId)!.presence, "AWAY");
  console.log("-> Transitioned to AWAY successfully.");

  await db.update(devices).set({ lastSeenAt: times.minus30m }).where(eq(devices.id, targetId));
  updatedList = await listDevicesWithPresence(tenantAId);
  assert.equal(updatedList.find(d => d.id === targetId)!.presence, "OFFLINE");
  console.log("-> Transitioned to OFFLINE successfully.");

  await db.update(devices).set({ lastSeenAt: times.now }).where(eq(devices.id, targetId));
  updatedList = await listDevicesWithPresence(tenantAId);
  assert.equal(updatedList.find(d => d.id === targetId)!.presence, "ONLINE");
  console.log("-> Transitioned back to ONLINE successfully.");

  console.log("\\nCleaning up test data...");
  await db.delete(devices).where(inArray(devices.id, [...devicesA, ...devicesB].map(d => d.id)));
  await db.delete(tenants).where(inArray(tenants.id, [tenantAId, tenantBId]));
  
  console.log("\\n=== INTEGRATION VERIFICATION COMPLETE ===");
  process.exit(0);
}

runVerification().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
