/**
 * PLAYLIST-ATOMICITY — testes da Etapa 2 (adição atómica de itens).
 *
 * TESTES DE INTEGRAÇÃO: invocam as funções REAIS de src/services/playlists.ts
 * (e a cadeia real: bumpPlaylistVersion, logActivity, enqueueDeviceCommand,
 * db.transaction BEGIN IMMEDIATE do libsql) contra SQLite temporária com
 * as migrações presentes em drizzle/ mais ensureSchema(). Nenhuma lógica
 * testada é reimplementada em variáveis locais; a injecção de falhas é feita
 * na camada SQLite (triggers RAISE(ABORT)), nunca por mock das funções.
 * Não há novos testes unitários: a Etapa 2 não introduziu lógica pura nova
 * (apenas propagação de handle tx + mutex) — o que é testável isoladamente
 * (TRANSITIONS etc.) já tem cobertura prévia.
 *
 *  T1 sucesso — item, posição, versão, device manifest, auditoria e hint
 *  T2 falha controlada em bumpPlaylistVersion → rollback de item+posição+auditoria
 *  T3 falha de inserção → nenhuma alteração parcial (versão/auditoria intactas)
 *  T4 concorrência — 5 adições paralelas → posições únicas, sem lost update
 *  T5 isolamento — tenant B não altera playlist/conteúdo do tenant A
 *  T6 auditoria — atómica com a alteração (falhas não deixam linhas)
 *  T7 regressão — create/update/reorder/updateItem/remove/duplicate/delete/
 *                  getWithItems/list + bump histórico sem tx
 *
 * Sem .env.local, sem serviços remotos.
 * Run: node --import tsx scripts/test-playlist-atomicity.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STAMP = Date.now().toString(36);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), `v360-atom-${STAMP}-`));
const DB_FILE = path.join(TMP, "atom.db").replace(/\\/g, "/");

process.env.DATABASE_URL = `file:${DB_FILE}`;
process.env.DATABASE_AUTH_TOKEN = "";
process.env.MEDIA_STORAGE_PROVIDER = "local";
process.env.MEDIA_LOCAL_DIR = path.join(TMP, "uploads").replace(/\\/g, "/");
process.env.AUTH_SECRET = `atom-secret-${STAMP}-nao-usar-fora-de-teste`;

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      checks.push({ name, ok: true, detail: "ok" });
      console.log(`PASS  ${name}`);
    })
    .catch((err) => {
      checks.push({ name, ok: false, detail: String(err) });
      console.log(`FAIL  ${name} — ${String(err)}`);
    });
}

async function main() {
  console.log("=== PLAYLIST-ATOMICITY (integração, funções reais) ===");
  console.log("Temp dir:", TMP);

  // ── Bootstrap: schema completo (migrações 0000–0012 + ensureSchema) ──
  const { createClient } = (await import("@libsql/client")) as typeof import("@libsql/client");
  const raw = createClient({ url: `file:${DB_FILE}` });
  rawClient = raw;
  for (const f of fs.readdirSync("drizzle").filter((x) => x.endsWith(".sql")).sort()) {
    await raw.executeMultiple(fs.readFileSync(path.join("drizzle", f), "utf8"));
  }

  const dbKit = await import("../src/db");
  mainClient = dbKit.client;
  await dbKit.ensureSchema(); // memberships, device_command_inbox, etc. (idempotente)

  const svc = await import("../src/services/playlists");
  const { activityLogs, deviceCommandInbox, devices, playlistItems, playlists } =
    dbKit.schema;
  const { and, eq, asc, sql } = await import("drizzle-orm");
  const db = dbKit.db;

  // ── Seed (raw SQL, mesmo formato dos testes anteriores) ──
  const now = new Date().toISOString();
  const ins = (sqlText: string, args: (string | number | null)[] = []) =>
    raw.execute({ sql: sqlText, args });
  await ins(
    "INSERT INTO tenants (id, name, slug, created_at, updated_at) VALUES ('t1','Tenant 1','t1',?,?),('t2','Tenant 2','t2',?,?)",
    [now, now, now, now],
  );
  await ins(
    "INSERT INTO users (id, tenant_id, name, email, password_hash, role, created_at, updated_at) VALUES ('u1','t1','Admin','a@t1.dev','x','ADMIN',?,?),('u2','t2','Admin B','b@t2.dev','x','ADMIN',?,?)",
    [now, now, now, now],
  );
  await ins(
    "INSERT INTO playlists (id, tenant_id, name, version, created_at, updated_at) VALUES ('pl1','t1','PL1',0,?,?),('pl2','t2','PL2',0,?,?)",
    [now, now, now, now],
  );
  for (const [cid, tid] of [
    ["c1", "t1"], ["c2", "t1"], ["c3", "t1"], ["c4", "t1"],
    ["c5", "t1"], ["c6", "t1"], ["c7", "t1"], ["cX", "t2"],
  ] as const) {
    await ins(
      `INSERT INTO contents (id, tenant_id, title, type, payload, status, created_at, updated_at) VALUES ('${cid}','${tid}','${cid}','TEXT','{}','ACTIVE',?,?)`,
      [now, now],
    );
  }
  // d1 ACTIVE (recebe hint FORCE_SYNC); d2 PENDING (sem hint)
  await ins(
    "INSERT INTO devices (id, tenant_id, device_code, name, status, current_playlist_id, manifest_version, created_at, updated_at) VALUES ('d1','t1','D1','Device 1','ACTIVE','pl1',5,?,?),('d2','t1','D2','Device 2','PENDING','pl1',3,?,?)",
    [now, now, now, now],
  );

  // Helpers de leitura (apenas verificação; não reimplementam lógica)
  const itemsOf = (pl: string) =>
    db.select().from(playlistItems).where(eq(playlistItems.playlistId, pl))
      .orderBy(asc(playlistItems.position));
  const playlistRow = async (pl: string) =>
    (await db.select().from(playlists).where(eq(playlists.id, pl)).limit(1))[0]!;
  const auditCount = async (action: string) => {
    const r = await db
      .select({ n: sql<number>`count(*)` })
      .from(activityLogs)
      .where(eq(activityLogs.action, action));
    return Number(r[0]!.n);
  };
  const inboxCount = async () => {
    const r = await db.select({ n: sql<number>`count(*)` }).from(deviceCommandInbox);
    return Number(r[0]!.n);
  };

  // ══════════ T1 — SUCESSO ══════════
  let id1 = "";
  await check("T1a: addPlaylistItem real persiste item pos 0 + versão 1", async () => {
    id1 = await svc.addPlaylistItem({
      playlistId: "pl1", contentId: "c1", tenantId: "t1", userId: "u1",
    });
    const items = await itemsOf("pl1");
    assert.equal(items.length, 1);
    assert.equal(items[0]!.id, id1);
    assert.equal(items[0]!.position, 0);
    assert.equal(items[0]!.transition, "fade");
    assert.equal((await playlistRow("pl1")).version, 1);
  });
  await check("T1b: device ligado bumpou manifest_version e limpou effective_playback_key", async () => {
    const d1 = (await db.select().from(devices).where(eq(devices.id, "d1")).limit(1))[0]!;
    assert.equal(d1.manifestVersion, 6);
    assert.equal(d1.effectivePlaybackKey, null);
    const d2 = (await db.select().from(devices).where(eq(devices.id, "d2")).limit(1))[0]!;
    assert.equal(d2.manifestVersion, 4);
  });
  await check("T1c: hint FORCE_SYNC enfileirado pós-commit (device ACTIVE)", async () => {
    assert.equal(await inboxCount(), 1);
    const row = (await db.select().from(deviceCommandInbox).limit(1))[0]!;
    assert.equal(row.deviceId, "d1");
    assert.equal(row.type, "FORCE_SYNC");
    assert.equal(row.correlationId, "playlist:pl1:v1");
  });
  await check("T1d: auditoria playlist.item_added registada", async () => {
    assert.equal(await auditCount("playlist.item_added"), 1);
  });
  await check("T1e: 2.ª adição → posição 1, versão 2", async () => {
    const id2 = await svc.addPlaylistItem({
      playlistId: "pl1", contentId: "c2", tenantId: "t1",
      durationOverrideMs: 1234, transition: "zoom",
    });
    const items = await itemsOf("pl1");
    assert.equal(items.length, 2);
    assert.equal(items[1]!.id, id2);
    assert.equal(items[1]!.position, 1);
    assert.equal(items[1]!.durationOverrideMs, 1234);
    assert.equal(items[1]!.transition, "zoom");
    assert.equal((await playlistRow("pl1")).version, 2);
  });

  // Serializa err + cadeia de causes (drizzle envolve o erro SQLite original;
  // a mensagem do trigger fica em err.cause).
  const errChain = (err: unknown): string => {
    let out = String(err);
    let cur: unknown = (err as { cause?: unknown })?.cause;
    while (cur) {
      out += " | " + String(cur);
      cur = (cur as { cause?: unknown })?.cause;
    }
    return out;
  };

  // ══════════ T2 — FALHA CONTROLADA EM bumpPlaylistVersion ══════════
  await raw.execute(
    "CREATE TRIGGER fail_bump BEFORE UPDATE ON playlists BEGIN SELECT RAISE(ABORT, 'forced bump failure'); END",
  );
  await check("T2a: falha em bumpPlaylistVersion propaga erro (UPDATE playlists abortado)", async () => {
    const err = await svc
      .addPlaylistItem({ playlistId: "pl1", contentId: "c3", tenantId: "t1" })
      .then(() => null, (e: unknown) => e);
    assert.ok(err, "devia ter falhado");
    const chain = errChain(err);
    assert.match(chain, /update "playlists"/); // falhou na query real do bump
    assert.match(chain, /forced bump failure/); // causa = trigger
  });
  await check("T2b: rollback total — sem item, posição e versão intactas", async () => {
    const items = await itemsOf("pl1");
    assert.equal(items.length, 2); // continua só c1,c2
    assert.deepEqual(items.map((i) => i.position), [0, 1]);
    assert.equal((await playlistRow("pl1")).version, 2);
  });
  await check("T2c: rollback inclui auditoria e manifest_version dos devices", async () => {
    assert.equal(await auditCount("playlist.item_added"), 2); // só T1a/T1e
    const d1 = (await db.select().from(devices).where(eq(devices.id, "d1")).limit(1))[0]!;
    assert.equal(d1.manifestVersion, 7); // 5→6 (T1a) →7 (T1e); T2 não bumpou
  });
  await raw.execute("DROP TRIGGER fail_bump");

  // ══════════ T3 — FALHA DE INSERÇÃO ══════════
  await raw.execute(
    "CREATE TRIGGER fail_insert BEFORE INSERT ON playlist_items BEGIN SELECT RAISE(ABORT, 'forced insert failure'); END",
  );
  await check("T3a: falha de inserção propaga erro (INSERT playlist_items abortado)", async () => {
    const err = await svc
      .addPlaylistItem({ playlistId: "pl1", contentId: "c3", tenantId: "t1" })
      .then(() => null, (e: unknown) => e);
    assert.ok(err, "devia ter falhado");
    const chain = errChain(err);
    assert.match(chain, /insert into "playlist_items"/); // falhou no INSERT real
    assert.match(chain, /forced insert failure/); // causa = trigger
  });
  await check("T3b: nenhuma alteração parcial (versão/auditoria/devices)", async () => {
    assert.equal((await itemsOf("pl1")).length, 2);
    assert.equal((await playlistRow("pl1")).version, 2);
    assert.equal(await auditCount("playlist.item_added"), 2);
    const d1 = (await db.select().from(devices).where(eq(devices.id, "d1")).limit(1))[0]!;
    assert.equal(d1.manifestVersion, 7);
  });
  await raw.execute("DROP TRIGGER fail_insert");

  // ══════════ T4 — CONCORRÊNCIA ══════════
  await check("T4: 5 adições paralelas → posições únicas 2..6, versão 7, sem lost update", async () => {
    const ids = await Promise.all(
      ["c3", "c4", "c5", "c6", "c7"].map((contentId) =>
        svc.addPlaylistItem({ playlistId: "pl1", contentId, tenantId: "t1" }),
      ),
    );
    assert.equal(new Set(ids).size, 5);
    const items = await itemsOf("pl1");
    assert.equal(items.length, 7);
    assert.deepEqual(items.map((i) => i.position), [0, 1, 2, 3, 4, 5, 6]);
    assert.equal((await playlistRow("pl1")).version, 7);
    assert.equal(await auditCount("playlist.item_added"), 7);
  });

  // ══════════ T5 — ISOLAMENTO DE TENANT ══════════
  await check("T5a: tenant B não adiciona em playlist do tenant A", async () => {
    await assert.rejects(
      svc.addPlaylistItem({ playlistId: "pl1", contentId: "cX", tenantId: "t2" }),
      /Playlist not found/,
    );
  });
  await check("T5b: tenant A não usa conteúdo do tenant B", async () => {
    await assert.rejects(
      svc.addPlaylistItem({ playlistId: "pl1", contentId: "cX", tenantId: "t1" }),
      /Content not found/,
    );
  });
  await check("T5c: tenant B opera normalmente na sua playlist; pl1 intacta", async () => {
    await svc.addPlaylistItem({ playlistId: "pl2", contentId: "cX", tenantId: "t2" });
    assert.equal((await itemsOf("pl2")).length, 1);
    assert.equal((await playlistRow("pl2")).version, 1);
    assert.equal((await itemsOf("pl1")).length, 7);
    assert.equal((await playlistRow("pl1")).version, 7);
  });

  // ══════════ T6 — AUDITORIA (semântica: atómica com a alteração) ══════════
  await check("T6: auditoria atómica — só alterações commitadas têm linha", async () => {
    // sucessos: T1a, T1e, T4×5, T5c = 8; falhas T2/T3/T5a/T5b não deixaram linhas
    assert.equal(await auditCount("playlist.item_added"), 8);
    const rows = await db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.action, "playlist.item_added"),
          eq(activityLogs.resourceId, "pl1"),
        ),
      );
    assert.equal(rows.length, 7);
    assert.ok(rows.every((r) => r.tenantId === "t1"));
  });

  // ══════════ T7 — REGRESSÃO DAS OPERAÇÕES EXISTENTES ══════════
  await check("T7a: createPlaylist + listPlaylists", async () => {
    const plId = await svc.createPlaylist({ name: "Regressão", description: "d" }, "t1", "u1");
    const list = await svc.listPlaylists("t1");
    assert.ok(list.some((p) => p.id === plId && p.name === "Regressão"));
  });
  await check("T7b: getPlaylistWithItems ordenado + updatePlaylistDetails (bump sem tx)", async () => {
    const full = await svc.getPlaylistWithItems("pl1", "t1");
    assert.equal(full!.items.length, 7);
    assert.deepEqual(full!.items.map((i) => i.position), [0, 1, 2, 3, 4, 5, 6]);
    await svc.updatePlaylistDetails("pl1", { name: "PL1-renamed" }, "t1");
    const row = await playlistRow("pl1");
    assert.equal(row.name, "PL1-renamed");
    assert.equal(row.version, 8);
  });
  await check("T7c: reorderPlaylistItems", async () => {
    const items = await itemsOf("pl1");
    const reversed = items.map((i) => i.id).reverse();
    await svc.reorderPlaylistItems("pl1", reversed, "t1");
    const after = await itemsOf("pl1");
    assert.deepEqual(after.map((i) => i.id), reversed);
    assert.equal((await playlistRow("pl1")).version, 9);
  });
  await check("T7d: updatePlaylistItem (durationOverride/transition/fitMode/active)", async () => {
    const [first] = await itemsOf("pl1");
    await svc.updatePlaylistItem(
      "pl1", first!.id,
      { durationOverrideMs: 5000, transition: "cut", fitMode: "contain", active: false },
      "t1",
    );
    const [after] = await itemsOf("pl1");
    assert.equal(after!.durationOverrideMs, 5000);
    assert.equal(after!.transition, "cut");
    assert.equal(after!.fitMode, "contain");
    assert.equal(after!.active, false);
    assert.equal((await playlistRow("pl1")).version, 10);
  });
  await check("T7e: removePlaylistItem", async () => {
    const before = await itemsOf("pl1");
    await svc.removePlaylistItem("pl1", before[0]!.id, "t1");
    assert.equal((await itemsOf("pl1")).length, before.length - 1);
    assert.equal((await playlistRow("pl1")).version, 11);
  });
  await check("T7f: duplicatePlaylist + deletePlaylist", async () => {
    const copyId = await svc.duplicatePlaylist("pl1", "t1", "u1");
    const copy = await svc.getPlaylistWithItems(copyId, "t1");
    assert.equal(copy!.items.length, (await itemsOf("pl1")).length);
    await svc.deletePlaylist(copyId, "t1", "u1");
    assert.equal(await svc.getPlaylistWithItems(copyId, "t1"), null);
  });
  await check("T7g: bumpPlaylistVersion directo sem tx — caminho histórico + retorno novo", async () => {
    const before = await inboxCount();
    const res = await svc.bumpPlaylistVersion("pl1", "t1");
    assert.equal(res.newVersion, 12);
    assert.deepEqual(res.pendingSyncHints, []); // sem tx: enqueue imediato
    assert.equal((await playlistRow("pl1")).version, 12);
    assert.ok((await inboxCount()) > before); // hint imediato enfileirado
  });

  await check("T8a: bump exige tenantId (vazio e espaços falham, versão intacta)", async () => {
    const version = (await playlistRow("pl1")).version;
    await assert.rejects(() => svc.bumpPlaylistVersion("pl1", ""), /tenantId is required/);
    await assert.rejects(() => svc.bumpPlaylistVersion("pl1", "   "), /tenantId is required/);
    assert.equal((await playlistRow("pl1")).version, version);
  });
  await check("T8b: bump de outro tenant é no-op (versão e devices de pl1)", async () => {
    const version = (await playlistRow("pl1")).version;
    const d1 = (await db.select().from(devices).where(eq(devices.id, "d1")).limit(1))[0]!;
    const res = await svc.bumpPlaylistVersion("pl1", "t2");
    assert.equal(res.newVersion, null);
    assert.deepEqual(res.pendingSyncHints, []);
    assert.equal((await playlistRow("pl1")).version, version);
    const d1after = (await db.select().from(devices).where(eq(devices.id, "d1")).limit(1))[0]!;
    assert.equal(d1after.manifestVersion, d1.manifestVersion);
  });

  // ── Sumário ──
  const fails = checks.filter((c) => !c.ok);
  console.log("----------------------------------------");
  console.log(`TOTAL: ${checks.length - fails.length}/${checks.length} PASS`);
  if (fails.length > 0) {
    console.log("PLAYLIST-ATOMICITY: FALHAS");
    for (const f of fails) console.log(`  - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  } else {
    console.log("PLAYLIST-ATOMICITY: PASS");
  }
}

let rawClient: { close: () => void } | null = null;
let mainClient: { close: () => void } | null = null;

main()
  .catch((err) => {
    console.error("ERRO FATAL:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      rawClient?.close();
    } catch { /* ignore */ }
    try {
      mainClient?.close();
    } catch { /* ignore */ }
    // Windows só liberta o handle do ficheiro quando o processo termina →
    // retry e, em último caso, remoção destacada pós-exit.
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        fs.rmSync(TMP, { recursive: true, force: true });
        console.log("Cleanup OK:", TMP);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    if (process.platform === "win32") {
      const { spawn } = await import("node:child_process");
      spawn(
        "cmd",
        ["/c", "ping", "127.0.0.1", "-n", "3", ">nul", "&", "rmdir", "/s", "/q", TMP],
        { detached: true, stdio: "ignore", windowsHide: true },
      ).unref();
      console.log("Cleanup agendado pós-exit:", TMP);
    } else {
      console.log("Cleanup FALHOU (remover manualmente):", TMP);
    }
  });
