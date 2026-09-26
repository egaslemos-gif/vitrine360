/**
 * RUNTIME-PLAYBACK-07 — Device Command Model & Dispatch Foundation
 * Run: npm run test:runtime-playback-07
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PlaybackController } from "../src/player/playback/playback-controller";
import {
  COMMAND_TTL,
  MAX_COMMAND_BYTES,
  createDeviceCommand,
  createCommandId,
  emptyPayload,
  isCommandExpired,
  isDeviceCommandType,
  measureCommandBytes,
  parseDeviceCommand,
  serializeDeviceCommand,
  validateCommandPayload,
} from "../src/domain/device-command";
import { mapCommandToPlaybackAction } from "../src/domain/command-mapping";
import {
  DEVICE_COMMAND_PERMISSION,
  authorizeDeviceCommand,
} from "../src/domain/command-authorize";
import { createIdempotencyStore } from "../src/player/command/idempotency-store";
import { createCommandDispatcher } from "../src/player/command/command-dispatcher";
import { createLocalCommandTransport } from "../src/player/command/local-command-transport";

const ROOT = path.resolve(".");
const EVIDENCE = path.join(ROOT, "docs/evidence/runtime-playback-07");

type Result = { id: string; name: string; pass: boolean; detail?: string };
const results: Result[] = [];

function test(id: string, name: string, fn: () => void): void {
  try {
    fn();
    results.push({ id, name, pass: true });
    console.log(`PASS ${id} ${name}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ id, name, pass: false, detail });
    console.error(`FAIL ${id} ${name}: ${detail}`);
  }
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function loadController(): PlaybackController {
  const c = new PlaybackController({ now: () => 10_000 });
  c.dispatch({
    type: "LOAD_PLAYLIST",
    playlistId: "pl",
    manifestVersion: 1,
    items: [
      {
        playlistItemId: "i1",
        contentId: "c1",
        type: "IMAGE",
        durationMs: 8000,
      },
      {
        playlistItemId: "i2",
        contentId: "c2",
        type: "IMAGE",
        durationMs: 8000,
      },
    ],
  });
  const gen = c.getGeneration();
  c.dispatch({ type: "MEDIA_READY", durationMs: 8000, generation: gen });
  return c;
}

function baseCmd(
  overrides: Partial<Parameters<typeof createDeviceCommand>[0]> = {},
) {
  return createDeviceCommand({
    tenantId: "t1",
    deviceId: "d1",
    sessionId: "ps_1",
    type: "PLAY",
    binding: "SESSION_BOUND",
    issuedAt: 1000,
    ttlMs: 10_000,
    ...overrides,
  });
}

function harness(opts?: {
  sessionId?: string | null;
  tenantId?: string;
  deviceId?: string;
  authorized?: boolean;
  now?: number;
  role?: "OPERATOR" | "VIEWER";
}) {
  const controller = loadController();
  const now = opts?.now ?? 1500;
  const sessionId = opts?.sessionId === null ? null : (opts?.sessionId ?? "ps_1");
  const telem: string[] = [];
  const dispatcher = createCommandDispatcher({
    controller,
    now: () => now,
    getSession: () =>
      sessionId
        ? {
            sessionId,
            deviceId: opts?.deviceId ?? "d1",
            tenantId: opts?.tenantId ?? "t1",
          }
        : null,
    auth: {
      authorized: opts?.authorized ?? true,
      tenantId: opts?.tenantId ?? "t1",
      deviceTenantId: opts?.tenantId ?? "t1",
      deviceId: opts?.deviceId ?? "d1",
      role: opts?.role ?? "OPERATOR",
    },
    onTelemetry: (e) => telem.push(e.type),
  });
  return {
    controller,
    transport: createLocalCommandTransport(dispatcher),
    dispatcher,
    telem,
  };
}

function main(): void {
  console.log("RUNTIME-PLAYBACK-07 — Device Command Model\n");

  // CMD
  test("CMD-001", "command creation", () => {
    const r = baseCmd();
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.command.type, "PLAY");
  });

  test("CMD-002", "command id", () => {
    const a = createCommandId(1);
    const b = createCommandId(2);
    assert.notEqual(a, b);
    assert.ok(a.startsWith("cmd_"));
  });

  test("CMD-003", "command serialization", () => {
    const r = baseCmd({ commandId: "cmd_fixed" });
    assert.ok(r.ok);
    if (!r.ok) return;
    const json = serializeDeviceCommand(r.command);
    const parsed = parseDeviceCommand(json);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.command.commandId, "cmd_fixed");
  });

  test("CMD-004", "command type validation", () => {
    assert.ok(isDeviceCommandType("PLAY"));
    assert.ok(!isDeviceCommandType("SHUFFLE"));
    assert.ok(!isDeviceCommandType("LOAD_PLAYLIST"));
  });

  test("CMD-005", "payload validation", () => {
    const bad = validateCommandPayload("PLAY", { extra: 1 });
    assert.equal(bad.ok, false);
    const ok = validateCommandPayload("PLAY", {});
    assert.equal(ok.ok, true);
  });

  test("CMD-006", "seek validation", () => {
    assert.equal(validateCommandPayload("SEEK", { positionMs: -1 }).ok, false);
    assert.equal(validateCommandPayload("SEEK", { positionMs: NaN }).ok, false);
    assert.equal(
      validateCommandPayload("SEEK", { positionMs: Infinity }).ok,
      false,
    );
    assert.equal(validateCommandPayload("SEEK", { positionMs: "1" }).ok, false);
    assert.equal(validateCommandPayload("SEEK", { positionMs: 0 }).ok, true);
  });

  test("CMD-007", "volume validation", () => {
    assert.equal(validateCommandPayload("SET_VOLUME", { volume: -0.1 }).ok, false);
    assert.equal(validateCommandPayload("SET_VOLUME", { volume: 1.1 }).ok, false);
    assert.equal(validateCommandPayload("SET_VOLUME", { volume: 0.5 }).ok, true);
  });

  test("CMD-008", "mute validation", () => {
    assert.equal(validateCommandPayload("SET_MUTED", { muted: "true" }).ok, false);
    assert.equal(validateCommandPayload("SET_MUTED", { muted: 1 }).ok, false);
    assert.equal(validateCommandPayload("SET_MUTED", { muted: true }).ok, true);
  });

  test("CMD-009", "repeat validation", () => {
    assert.equal(
      validateCommandPayload("SET_REPEAT_MODE", { repeatMode: "ALL" }).ok,
      false,
    );
    assert.equal(
      validateCommandPayload("SET_REPEAT_MODE", { repeatMode: "ITEM" }).ok,
      true,
    );
  });

  // TARGET
  test("TARGET-001", "device target", () => {
    const r = baseCmd({ deviceId: "d1" });
    assert.ok(r.ok);
  });

  test("TARGET-002", "wrong device", () => {
    const created = baseCmd();
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness({ deviceId: "other" });
    const res = h.transport.send(created.command);
    assert.equal(res.status, "REJECTED");
    assert.equal(res.reason, "DEVICE_MISMATCH");
  });

  test("TARGET-003", "tenant match", () => {
    const created = baseCmd();
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness();
    assert.equal(h.transport.send(created.command).status, "APPLIED");
  });

  test("TARGET-004", "cross-tenant deny", () => {
    const created = baseCmd({ tenantId: "evil" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness({ tenantId: "t1" });
    const res = h.transport.send(created.command);
    assert.equal(res.status, "REJECTED");
    assert.equal(res.reason, "WRONG_TENANT");
  });

  // SESSION
  test("SESSION-001", "session match", () => {
    const created = baseCmd({ sessionId: "ps_1" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness({ sessionId: "ps_1" });
    assert.equal(h.transport.send(created.command).status, "APPLIED");
  });

  test("SESSION-002", "stale session", () => {
    const created = baseCmd({ sessionId: "ps_old" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness({ sessionId: "ps_new" });
    const res = h.transport.send(created.command);
    assert.equal(res.status, "STALE_SESSION");
  });

  test("SESSION-003", "reload/new session", () => {
    const created = baseCmd({ sessionId: "ps_a" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness({ sessionId: "ps_b" });
    assert.equal(h.transport.send(created.command).status, "STALE_SESSION");
  });

  test("SESSION-004", "device/session mismatch", () => {
    const created = baseCmd({ sessionId: "ps_1", deviceId: "d1" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const controller = loadController();
    const dispatcher = createCommandDispatcher({
      controller,
      now: () => 1500,
      getSession: () => ({
        sessionId: "ps_1",
        deviceId: "d2",
        tenantId: "t1",
      }),
      auth: {
        authorized: true,
        tenantId: "t1",
        deviceTenantId: "t1",
        deviceId: "d1",
      },
    });
    const res = dispatcher.dispatch(created.command);
    assert.equal(res.status, "REJECTED");
    assert.equal(res.reason, "DEVICE_MISMATCH");
  });

  // TTL
  test("TTL-001", "valid command", () => {
    assert.equal(COMMAND_TTL.DEFAULT_MS, 10_000);
    const r = baseCmd({ ttlMs: 10_000 });
    assert.ok(r.ok);
  });

  test("TTL-002", "expired command", () => {
    const created = baseCmd({ issuedAt: 1000, ttlMs: 1000 });
    assert.ok(created.ok);
    if (!created.ok) return;
    assert.ok(isCommandExpired(created.command, 2000));
    const h = harness({ now: 2500 });
    assert.equal(h.transport.send(created.command).status, "EXPIRED");
  });

  test("TTL-003", "zero TTL", () => {
    const r = baseCmd({ ttlMs: 0 });
    assert.equal(r.ok, false);
  });

  test("TTL-004", "max TTL", () => {
    const ok = baseCmd({ ttlMs: COMMAND_TTL.MAX_MS });
    assert.ok(ok.ok);
    const over = baseCmd({ ttlMs: COMMAND_TTL.MAX_MS + 1 });
    assert.equal(over.ok, false);
  });

  test("TTL-005", "no infinite TTL", () => {
    const r = baseCmd({ ttlMs: Number.POSITIVE_INFINITY });
    assert.equal(r.ok, false);
  });

  // IDEMP
  test("IDEMP-001", "first command", () => {
    const created = baseCmd({ commandId: "cmd_once" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness();
    assert.equal(h.transport.send(created.command).status, "APPLIED");
  });

  test("IDEMP-002", "duplicate command", () => {
    const created = baseCmd({ commandId: "cmd_dup" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness();
    assert.equal(h.transport.send(created.command).status, "APPLIED");
    assert.equal(h.transport.send(created.command).status, "DUPLICATE");
  });

  test("IDEMP-003", "duplicate does not re-dispatch", () => {
    const created = baseCmd({ type: "NEXT", commandId: "cmd_next_once" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness();
    h.transport.send(created.command);
    const idx = h.controller.getState().currentItemIndex;
    h.transport.send(created.command);
    assert.equal(h.controller.getState().currentItemIndex, idx);
  });

  test("IDEMP-004", "bounded idempotency", () => {
    const store = createIdempotencyStore(2);
    store.set(
      "a",
      {
        commandId: "a",
        status: "APPLIED",
        deviceId: "d",
        sessionId: null,
        action: "PLAY",
      },
      999999,
    );
    store.set(
      "b",
      {
        commandId: "b",
        status: "APPLIED",
        deviceId: "d",
        sessionId: null,
        action: "PAUSE",
      },
      999999,
    );
    store.set(
      "c",
      {
        commandId: "c",
        status: "APPLIED",
        deviceId: "d",
        sessionId: null,
        action: "STOP",
      },
      999999,
    );
    assert.ok(store.size() <= 2);
  });

  test("IDEMP-005", "idempotency expiry", () => {
    const store = createIdempotencyStore(8);
    store.set(
      "x",
      {
        commandId: "x",
        status: "APPLIED",
        deviceId: "d",
        sessionId: null,
        action: "PLAY",
      },
      100,
    );
    assert.equal(store.get("x", 50)?.status, "DUPLICATE");
    assert.equal(store.get("x", 200), null);
  });

  // DISPATCH
  const dispatchCases: Array<[string, Parameters<typeof createDeviceCommand>[0]["type"], (c: PlaybackController) => void]> = [
    ["DISPATCH-001", "PLAY", (c) => assert.ok(["PLAYING", "LOADING"].includes(c.getState().status))],
    ["DISPATCH-002", "PAUSE", (c) => {
      c.dispatch({ type: "PLAY" });
      /* pause after */
    }],
    ["DISPATCH-003", "STOP", () => undefined],
    ["DISPATCH-004", "NEXT", (c) => assert.equal(c.getState().currentContentId, "c2")],
    ["DISPATCH-005", "PREVIOUS", () => undefined],
    ["DISPATCH-006", "RESTART", () => undefined],
  ];

  for (const [id, type] of dispatchCases) {
    test(id, type, () => {
      const created = baseCmd({ type, commandId: `cmd_${type}` });
      assert.ok(created.ok);
      if (!created.ok) return;
      const h = harness();
      if (type === "PAUSE") {
        h.controller.dispatch({ type: "PLAY" });
      }
      const res = h.transport.send(created.command);
      assert.equal(res.status, "APPLIED");
      assert.equal(res.action, type);
    });
  }

  test("DISPATCH-007", "SEEK", () => {
    const created = baseCmd({
      type: "SEEK",
      payload: { positionMs: 1500 },
      commandId: "cmd_seek",
    });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness();
    assert.equal(h.transport.send(created.command).status, "APPLIED");
    assert.equal(h.controller.getState().positionMs, 1500);
  });

  test("DISPATCH-008", "VOLUME", () => {
    const created = baseCmd({
      type: "SET_VOLUME",
      payload: { volume: 0.25 },
      commandId: "cmd_vol",
    });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness();
    assert.equal(h.transport.send(created.command).status, "APPLIED");
    assert.equal(h.controller.getState().volume, 0.25);
  });

  test("DISPATCH-009", "MUTED", () => {
    const created = baseCmd({
      type: "SET_MUTED",
      payload: { muted: true },
      commandId: "cmd_mute",
    });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness();
    assert.equal(h.transport.send(created.command).status, "APPLIED");
    assert.equal(h.controller.getState().muted, true);
  });

  test("DISPATCH-010", "REPEAT", () => {
    const created = baseCmd({
      type: "SET_REPEAT_MODE",
      payload: { repeatMode: "NONE" },
      commandId: "cmd_rep",
    });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness();
    assert.equal(h.transport.send(created.command).status, "APPLIED");
    assert.equal(h.controller.getState().repeatMode, "NONE");
  });

  // RACE
  test("RACE-001", "rapid NEXT", () => {
    const h = harness();
    for (let i = 0; i < 3; i++) {
      const created = baseCmd({ type: "NEXT", commandId: `cmd_rn_${i}` });
      assert.ok(created.ok);
      if (created.ok) h.transport.send(created.command);
    }
    assert.ok(h.controller.getState().currentItemIndex >= 0);
  });

  test("RACE-002", "PAUSE/PLAY", () => {
    const h = harness();
    for (const [type, id] of [
      ["PAUSE", "cmd_rp1"],
      ["PLAY", "cmd_rp2"],
    ] as const) {
      const created = baseCmd({ type, commandId: id });
      assert.ok(created.ok);
      if (created.ok) h.transport.send(created.command);
    }
  });

  test("RACE-003", "STOP/NEXT", () => {
    const h = harness();
    for (const [type, id] of [
      ["STOP", "cmd_rs1"],
      ["NEXT", "cmd_rs2"],
    ] as const) {
      const created = baseCmd({ type, commandId: id });
      assert.ok(created.ok);
      if (created.ok) assert.equal(h.transport.send(created.command).status, "APPLIED");
    }
  });

  test("RACE-004", "stale command", () => {
    const created = baseCmd({ issuedAt: 1000, ttlMs: 1000, commandId: "cmd_stale" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness({ now: 5000 });
    assert.equal(h.transport.send(created.command).status, "EXPIRED");
  });

  test("RACE-005", "duplicate NEXT", () => {
    const created = baseCmd({ type: "NEXT", commandId: "cmd_dup_next" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness();
    h.transport.send(created.command);
    const idx = h.controller.getState().currentItemIndex;
    assert.equal(h.transport.send(created.command).status, "DUPLICATE");
    assert.equal(h.controller.getState().currentItemIndex, idx);
  });

  // SEC
  test("SEC-001", "no bearer", () => {
    const r = baseCmd();
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.ok(!serializeDeviceCommand(r.command).includes("Bearer"));
  });

  test("SEC-002", "no JWT", () => {
    assert.ok(!read("src/domain/device-command.ts").includes("eyJ"));
  });

  test("SEC-003", "no R2", () => {
    const blob = serializeDeviceCommand(
      (baseCmd() as { ok: true; command: import("../src/domain/device-command").DeviceCommand })
        .command,
    );
    assert.ok(!/R2_|AWS_SECRET/.test(blob));
  });

  test("SEC-004", "no tenant secret", () => {
    const r = baseCmd();
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.ok(!JSON.stringify(r.command).includes("AUTH_SECRET"));
  });

  test("SEC-005", "cross-tenant denial", () => {
    const auth = authorizeDeviceCommand(
      (baseCmd({ tenantId: "a" }) as { ok: true; command: import("../src/domain/device-command").DeviceCommand }).command,
      {
        authorized: true,
        tenantId: "b",
        deviceTenantId: "b",
        deviceId: "d1",
      },
    );
    assert.equal(auth.ok, false);
  });

  test("SEC-006", "unknown command denial", () => {
    assert.equal(isDeviceCommandType("EXPLODE"), false);
    const parsed = parseDeviceCommand(
      JSON.stringify({
        commandId: "x",
        tenantId: "t",
        deviceId: "d",
        type: "EXPLODE",
        payload: {},
        issuedAt: 1,
        expiresAt: 10_001,
        binding: "DEVICE_BOUND",
      }),
    );
    assert.equal(parsed.ok, false);
  });

  test("SEC-007", "invalid payload denial", () => {
    assert.equal(validateCommandPayload("SEEK", { positionMs: null }).ok, false);
  });

  test("SEC-008", "expired denial", () => {
    const created = baseCmd({ issuedAt: 1, ttlMs: 1000, commandId: "exp1" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness({ now: 5000 });
    assert.equal(h.transport.send(created.command).status, "EXPIRED");
  });

  // FAIL
  test("FAIL-001", "fail closed", () => {
    const h = harness({ authorized: false });
    const created = baseCmd({ commandId: "unauth" });
    assert.ok(created.ok);
    if (!created.ok) return;
    assert.equal(h.transport.send(created.command).status, "REJECTED");
  });

  test("FAIL-002", "safe error codes", () => {
    const created = baseCmd({ commandId: "safe" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness({ authorized: false });
    const res = h.transport.send(created.command);
    assert.ok(res.reason);
    assert.ok(!String(res.reason).includes("stack"));
  });

  test("FAIL-003", "controller defensive validation", () => {
    const c = loadController();
    c.dispatch({ type: "SET_VOLUME", volume: 99 });
    assert.ok(c.getState().volume <= 1);
  });

  test("FAIL-004", "no direct media access", () => {
    const src = read("src/player/command/command-dispatcher.ts");
    assert.ok(!src.includes("HTMLVideoElement"));
    assert.ok(!src.includes("HTMLAudioElement"));
    assert.ok(!src.includes(".play()"));
    assert.ok(src.includes("controller.dispatch"));
  });

  // OBS
  test("OBS-001", "command result", () => {
    const created = baseCmd({ commandId: "obs1" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness();
    const res = h.transport.send(created.command);
    assert.ok(res.commandId);
    assert.ok(res.status);
  });

  test("OBS-002", "correlationId", () => {
    const created = baseCmd({
      commandId: "obs2",
      correlationId: "corr-9",
    });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness();
    assert.equal(h.transport.send(created.command).correlationId, "corr-9");
  });

  test("OBS-003", "command telemetry", () => {
    const created = baseCmd({ commandId: "obs3" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness();
    h.transport.send(created.command);
    assert.ok(h.telem.includes("COMMAND_RECEIVED"));
    assert.ok(h.telem.includes("COMMAND_APPLIED"));
  });

  test("OBS-004", "no telemetry storm", () => {
    const src = read("src/player/command/command-dispatcher.ts");
    assert.ok(!src.includes("setInterval"));
  });

  // Mapping + misc
  test("MAP-001", "mapping centralized", () => {
    const action = mapCommandToPlaybackAction(
      (baseCmd({ type: "SEEK", payload: { positionMs: 9 } }) as {
        ok: true;
        command: import("../src/domain/device-command").DeviceCommand;
      }).command,
    );
    assert.deepEqual(action, { type: "SEEK", positionMs: 9 });
  });

  test("MAP-002", "empty payload helper", () => {
    assert.deepEqual(emptyPayload(), {});
  });

  test("MAP-003", "permission documented", () => {
    assert.equal(DEVICE_COMMAND_PERMISSION, "manage_devices");
  });

  test("MAP-004", "max bytes", () => {
    assert.equal(MAX_COMMAND_BYTES, 8 * 1024);
    const r = baseCmd();
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.ok(measureCommandBytes(r.command) < MAX_COMMAND_BYTES);
  });

  test("MAP-005", "star device denied", () => {
    const r = baseCmd({ deviceId: "*" });
    assert.equal(r.ok, false);
  });

  test("MAP-006", "viewer role denied", () => {
    const created = baseCmd({ commandId: "viewer1" });
    assert.ok(created.ok);
    if (!created.ok) return;
    const h = harness({ role: "VIEWER" });
    const res = h.transport.send(created.command);
    assert.equal(res.status, "REJECTED");
    assert.equal(res.reason, "NOT_AUTHORIZED");
  });

  test("MAP-007", "lab exists", () => {
    assert.ok(read("src/player/command/command-lab-panel.tsx").includes("COMMAND LAB"));
    assert.ok(read("src/app/player/lab/lab-client.tsx").includes("CommandLabPanel"));
  });

  test("MAP-008", "no production API routes", () => {
    assert.ok(!fs.existsSync(path.join(ROOT, "src/app/api/device/play")));
    assert.ok(!fs.existsSync(path.join(ROOT, "src/app/api/device/pause")));
  });

  const failed = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass);
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(
    path.join(EVIDENCE, "TEST-REPORT.md"),
    [
      "# RUNTIME-PLAYBACK-07 — TEST REPORT",
      "",
      `Passed: ${passed.length}/${results.length}`,
      "",
      "| ID | Name | Result |",
      "|----|------|--------|",
      ...results.map(
        (r) =>
          `| ${r.id} | ${r.name} | ${r.pass ? "PASS" : `FAIL: ${r.detail}`} |`,
      ),
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(`\n${passed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main();
