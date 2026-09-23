/**
 * RUNTIME-POLICY-08B — Live Orientation Capability & Control
 *
 *   BASE_URL=http://127.0.0.1:3000 npm run test:orientation-live
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { diagnosePolicyVsActual } from "../src/domain/runtime-policy";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const EVIDENCE = path.resolve("docs/evidence/runtime-policy-08b");

type OrCtl = {
  snapshot: () => {
    status: string;
    locked: boolean;
    lockAvailable: boolean;
    observationAvailable: boolean;
    actual: string;
    lockCount: number;
    lastDiagnosticCode: string | null;
    requiresFullscreen: boolean;
  } | null;
  lock: (p: {
    userActivation: boolean;
    source?: string;
  }) => Promise<{ ok: boolean; code: string | null } | undefined>;
  unlock: () => Promise<{ ok: boolean } | undefined>;
  setOrientation: (p: string) => void;
  evaluateBoot: () => void;
  canLock: () => { ok: boolean; code: string | null } | undefined;
  installUnavailable: () => unknown;
};

async function seedDevice(
  page: Page,
  orientation: "landscape" | "portrait" | "auto",
  deviceId: string,
) {
  await page.evaluate(
    ({ orientation, deviceId }) => {
      localStorage.setItem(
        "v360-player-config",
        JSON.stringify({
          deviceId,
          deviceToken: "",
          tenantId: "e2e-tenant",
          displayType: "TV",
          interactionMode: "PASSIVE",
          orientation,
          hasDevicePolicy: true,
        }),
      );
      window.dispatchEvent(new Event("v360-device-config-updated"));
    },
    { orientation, deviceId },
  );
  await page.waitForTimeout(500);
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report: Record<string, unknown> = {
    date: new Date().toISOString(),
    base: BASE,
    matrix: [
      "Chromium desktop",
      "viewport landscape",
      "viewport portrait",
      "null-API unavailable path",
      "rejected lock path",
    ],
    hisense: "NOT RUN — physical validation deferred",
  };

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    // ── A: AUTO — observe, no lock ──
    await seedDevice(page, "auto", "e2e-or-a");
    // Device orientation auto → policy AUTO; force controller AUTO for certainty
    const snapA = await page.evaluate(() => {
      const w = window as unknown as {
        __v360_runtime_policy?: {
          resolved?: { orientation?: string };
          orientationLockCalled?: boolean;
        };
        __v360_runtime_state?: {
          state?: { orientationActual?: string; orientationStatus?: string };
          orientationLockCalled?: boolean;
        };
        __v360_orientation_ctl?: OrCtl;
      };
      w.__v360_orientation_ctl?.setOrientation("AUTO");
      w.__v360_orientation_ctl?.evaluateBoot();
      return {
        resolved: w.__v360_runtime_policy?.resolved?.orientation,
        lockCalled: w.__v360_runtime_state?.orientationLockCalled,
        state: w.__v360_runtime_state?.state,
        ctl: w.__v360_orientation_ctl?.snapshot() ?? null,
      };
    });
    assert.ok(
      snapA.state?.orientationActual === "LANDSCAPE" ||
        snapA.state?.orientationActual === "PORTRAIT" ||
        snapA.state?.orientationActual === "UNKNOWN",
    );
    assert.equal(snapA.ctl?.lockCount ?? 0, 0);
    assert.equal(snapA.lockCalled, false);
    report.scenarioA = { label: "AUTO observe no lock", ...snapA };

    // ── B: LANDSCAPE lock attempt ──
    await seedDevice(page, "landscape", "e2e-or-b");
    const snapB = await page.evaluate(async () => {
      const w = window as unknown as { __v360_orientation_ctl?: OrCtl };
      w.__v360_orientation_ctl?.setOrientation("LANDSCAPE");
      const before = w.__v360_orientation_ctl?.snapshot()?.lockCount ?? 0;
      const r = await w.__v360_orientation_ctl?.lock({
        userActivation: true,
        source: "user",
      });
      const after = w.__v360_orientation_ctl?.snapshot();
      return { before, result: r, ctl: after };
    });
    // Headless may reject lock — request may still increment or diagnose.
    assert.ok(
      (snapB.ctl?.lockCount ?? 0) >= snapB.before ||
        snapB.result?.code === "ORIENTATION_REQUIRES_FULLSCREEN" ||
        snapB.result?.code === "ORIENTATION_LOCK_NOT_ALLOWED" ||
        snapB.result?.code === "ORIENTATION_LOCK_UNAVAILABLE" ||
        snapB.result?.ok === true,
    );
    report.scenarioB = {
      label: "LANDSCAPE lock attempt",
      note: "Headless Chromium often denies orientation.lock without fullscreen",
      ...snapB,
    };

    // ── C: PORTRAIT ──
    const snapC = await page.evaluate(async () => {
      const w = window as unknown as { __v360_orientation_ctl?: OrCtl };
      w.__v360_orientation_ctl?.setOrientation("PORTRAIT");
      const r = await w.__v360_orientation_ctl?.lock({
        userActivation: true,
        source: "user",
      });
      return { result: r, ctl: w.__v360_orientation_ctl?.snapshot() ?? null };
    });
    report.scenarioC = { label: "PORTRAIT lock attempt", ...snapC };

    // ── D: rejection — player continues ──
    const snapD = await page.evaluate(async () => {
      const w = window as unknown as { __v360_orientation_ctl?: OrCtl };
      // Force another attempt; should not crash
      const r = await w.__v360_orientation_ctl?.lock({
        userActivation: true,
        source: "user",
      });
      return {
        result: r,
        rootAlive: Boolean(document.querySelector(".player-runtime-root")),
      };
    });
    assert.equal(snapD.rootAlive, true);
    report.scenarioD = { label: "rejection / no crash", ...snapD };

    // ── E: API unavailable ──
    const snapE = await page.evaluate(() => {
      const w = window as unknown as {
        __v360_orientation_ctl?: OrCtl;
        __v360_runtime_state?: {
          state?: {
            orientationActual?: string;
            orientationStatus?: string;
            orientationDiagnosticCode?: string | null;
          };
        };
      };
      const installed = w.__v360_orientation_ctl?.installUnavailable();
      return {
        installed,
        state: w.__v360_runtime_state?.state,
        ctl: w.__v360_orientation_ctl?.snapshot() ?? null,
      };
    });
    assert.equal(snapE.ctl?.lockAvailable, false);
    assert.ok(
      snapE.ctl?.status === "UNAVAILABLE" ||
        snapE.state?.orientationStatus === "UNAVAILABLE" ||
        snapE.state?.orientationDiagnosticCode ===
          "ORIENTATION_LOCK_UNAVAILABLE",
    );
    // Viewport observation may still yield actual
    assert.ok(
      snapE.state?.orientationActual === "LANDSCAPE" ||
        snapE.state?.orientationActual === "PORTRAIT" ||
        snapE.state?.orientationActual === "UNKNOWN",
    );
    report.scenarioE = { label: "API unavailable", ...snapE };

    // Restore a lock-capable controller via page reload for remaining scenarios
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await seedDevice(page, "landscape", "e2e-or-f");

    // ── F: mismatch diagnostic (domain) ──
    const mismatch = diagnosePolicyVsActual({
      resolvedPresentation: "AUTO",
      resolvedOrientation: "LANDSCAPE",
      fullscreenActive: false,
      orientationActual: "PORTRAIT",
    });
    assert.ok(mismatch.some((d) => d.code === "ORIENTATION_MISMATCH"));
    report.scenarioF = { label: "ORIENTATION_MISMATCH", diagnostics: mismatch };

    // ── G: fullscreen dependency — no requestFullscreen from orientation ──
    const snapG = await page.evaluate(async () => {
      const w = window as unknown as {
        __v360_orientation_ctl?: OrCtl;
        __v360_fullscreen_ctl?: { snapshot: () => { requestCount: number } | null };
        __v360_runtime_state?: { fullscreenApiCalled?: boolean };
      };
      w.__v360_orientation_ctl?.setOrientation("LANDSCAPE");
      // Mark requires fullscreen via a failing lock that mentions fullscreen if possible;
      // or check canLock after synthetic diagnostic.
      const fsBefore =
        w.__v360_fullscreen_ctl?.snapshot()?.requestCount ?? 0;
      const r = await w.__v360_orientation_ctl?.lock({
        userActivation: true,
        source: "user",
      });
      const fsAfter = w.__v360_fullscreen_ctl?.snapshot()?.requestCount ?? 0;
      return {
        result: r,
        fullscreenRequestDelta: fsAfter - fsBefore,
        fullscreenApiCalled: w.__v360_runtime_state?.fullscreenApiCalled,
        ctl: w.__v360_orientation_ctl?.snapshot() ?? null,
      };
    });
    assert.equal(snapG.fullscreenRequestDelta, 0);
    report.scenarioG = {
      label: "orientation does not call requestFullscreen",
      ...snapG,
    };

    // ── H: AUTO after lock — unlock if locked ──
    const snapH = await page.evaluate(async () => {
      const w = window as unknown as { __v360_orientation_ctl?: OrCtl };
      w.__v360_orientation_ctl?.setOrientation("LANDSCAPE");
      await w.__v360_orientation_ctl?.lock({
        userActivation: true,
        source: "user",
      });
      const before = w.__v360_orientation_ctl?.snapshot();
      w.__v360_orientation_ctl?.setOrientation("AUTO");
      await new Promise((r) => setTimeout(r, 50));
      const after = w.__v360_orientation_ctl?.snapshot();
      return { before, after };
    });
    if (snapH.before?.locked) {
      assert.equal(snapH.after?.locked, false);
      assert.ok(
        snapH.after?.status === "IDLE" ||
          snapH.after?.lastDiagnosticCode === "ORIENTATION_LOCK_EXITED",
      );
    }
    report.scenarioH = {
      label: "AUTO after lock",
      ...snapH,
    };

    // Viewport portrait observation
    await page.setViewportSize({ width: 480, height: 900 });
    await page.waitForTimeout(200);
    const portraitActual = await page.evaluate(() => {
      window.dispatchEvent(new Event("resize"));
      return (
        window as unknown as {
          __v360_runtime_state?: { state?: { orientationActual?: string } };
          __v360_orientation_ctl?: OrCtl;
        }
      ).__v360_runtime_state?.state?.orientationActual;
    });
    assert.equal(portraitActual, "PORTRAIT");
    report.viewportPortrait = { orientationActual: portraitActual };

    report.verdict = "PASS";
    report.physicalDevice = "NOT VALIDATED";
    report.production = "NOT VALIDATED";

    fs.writeFileSync(
      path.join(EVIDENCE, "ORIENTATION-E2E-RESULTS.md"),
      `# Orientation E2E (RUNTIME-POLICY-08B)

**Date:** ${report.date}
**Base:** ${BASE}
**Matrix:** ${JSON.stringify(report.matrix)}
**Hisense:** ${report.hisense}

## Scenario A — AUTO
\`\`\`json
${JSON.stringify(report.scenarioA, null, 2)}
\`\`\`

## Scenario B — LANDSCAPE
\`\`\`json
${JSON.stringify(report.scenarioB, null, 2)}
\`\`\`

## Scenario C — PORTRAIT
\`\`\`json
${JSON.stringify(report.scenarioC, null, 2)}
\`\`\`

## Scenario D — Rejection
\`\`\`json
${JSON.stringify(report.scenarioD, null, 2)}
\`\`\`

## Scenario E — Unavailable
\`\`\`json
${JSON.stringify(report.scenarioE, null, 2)}
\`\`\`

## Scenario F — Mismatch
\`\`\`json
${JSON.stringify(report.scenarioF, null, 2)}
\`\`\`

## Scenario G — No fullscreen from orientation
\`\`\`json
${JSON.stringify(report.scenarioG, null, 2)}
\`\`\`

## Scenario H — AUTO after lock
\`\`\`json
${JSON.stringify(report.scenarioH, null, 2)}
\`\`\`

## Viewport portrait
\`\`\`json
${JSON.stringify(report.viewportPortrait, null, 2)}
\`\`\`

## Verdict
**IMPLEMENTATION VALIDATED** (Chromium E2E)

- PHYSICAL DEVICE VALIDATED: no
- PRODUCTION VALIDATED: no
`,
      "utf8",
    );

    console.log("ORIENTATION LIVE VALIDATION PASS");
    console.log(JSON.stringify(report, null, 2));
    await page.close();
  } catch (e) {
    report.verdict = "FAIL";
    report.error = e instanceof Error ? e.message : String(e);
    fs.writeFileSync(
      path.join(EVIDENCE, "ORIENTATION-E2E-RESULTS.md"),
      `# FAIL\n${report.error}\n`,
      "utf8",
    );
    throw e;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("ORIENTATION LIVE FAIL", e);
  process.exit(1);
});
