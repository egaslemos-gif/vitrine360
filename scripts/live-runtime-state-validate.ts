/**
 * RUNTIME-POLICY-06 — Live Runtime State validation
 *
 *   BASE_URL=http://127.0.0.1:3004 npm run test:runtime-state-live
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { diagnosePolicyVsActual } from "../src/domain/runtime-policy";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const EVIDENCE = path.resolve("docs/evidence/runtime-policy-06");

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report: Record<string, unknown> = {
    date: new Date().toISOString(),
    base: BASE,
  };

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);

    // Inject DEVICE_CONFIG + refresh policy/state
    await page.evaluate(() => {
      localStorage.setItem(
        "v360-player-config",
        JSON.stringify({
          deviceId: "e2e-rs-a",
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
    await page.waitForTimeout(400);

    // Scenario A — policy + state globals present
    const snapA = await page.evaluate(() => {
      const w = window as unknown as {
        __v360_runtime_policy?: Record<string, unknown>;
        __v360_runtime_state?: Record<string, unknown>;
      };
      return {
        policy: w.__v360_runtime_policy,
        state: w.__v360_runtime_state,
      };
    });
    assert.ok(snapA.policy, "policy missing");
    assert.ok(snapA.state, "runtime state missing");
    assert.equal(snapA.policy.policySource, "DEVICE_CONFIG");
    assert.equal(snapA.policy.fullscreenApiCalled, false);
    assert.equal(snapA.state.fullscreenApiCalled, false);
    assert.equal(snapA.state.orientationLockCalled, false);
    const stateA = snapA.state.state as {
      networkState: string;
      orientationActual: string;
      fullscreenActive: boolean;
    };
    assert.ok(["ONLINE", "OFFLINE", "UNKNOWN"].includes(stateA.networkState));
    assert.equal(stateA.orientationActual, "LANDSCAPE");
    assert.equal(stateA.fullscreenActive, false);
    report.scenarioA = { label: "TV+PASSIVE+LANDSCAPE state", snap: snapA };

    // Scenario B — offline
    await page.context().setOffline(true);
    await page.waitForTimeout(200);
    const netB = await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
      return (
        window as unknown as {
          __v360_runtime_state?: { state?: { networkState?: string } };
        }
      ).__v360_runtime_state?.state?.networkState;
    });
    assert.equal(netB, "OFFLINE");
    report.scenarioB = { label: "network offline", networkState: netB };
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Scenario C — input
    await page.mouse.move(40, 40);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    const inputC = await page.evaluate(() => {
      const s = (
        window as unknown as {
          __v360_runtime_state?: {
            state?: { lastInputClass?: string; lastInputAt?: number };
          };
        }
      ).__v360_runtime_state?.state;
      return s;
    });
    assert.ok(inputC?.lastInputAt);
    assert.ok(
      inputC?.lastInputClass === "MOUSE" ||
        inputC?.lastInputClass === "KEYBOARD_LIKE",
    );
    report.scenarioC = { label: "input", input: inputC };

    // Scenario D — orientation via viewport
    await page.setViewportSize({ width: 480, height: 900 });
    await page.waitForTimeout(200);
    const orientD = await page.evaluate(() => {
      window.dispatchEvent(new Event("resize"));
      return (
        window as unknown as {
          __v360_runtime_state?: { state?: { orientationActual?: string } };
        }
      ).__v360_runtime_state?.state?.orientationActual;
    });
    assert.equal(orientD, "PORTRAIT");
    report.scenarioD = { label: "orientation portrait", orientationActual: orientD };

    // Scenario E — fullscreen observational only
    const fsE = await page.evaluate(() => {
      const s = (
        window as unknown as {
          __v360_runtime_state?: {
            fullscreenApiCalled?: boolean;
            state?: { fullscreenActive?: boolean };
          };
        }
      ).__v360_runtime_state;
      return {
        fullscreenApiCalled: s?.fullscreenApiCalled,
        fullscreenActive: s?.state?.fullscreenActive,
      };
    });
    assert.equal(fsE.fullscreenApiCalled, false);
    assert.equal(fsE.fullscreenActive, false);
    report.scenarioE = { label: "fullscreen observational", ...fsE };

    // Scenario F — mismatch diagnostic (domain, no crash)
    const mismatch = diagnosePolicyVsActual({
      resolvedPresentation: "FULLSCREEN",
      resolvedOrientation: "LANDSCAPE",
      fullscreenActive: false,
      orientationActual: "PORTRAIT",
    });
    assert.ok(mismatch.some((d) => d.code === "ORIENTATION_MISMATCH"));
    assert.ok(
      mismatch.some((d) => d.code === "PRESENTATION_NOT_ACTUALLY_FULLSCREEN"),
    );
    report.scenarioF = { label: "mismatch", diagnostics: mismatch };

    // Playback fields may be empty without paired playlist — document honestly
    const play = (snapA.state.state as { isPlaying?: boolean }).isPlaying;
    report.playbackNote =
      "Unpaired E2E may have isPlaying=false without manifest; store + globals still required.";

    report.verdict = "PASS";
    fs.writeFileSync(
      path.join(EVIDENCE, "RUNTIME-STATE-E2E-RESULTS.md"),
      `# Runtime State E2E

**Date:** ${report.date}
**Base:** ${BASE}

## Scenario A
\`\`\`json
${JSON.stringify(report.scenarioA, null, 2)}
\`\`\`

## Scenario B — Offline
\`\`\`json
${JSON.stringify(report.scenarioB, null, 2)}
\`\`\`

## Scenario C — Input
\`\`\`json
${JSON.stringify(report.scenarioC, null, 2)}
\`\`\`

## Scenario D — Orientation
\`\`\`json
${JSON.stringify(report.scenarioD, null, 2)}
\`\`\`

## Scenario E — Fullscreen observational
\`\`\`json
${JSON.stringify(report.scenarioE, null, 2)}
\`\`\`

## Scenario F — Mismatch
\`\`\`json
${JSON.stringify(report.scenarioF, null, 2)}
\`\`\`

## Notes
- isPlaying at first snapshot: ${play}
- ${report.playbackNote}

## Verdict
**IMPLEMENTATION VALIDATED**
`,
      "utf8",
    );

    console.log("RUNTIME STATE LIVE VALIDATION PASS");
    console.log(JSON.stringify(report, null, 2));
    await page.close();
  } catch (e) {
    report.verdict = "FAIL";
    report.error = e instanceof Error ? e.message : String(e);
    fs.writeFileSync(
      path.join(EVIDENCE, "RUNTIME-STATE-E2E-RESULTS.md"),
      `# FAIL\n${report.error}\n`,
      "utf8",
    );
    throw e;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("RUNTIME STATE LIVE FAIL", e);
  process.exit(1);
});
