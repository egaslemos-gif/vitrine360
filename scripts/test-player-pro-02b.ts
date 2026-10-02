/**
 * PLAYER-PRO-02B — remote PAUSE/STOP vs EXPERIENCE. Run: npm run test:player-pro-02b
 *
 * Uses the REAL CommandDispatcher, REAL PlaybackController and REAL CommandPoller (the ACK
 * request body is captured from the poller's own fetch call) — no mock replaces the logic
 * under evaluation.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDeviceCommand, COMMAND_REJECT_REASONS, type CommandResult, type DeviceCommand } from "../src/domain/device-command";
import { createCommandDispatcher } from "../src/player/command/command-dispatcher";
import { createCommandPoller } from "../src/player/command/command-poller";
import { PlaybackController } from "../src/player/playback/playback-controller";

const root = process.cwd();
let n = 0;
function test(id: string, title: string, fn: () => void | Promise<void>) {
  const r = fn();
  const done = () => { n += 1; console.log(`PASS ${id} — ${title}`); };
  if (r && typeof (r as Promise<void>).then === "function") return (r as Promise<void>).then(done);
  done();
}

type Item = { playlistItemId: string; contentId: string; type: string; durationMs: number };
const EXP: Item = { playlistItemId: "e1", contentId: "ce1", type: "EXPERIENCE", durationMs: 12000 };
const items = (first: Item): Item[] => [first, { playlistItemId: "i2", contentId: "c2", type: "IMAGE", durationMs: 8000 }];

function harness(first: Item) {
  const controller = new PlaybackController({ now: () => 10_000 });
  controller.dispatch({ type: "LOAD_PLAYLIST", playlistId: "pl", manifestVersion: 1, items: items(first) });
  controller.dispatch({ type: "MEDIA_READY", durationMs: first.durationMs || 5000, generation: controller.getGeneration() });
  const telem: { type: string; reason?: string }[] = [];
  const dispatcher = createCommandDispatcher({
    controller,
    now: () => 1500,
    getSession: () => ({ sessionId: "ps_1", deviceId: "d1", tenantId: "t1" }),
    auth: { authorized: true, tenantId: "t1", deviceTenantId: "t1", deviceId: "d1" },
    onTelemetry: (e) => telem.push(e),
  });
  const cmd = (type: DeviceCommand["type"], id?: string): DeviceCommand => {
    const c = createDeviceCommand({ tenantId: "t1", deviceId: "d1", sessionId: "ps_1", type, binding: "SESSION_BOUND", issuedAt: 1000, ttlMs: 10_000, commandId: id });
    assert.ok(c.ok, "command created");
    return (c as { ok: true; command: DeviceCommand }).command;
  };
  return { controller, dispatcher, telem, cmd };
}

function expectNotApplied(first: Item, type: "PAUSE" | "STOP") {
  const h = harness(first);
  assert.equal(h.controller.getState().status, "PLAYING");
  const before = h.controller.getState();
  let notifications = 0;
  h.controller.subscribe(() => { notifications++; });
  const res = h.dispatcher.dispatch(h.cmd(type));
  assert.equal(res.status, "REJECTED", "ACK status is not APPLIED");
  assert.equal(res.reason, "NOT_SUPPORTED");
  assert.equal(res.action, null, "no action reported as executed");
  assert.equal(res.appliedAt, undefined, "no appliedAt");
  assert.deepEqual(h.controller.getState(), before, "PlaybackState identical (incl. generation, position, updatedAt)");
  assert.equal(h.controller.getGeneration(), before.generation, "generation unchanged");
  assert.equal(notifications, 0, "controller never notified (timer/renderer see no change)");
  assert.equal(h.controller.getState().status, "PLAYING", "experience stays active");
  assert.equal(h.controller.getState().currentContentType, "EXPERIENCE");
  assert.deepEqual(h.telem.map((e) => e.type), ["COMMAND_RECEIVED", "COMMAND_REJECTED"]);
  assert.equal(h.telem[1]!.reason, "NOT_SUPPORTED");
  // idempotent: same commandId is a duplicate of the SAME outcome, never re-applied
  const again = h.dispatcher.dispatch(h.cmd(type));
  assert.notEqual(again.status, "APPLIED");
  assert.equal(again.reason, "NOT_SUPPORTED");
  assert.deepEqual(h.controller.getState(), before);
}

async function main() {
  // ── A / B ────────────────────────────────────────────────────────────
  test("PRO02B-A", "EXPERIENCE + remote PAUSE: state/generation untouched, ACK REJECTED + NOT_SUPPORTED", () => expectNotApplied(EXP, "PAUSE"));
  test("PRO02B-B", "EXPERIENCE + remote STOP: state/generation untouched, ACK REJECTED + NOT_SUPPORTED", () => expectNotApplied(EXP, "STOP"));

  test("PRO02B-A2", "EXPERIENCE keeps accepting what it can honour (PLAY, NEXT, PREVIOUS, RESTART, SET_REPEAT_MODE, SET_VOLUME, SET_MUTED)", () => {
    for (const t of ["PLAY", "NEXT", "PREVIOUS", "RESTART", "SET_VOLUME", "SET_MUTED", "SET_REPEAT_MODE"] as const) {
      const h = harness(EXP);
      const base = createDeviceCommand({
        tenantId: "t1", deviceId: "d1", sessionId: "ps_1", type: t, binding: "SESSION_BOUND", issuedAt: 1000, ttlMs: 10_000,
        payload: t === "SET_VOLUME" ? { volume: 0.5 } : t === "SET_MUTED" ? { muted: true } : t === "SET_REPEAT_MODE" ? { repeatMode: "ITEM" } : undefined,
      });
      assert.ok(base.ok, `${t} created`);
      const res = h.dispatcher.dispatch((base as { ok: true; command: DeviceCommand }).command);
      assert.equal(res.status, "APPLIED", `${t} applied`);
    }
  });

  test("PRO02B-A3", "guard follows the CURRENT item: after NEXT leaves the EXPERIENCE, PAUSE applies; back on it, rejected again", () => {
    const h = harness(EXP);
    assert.equal(h.dispatcher.dispatch(h.cmd("NEXT")).status, "APPLIED");
    h.controller.dispatch({ type: "MEDIA_READY", durationMs: 8000, generation: h.controller.getGeneration() });
    assert.equal(h.controller.getState().currentContentType, "IMAGE");
    assert.equal(h.dispatcher.dispatch(h.cmd("PAUSE")).status, "APPLIED");
    assert.equal(h.controller.getState().status, "PAUSED");
    assert.equal(h.dispatcher.dispatch(h.cmd("PLAY")).status, "APPLIED");
    h.controller.dispatch({ type: "MEDIA_READY", durationMs: 8000, generation: h.controller.getGeneration() });
    assert.equal(h.dispatcher.dispatch(h.cmd("NEXT")).status, "APPLIED"); // wraps to the experience
    h.controller.dispatch({ type: "MEDIA_READY", durationMs: 12000, generation: h.controller.getGeneration() });
    assert.equal(h.controller.getState().currentContentType, "EXPERIENCE");
    assert.equal(h.dispatcher.dispatch(h.cmd("STOP")).reason, "NOT_SUPPORTED");
    assert.equal(h.controller.getState().status, "PLAYING");
  });

  // ── C / D: MEDIA behaviour preserved ─────────────────────────────────
  for (const t of ["VIDEO", "AUDIO", "IMAGE", "TEXT", "CLOCK"]) {
    const first: Item = { playlistItemId: "m1", contentId: "cm1", type: t, durationMs: t === "VIDEO" || t === "AUDIO" ? 0 : 6000 };
    test(`PRO02B-C-${t}`, `${t} + remote PAUSE: unchanged (APPLIED, PAUSED, same state as a direct controller PAUSE)`, () => {
      const h = harness(first);
      const ref = new PlaybackController({ now: () => 10_000 });
      ref.dispatch({ type: "LOAD_PLAYLIST", playlistId: "pl", manifestVersion: 1, items: items(first) });
      ref.dispatch({ type: "MEDIA_READY", durationMs: first.durationMs || 5000, generation: ref.getGeneration() });
      ref.dispatch({ type: "PAUSE" });
      const res = h.dispatcher.dispatch(h.cmd("PAUSE"));
      assert.equal(res.status, "APPLIED");
      assert.equal(res.action, "PAUSE");
      assert.equal(res.reason, undefined);
      assert.deepEqual(h.controller.getState(), ref.getState());
      assert.equal(h.controller.getState().status, "PAUSED");
    });
    test(`PRO02B-D-${t}`, `${t} + remote STOP: unchanged (APPLIED, STOPPED, position 0)`, () => {
      const h = harness(first);
      const ref = new PlaybackController({ now: () => 10_000 });
      ref.dispatch({ type: "LOAD_PLAYLIST", playlistId: "pl", manifestVersion: 1, items: items(first) });
      ref.dispatch({ type: "MEDIA_READY", durationMs: first.durationMs || 5000, generation: ref.getGeneration() });
      ref.dispatch({ type: "STOP" });
      const res = h.dispatcher.dispatch(h.cmd("STOP"));
      assert.equal(res.status, "APPLIED");
      assert.equal(res.action, "STOP");
      assert.deepEqual(h.controller.getState(), ref.getState());
      assert.equal(h.controller.getState().status, "STOPPED");
    });
  }

  // ── protocol / unknown commands ──────────────────────────────────────
  test("PRO02B-P1", "protocol: NOT_SUPPORTED is an additive REJECT reason; unknown command types still UNSUPPORTED_COMMAND", () => {
    assert.ok((COMMAND_REJECT_REASONS as readonly string[]).includes("NOT_SUPPORTED"));
    assert.ok((COMMAND_REJECT_REASONS as readonly string[]).includes("UNSUPPORTED_COMMAND"));
    const h = harness(EXP);
    const bogus = { ...h.cmd("PLAY"), type: "SELF_DESTRUCT" } as unknown as DeviceCommand;
    const res = h.dispatcher.dispatch(bogus);
    assert.equal(res.status, "REJECTED");
    assert.equal(res.reason, "UNSUPPORTED_COMMAND");
  });

  test("PRO02B-P2", "server ACK contract accepts it unchanged: status REJECTED is in the ACK enum and `reason` is a free string (<= 80)", () => {
    const route = readFileSync(join(root, "src/app/api/device/commands/[commandId]/ack/route.ts"), "utf8");
    assert.ok(/reason: z\.string\(\)\.max\(80\)\.nullable\(\)\.optional\(\)/.test(route));
    const transport = readFileSync(join(root, "src/domain/command-transport.ts"), "utf8");
    assert.ok(/ACK_RESULT_STATUSES = \[[^\]]*"REJECTED"/.test(transport));
    assert.ok("NOT_SUPPORTED".length <= 80);
  });

  // ── real poller: the ACK that would be POSTed ─────────────────────────
  await test("PRO02B-W", "real CommandPoller ACKs EXPERIENCE PAUSE/STOP as REJECTED/NOT_SUPPORTED (never APPLIED) and a MEDIA PAUSE as APPLIED", async () => {
    const run = async (first: Item, type: "PAUSE" | "STOP") => {
      const h = harness(first);
      const c = h.cmd(type, `cmd_${first.type}_${type}`);
      const acks: Record<string, unknown>[] = [];
      const fetchImpl = (async (url: string, init?: RequestInit) => {
        if (String(url).endsWith("/api/device/commands")) {
          return new Response(JSON.stringify({ commands: [{ commandId: c.commandId, tenantId: c.tenantId, deviceId: c.deviceId, sessionId: c.sessionId ?? null, binding: c.binding, type: c.type, payload: c.payload, issuedAt: c.issuedAt, expiresAt: c.expiresAt }] }), { status: 200 });
        }
        acks.push(JSON.parse(String(init?.body)));
        return new Response("{}", { status: 200 });
      }) as unknown as typeof fetch;
      const results: CommandResult[] = [];
      const poller = createCommandPoller({ getDeviceToken: () => "tok", dispatcher: h.dispatcher, fetchImpl, onResult: (r) => results.push(r) });
      await poller.pollOnce();
      return { ack: acks[0]!, state: h.controller.getState().status };
    };
    for (const type of ["PAUSE", "STOP"] as const) {
      const r = await run(EXP, type);
      assert.equal(r.ack.status, "REJECTED");
      assert.equal(r.ack.reason, "NOT_SUPPORTED");
      assert.equal(r.state, "PLAYING");
    }
    const m = await run({ playlistItemId: "v", contentId: "cv", type: "VIDEO", durationMs: 0 }, "PAUSE");
    assert.equal(m.ack.status, "APPLIED");
    assert.equal(m.ack.reason, null);
    assert.equal(m.state, "PAUSED");
  });

  // ── scope ────────────────────────────────────────────────────────────
  test("PRO02B-S", "scope: runtime EXPERIENCE, admission, sandbox, bridge, command-mapping/poller, controller and tv.js untouched", () => {
    const changed = execSync("git status --porcelain", { cwd: root, encoding: "utf8" })
      .split("\n").filter(Boolean).map((l) => l.slice(3).trim());
    const protectedRe = /experience|sandbox|bridge|admission|runtime\/|public\/tv\.|command-mapping|command-poller|command-authorize|playback-controller|playback-state|prisma|drizzle|migrations|schema/i;
    const touched = changed.filter((f) => protectedRe.test(f) && !/^docs\/evidence\//.test(f) && !/^scripts\/(test|live)-/.test(f));
    assert.deepEqual(touched, [], `protected files touched: ${touched.join(", ")}`);
  });

  console.log(`\nPLAYER-PRO-02B: ${n} PASS`);
}

main().catch((e) => { console.error(e); process.exit(1); });
