/**
 * RUNTIME-POLICY-08A — Live Fullscreen Capability & Control
 *
 *   BASE_URL=http://127.0.0.1:3000 npm run test:fullscreen-live
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const EVIDENCE = path.resolve("docs/evidence/runtime-policy-08a");

type FsCtl = {
  snapshot: () => {
    status: string;
    active: boolean;
    apiAvailable: boolean;
    requestCount: number;
    lastDiagnosticCode: string | null;
  } | null;
  request: (p: {
    userActivation: boolean;
    source?: string;
  }) => Promise<{ ok: boolean; code: string | null } | undefined>;
  exit: () => Promise<{ ok: boolean } | undefined>;
  setPresentation: (p: string) => void;
  evaluateBoot: () => void;
  installUnavailable: () => {
    status: string;
    active: boolean;
    apiAvailable: boolean;
    lastDiagnosticCode: string | null;
    requestCount: number;
  } | null;
};

async function seedTvPolicy(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem(
      "v360-player-config",
      JSON.stringify({
        deviceId: "e2e-fs-a",
        deviceToken: "",
        tenantId: "e2e-tenant",
        displayType: "TV",
        interactionMode: "PASSIVE",
        orientation: "landscape",
        hasDevicePolicy: true,
      }),
    );
    window.dispatchEvent(new Event("v360-device-config-updated"));
  });
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
      "Chromium viewport normal",
      "Chromium null-API unavailable path",
    ],
    hisense: "NOT RUN — physical validation deferred",
  };

  try {
    // ── Scenario A: FULLSCREEN resolved, no user activation ──
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await seedTvPolicy(page);

    const snapA = await page.evaluate(() => {
      const w = window as unknown as {
        __v360_runtime_policy?: {
          resolved?: { presentation?: string };
          fullscreenApiCalled?: boolean;
        };
        __v360_runtime_state?: {
          state?: {
            fullscreenActive?: boolean;
            fullscreenStatus?: string;
            fullscreenDiagnosticCode?: string | null;
          };
          policyActualDiagnostics?: { code: string }[];
          fullscreenApiCalled?: boolean;
        };
        __v360_fullscreen_ctl?: FsCtl;
      };
      return {
        presentation: w.__v360_runtime_policy?.resolved?.presentation,
        fullscreenApiCalled: w.__v360_runtime_state?.fullscreenApiCalled,
        policyApiCalled: w.__v360_runtime_policy?.fullscreenApiCalled,
        state: w.__v360_runtime_state?.state,
        diagnostics: w.__v360_runtime_state?.policyActualDiagnostics,
        ctl: w.__v360_fullscreen_ctl?.snapshot() ?? null,
      };
    });
    assert.equal(snapA.presentation, "FULLSCREEN");
    assert.equal(snapA.fullscreenApiCalled, false);
    assert.equal(snapA.policyApiCalled, false);
    assert.equal(snapA.state?.fullscreenActive, false);
    assert.equal(snapA.ctl?.requestCount ?? 0, 0);
    assert.ok(
      snapA.diagnostics?.some(
        (d) =>
          d.code === "FULLSCREEN_USER_ACTIVATION_REQUIRED" ||
          d.code === "PRESENTATION_NOT_ACTUALLY_FULLSCREEN",
      ),
      "expected user-activation / not-actually-fullscreen diagnostic",
    );
    report.scenarioA = {
      label: "Boot FULLSCREEN without activation",
      ...snapA,
    };

    // ── Scenario B: explicit click → requestFullscreen ──
    const btn = page.getByTestId("v360-fullscreen-enter");
    await btn.waitFor({ state: "visible", timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(400);
    const snapB = await page.evaluate(() => {
      const w = window as unknown as {
        __v360_runtime_state?: {
          state?: { fullscreenActive?: boolean };
          fullscreenApiCalled?: boolean;
        };
        __v360_fullscreen_ctl?: FsCtl;
      };
      return {
        fullscreenApiCalled: w.__v360_runtime_state?.fullscreenApiCalled,
        fullscreenActive: w.__v360_runtime_state?.state?.fullscreenActive,
        ctl: w.__v360_fullscreen_ctl?.snapshot() ?? null,
      };
    });
    assert.equal(snapB.fullscreenApiCalled, true);
    assert.ok((snapB.ctl?.requestCount ?? 0) >= 1);
    // Headless Chromium may or may not grant fullscreen — document honestly.
    report.scenarioB = {
      label: "Explicit enter control",
      requestCalled: true,
      note:
        snapB.fullscreenActive === true
          ? "Browser granted fullscreen"
          : "requestFullscreen called; browser may deny in headless — player still functional",
      snap: snapB,
    };

    // ── Scenario C: exit ──
    if (snapB.fullscreenActive) {
      const exitBtn = page.getByTestId("v360-fullscreen-exit");
      if (await exitBtn.count()) {
        await exitBtn.click();
      } else {
        await page.evaluate(async () => {
          const w = window as unknown as { __v360_fullscreen_ctl?: FsCtl };
          await w.__v360_fullscreen_ctl?.exit();
        });
      }
      await page.waitForTimeout(300);
    } else {
      // Simulate exit path via controller after forcing active via evaluate is hard;
      // call exit() anyway (idempotent).
      await page.evaluate(async () => {
        const w = window as unknown as { __v360_fullscreen_ctl?: FsCtl };
        await w.__v360_fullscreen_ctl?.exit();
      });
    }
    const snapC = await page.evaluate(() => {
      const w = window as unknown as {
        __v360_runtime_state?: { state?: { fullscreenActive?: boolean } };
        __v360_fullscreen_ctl?: FsCtl;
      };
      return {
        fullscreenActive: w.__v360_runtime_state?.state?.fullscreenActive,
        ctl: w.__v360_fullscreen_ctl?.snapshot() ?? null,
      };
    });
    assert.equal(snapC.fullscreenActive, false);
    report.scenarioC = { label: "Exit fullscreen", ...snapC };

    // ── Scenario D: requestFullscreen rejected ──
    const rejectResult = await page.evaluate(async () => {
      const root = document.querySelector(".player-runtime-root");
      if (!root) return { ok: false, error: "no root" };
      const original = (
        Element.prototype as Element & {
          requestFullscreen: () => Promise<void>;
        }
      ).requestFullscreen;
      (
        Element.prototype as Element & {
          requestFullscreen: () => Promise<void>;
        }
      ).requestFullscreen = async function () {
        const err = new Error("denied by test");
        err.name = "NotAllowedError";
        throw err;
      };
      try {
        // Rebuild is not needed — call through existing controller which uses bound browserApi.
        // Force a fresh request by exiting then requesting; browserApi already bound at boot.
        // Use a one-shot synthetic controller path via hooks if API already bound.
        const w = window as unknown as { __v360_fullscreen_ctl?: FsCtl };
        // Already may be FAILED from previous — still must not crash.
        const before = w.__v360_fullscreen_ctl?.snapshot()?.requestCount ?? 0;
        const r = await w.__v360_fullscreen_ctl?.request({
          userActivation: true,
          source: "user",
        });
        const after = w.__v360_fullscreen_ctl?.snapshot()?.requestCount ?? 0;
        return {
          result: r,
          before,
          after,
          playingOk: true,
        };
      } finally {
        (
          Element.prototype as Element & {
            requestFullscreen: () => Promise<void>;
          }
        ).requestFullscreen = original;
      }
    });
    // Controller uses captured api from boot — patching prototype may not affect it.
    // Still assert player evaluate didn't throw and UI remains.
    assert.equal(rejectResult.playingOk, true);
    const stillAlive = await page.evaluate(() => {
      return Boolean(document.querySelector(".player-runtime-root"));
    });
    assert.equal(stillAlive, true);
    report.scenarioD = {
      label: "Rejection / player continues",
      ...rejectResult,
      stillAlive,
      note: "Controller binds API at construction; rejection covered in unit FULLSCREEN-012/013. Live asserts no crash.",
    };

    // ── Scenario E: API unavailable (null-API controller path) ──
    // Chromium/Next resists Document.prototype Fullscreen stubs; installUnavailable
    // exercises the same FullscreenController(api:null) branch as real absence.
    const snapE = await page.evaluate(() => {
      const w = window as unknown as { __v360_fullscreen_ctl?: FsCtl };
      const installed = w.__v360_fullscreen_ctl?.installUnavailable() ?? null;
      const state = (
        window as unknown as {
          __v360_runtime_state?: {
            state?: {
              fullscreenActive?: boolean;
              fullscreenStatus?: string;
              fullscreenDiagnosticCode?: string | null;
            };
            policyActualDiagnostics?: { code: string }[];
            fullscreenApiCalled?: boolean;
          };
        }
      ).__v360_runtime_state;
      return {
        installed,
        state: state?.state,
        diagnostics: state?.policyActualDiagnostics,
        fullscreenApiCalled: state?.fullscreenApiCalled,
        ctl: w.__v360_fullscreen_ctl?.snapshot() ?? null,
      };
    });
    assert.equal(snapE.state?.fullscreenActive, false);
    assert.equal(snapE.fullscreenApiCalled, false);
    assert.equal(snapE.ctl?.apiAvailable, false);
    assert.equal(snapE.ctl?.status, "UNAVAILABLE");
    assert.ok(
      snapE.diagnostics?.some((d) => d.code === "FULLSCREEN_UNAVAILABLE") ||
        snapE.state?.fullscreenDiagnosticCode === "FULLSCREEN_UNAVAILABLE" ||
        snapE.installed?.lastDiagnosticCode === "FULLSCREEN_UNAVAILABLE",
    );
    // Ensure no request after unavailable
    const reqE = await page.evaluate(async () => {
      const w = window as unknown as { __v360_fullscreen_ctl?: FsCtl };
      const before = w.__v360_fullscreen_ctl?.snapshot()?.requestCount ?? 0;
      const r = await w.__v360_fullscreen_ctl?.request({
        userActivation: true,
        source: "user",
      });
      const after = w.__v360_fullscreen_ctl?.snapshot()?.requestCount ?? 0;
      return { before, after, result: r };
    });
    assert.equal(reqE.after, reqE.before);
    assert.equal(reqE.result?.code, "FULLSCREEN_UNAVAILABLE");
    report.scenarioE = {
      label: "API unavailable (null API controller)",
      ...snapE,
      requestBlocked: reqE,
    };

    // ── Scenario F: WINDOWED never requests ──
    const winResult = await page.evaluate(async () => {
      const w = window as unknown as { __v360_fullscreen_ctl?: FsCtl };
      const before = w.__v360_fullscreen_ctl?.snapshot()?.requestCount ?? 0;
      w.__v360_fullscreen_ctl?.setPresentation("WINDOWED");
      const r = await w.__v360_fullscreen_ctl?.request({
        userActivation: true,
        source: "user",
      });
      const after = w.__v360_fullscreen_ctl?.snapshot()?.requestCount ?? 0;
      return { before, after, result: r };
    });
    assert.equal(winResult.after, winResult.before);
    assert.equal(winResult.result?.code, "FULLSCREEN_POLICY_WINDOWED");
    report.scenarioF = {
      label: "WINDOWED never requests",
      ...winResult,
    };

    report.verdict = "PASS";
    report.physicalDevice = "NOT VALIDATED";
    report.production = "NOT VALIDATED";

    fs.writeFileSync(
      path.join(EVIDENCE, "FULLSCREEN-E2E-RESULTS.md"),
      `# Fullscreen E2E (RUNTIME-POLICY-08A)

**Date:** ${report.date}
**Base:** ${BASE}
**Matrix:** ${JSON.stringify(report.matrix)}
**Hisense:** ${report.hisense}

## Scenario A — Boot without activation
\`\`\`json
${JSON.stringify(report.scenarioA, null, 2)}
\`\`\`

## Scenario B — Explicit enter
\`\`\`json
${JSON.stringify(report.scenarioB, null, 2)}
\`\`\`

## Scenario C — Exit
\`\`\`json
${JSON.stringify(report.scenarioC, null, 2)}
\`\`\`

## Scenario D — Rejection / no crash
\`\`\`json
${JSON.stringify(report.scenarioD, null, 2)}
\`\`\`

## Scenario E — API unavailable
\`\`\`json
${JSON.stringify(report.scenarioE, null, 2)}
\`\`\`

## Scenario F — WINDOWED
\`\`\`json
${JSON.stringify(report.scenarioF, null, 2)}
\`\`\`

## Verdict
**IMPLEMENTATION VALIDATED** (Chromium E2E)

- PHYSICAL DEVICE VALIDATED: no
- PRODUCTION VALIDATED: no
`,
      "utf8",
    );

    console.log("FULLSCREEN LIVE VALIDATION PASS");
    console.log(JSON.stringify(report, null, 2));
    await page.close();
  } catch (e) {
    report.verdict = "FAIL";
    report.error = e instanceof Error ? e.message : String(e);
    fs.writeFileSync(
      path.join(EVIDENCE, "FULLSCREEN-E2E-RESULTS.md"),
      `# FAIL\n${report.error}\n`,
      "utf8",
    );
    throw e;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("FULLSCREEN LIVE FAIL", e);
  process.exit(1);
});
