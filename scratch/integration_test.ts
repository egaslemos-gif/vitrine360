import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../src/db";
import { contents, playlists, devices, schedules, scheduleTargets, tenants, users } from "../src/db/schema";

import { resolveEffectivePlayback } from "../src/domain/playback-resolver";
import { buildDeviceManifest } from "../src/services/manifest";
import { eq } from "drizzle-orm";
import {
  createPlaylist,
  addPlaylistItem,
  reorderPlaylistItems,
  updatePlaylistItem,
  duplicatePlaylist,
} from "../src/services/playlists";
import * as crypto from "crypto";

// (Node 19+ has globalThis.crypto available by default)

async function runTest() {
  console.log("=== INICIANDO TESTE DE INTEGRAÇÃO MULTI-PLAYLIST ===");

  // Setup: Find a tenant
  const tenantRows = await db.select().from(tenants).limit(1);
  if (!tenantRows.length) throw new Error("No tenants found in the DB. Please run migrations/seed.");
  const tenantId = tenantRows[0].id;
  
  const userRows = await db.select().from(users).where(eq(users.tenantId, tenantId)).limit(1);
  const userId = userRows.length ? userRows[0].id : undefined;

  // Cleanup past test data
  console.log("[Setup] Limpando dados de testes anteriores...");
  await db.delete(contents).where(eq(contents.title, "Content A (Test)"));
  await db.delete(contents).where(eq(contents.title, "Content B (Test)"));
  await db.delete(playlists).where(eq(playlists.name, "Playlist A (Test)"));
  await db.delete(devices).where(eq(devices.name, "Device (Test)"));

  // 1 & 2. Create Contents
  console.log("[Passo 1 & 2] Criando Content A e B...");
  const contentAId = crypto.randomUUID();
  const contentBId = crypto.randomUUID();
  await db.insert(contents).values([
    { id: contentAId, title: "Content A (Test)", type: "VIDEO", durationMs: 10000, tenantId },
    { id: contentBId, title: "Content B (Test)", type: "IMAGE", durationMs: 5000, tenantId },
  ]);

  // 3. Create Playlist A
  console.log("[Passo 3] Criando Playlist A...");
  const playlistAId = await createPlaylist({ name: "Playlist A (Test)" }, tenantId, userId);

  // 4. Add A and B
  console.log("[Passo 4] Adicionando Content A e B à Playlist A...");
  const itemAId = await addPlaylistItem({ playlistId: playlistAId, contentId: contentAId, tenantId, userId });
  const itemBId = await addPlaylistItem({ playlistId: playlistAId, contentId: contentBId, tenantId, userId });

  // 5. Reorder
  console.log("[Passo 5] Reordenando itens (B primeiro, depois A)...");
  await reorderPlaylistItems(playlistAId, [itemBId, itemAId], tenantId, userId);

  // 6 & 7. Alter durationOverride
  console.log("[Passo 6 & 7] Alterando durationOverride do Content B para 15s...");
  await updatePlaylistItem(playlistAId, itemBId, { durationOverrideMs: 15000 }, tenantId, userId);

  // 8. Duplicate Playlist A
  console.log("[Passo 8] Duplicando Playlist A para criar Playlist B...");
  const playlistBId = await duplicatePlaylist(playlistAId, tenantId, userId);
  
  // 9. Modify the copy (rename)
  console.log("[Passo 9] Renomeando a cópia para 'Playlist B (Test)'...");
  await db.update(playlists).set({ name: "Playlist B (Test)" }).where(eq(playlists.id, playlistBId));

  // 10. Set Playlist A as currentPlaylist
  console.log("[Passo 10] Criando um Device e definindo Playlist A como fallback/currentPlaylist...");
  const deviceId = crypto.randomUUID();
  await db.insert(devices).values({
    id: deviceId,
    name: "Device (Test)",
    deviceCode: "TEST-01",
    currentPlaylistId: playlistAId,
    tenantId,
  });

  // 11. Create Schedule for Playlist B
  console.log("[Passo 11] Criando Schedule associado à Playlist B para este dispositivo...");
  const scheduleId = crypto.randomUUID();
  await db.insert(schedules).values({
    id: scheduleId,
    name: "Schedule B (Test)",
    playlistId: playlistBId,
    priority: "HIGH",
    active: true,
    tenantId,
  });
  await db.insert(scheduleTargets).values({
    id: crypto.randomUUID(),
    scheduleId,
    targetType: "DEVICE",
    targetId: deviceId,
  });

  // 12. Resolve EffectivePlayback
  console.log("[Passo 12] Resolvendo EffectivePlayback...");
  const { effectiveState } = await resolveEffectivePlayback(deviceId, new Date());
  
  console.log("-> Playlist Efetiva (Deve ser Playlist B):", effectiveState.playlistId === playlistBId ? "PASS" : "FAIL", `(${effectiveState.playlistId})`);
  console.log("-> Source:", effectiveState.source);

  if (effectiveState.playlistId !== playlistBId) {
    throw new Error("Resolver não devolveu a Playlist do Schedule ativo!");
  }

  // 13. Generate Manifest
  console.log("[Passo 13] Gerando Manifest...");
  const device = (await db.select().from(devices).where(eq(devices.id, deviceId)))[0];
  const manifest = await buildDeviceManifest(device);

  // 14. Confirm Manifest
  console.log("[Passo 14] Confirmando propriedades do Manifest...");
  if (manifest.playlist?.id !== playlistBId) {
    throw new Error("Manifest devolveu playlist errada!");
  }
  if (manifest.playlist.items.length !== 2) {
    throw new Error("Manifest devolveu quantidade de itens errada!");
  }
  if (manifest.playlist.items[0].contentId !== contentBId) {
    throw new Error("Reordenação não refletida no Manifest!");
  }
  if (manifest.playlist.items[0].durationMs !== 15000) {
    throw new Error("Duration Override não refletido no Manifest!");
  }
  console.log("-> Validações do Manifest: PASS");

  // 15. Remove Schedule
  console.log("[Passo 15] Removendo Schedule ativo...");
  await db.delete(schedules).where(eq(schedules.id, scheduleId));

  // 16. Confirm return to fallback
  console.log("[Passo 16] Resolvendo EffectivePlayback novamente (deve retornar ao fallback)...");
  const { effectiveState: fallbackState } = await resolveEffectivePlayback(deviceId, new Date());
  console.log("-> Playlist Efetiva (Deve ser Playlist A):", fallbackState.playlistId === playlistAId ? "PASS" : "FAIL", `(${fallbackState.playlistId})`);
  console.log("-> Source:", fallbackState.source);

  if (fallbackState.playlistId !== playlistAId) {
    throw new Error("Resolver não devolveu a Playlist Fallback!");
  }

  console.log("=== TESTE DE INTEGRAÇÃO PASSOU COM SUCESSO! ===");

  // Cleanup
  console.log("[Limpeza] Removendo dados de teste...");
  await db.delete(contents).where(eq(contents.id, contentAId));
  await db.delete(contents).where(eq(contents.id, contentBId));
  await db.delete(playlists).where(eq(playlists.id, playlistAId));
  await db.delete(playlists).where(eq(playlists.id, playlistBId));
  await db.delete(devices).where(eq(devices.id, deviceId));

  process.exit(0);
}

runTest().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
