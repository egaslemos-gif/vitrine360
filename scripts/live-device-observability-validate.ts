/**
 * RUNTIME-POLICY-07 — Device Observability live checks
 *
 *   BASE_URL=http://127.0.0.1:3006 npm run test:device-observability-live
 *
 * Covers domain scenarios + admin API contract (auth required for UI).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { deriveDeviceRuntimeObservability } from "../src/domain/device-observability";
import { assertTenantDeviceScope } from "../src/domain/runtime-policy";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const EVIDENCE = path.resolve("docs/evidence/runtime-policy-07");

function playingPayload(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    state: "PLAYING",
    contentId: "c1",
    observedAt: new Date().toISOString(),
    runtimeState: {
      isPlaying: true,
      currentContentId: "c1",
      currentManifestVersion: 2,
      syncState: "READY",
      networkState: "ONLINE",
      fullscreenActive: false,
      orientationActual: "LANDSCAPE",
      cursorVisible: false,
    },
    policy: {
      policySource: "DEVICE_CONFIG",
      requested: { presentation: "AUTO", orientation: "LANDSCAPE" },
      resolved: { presentation: "FULLSCREEN", orientation: "LANDSCAPE" },
    },
    ...extra,
  });
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const report: Record<string, unknown> = {
    date: new Date().toISOString(),
    base: BASE,
  };

  // Scenario A — ONLINE + PLAYING
  const a = deriveDeviceRuntimeObservability({
    presence: "ONLINE",
    lastSeenAt: new Date().toISOString(),
    playerStateRaw: playingPayload(),
  });
  assert.equal(a.presence.status, "ONLINE");
  assert.equal(a.runtime.isPlaying, true);
  assert.equal(a.runtime.syncState, "READY");
  assert.equal(a.runtime.isLastReported, false);
  report.scenarioA = { presence: a.presence.status, playing: a.runtime.isPlaying, sync: a.runtime.syncState };

  // Scenario B — ONLINE + IDLE
  const b = deriveDeviceRuntimeObservability({
    presence: "ONLINE",
    lastSeenAt: new Date().toISOString(),
    playerStateRaw: JSON.stringify({
      state: "IDLE",
      observedAt: new Date().toISOString(),
      runtimeState: { isPlaying: false, syncState: "READY", networkState: "ONLINE" },
    }),
  });
  assert.equal(b.presence.status, "ONLINE");
  assert.equal(b.runtime.isPlaying, false);
  report.scenarioB = { presence: b.presence.status, playing: b.runtime.isPlaying };

  // Scenario C — OFFLINE after PLAYING
  const c = deriveDeviceRuntimeObservability({
    presence: "OFFLINE",
    lastSeenAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    playerStateRaw: playingPayload({
      observedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    }),
  });
  assert.equal(c.presence.status, "OFFLINE");
  assert.equal(c.runtime.isPlaying, true);
  assert.equal(c.runtime.isLastReported, true);
  report.scenarioC = {
    presence: c.presence.status,
    lastReportedPlaying: c.runtime.isPlaying,
    isLastReported: c.runtime.isLastReported,
  };

  // Scenario D — fullscreen mismatch INFO
  assert.ok(
    a.diagnostics.some(
      (d) =>
        d.code === "PRESENTATION_NOT_ACTUALLY_FULLSCREEN" &&
        d.severity === "INFO",
    ),
  );
  report.scenarioD = {
    code: "PRESENTATION_NOT_ACTUALLY_FULLSCREEN",
    severity: "INFO",
  };

  // Scenario E — orientation WARNING
  const e = deriveDeviceRuntimeObservability({
    presence: "ONLINE",
    lastSeenAt: new Date().toISOString(),
    playerStateRaw: playingPayload({
      runtimeState: {
        isPlaying: true,
        fullscreenActive: false,
        orientationActual: "PORTRAIT",
        syncState: "READY",
      },
      policy: {
        policySource: "DEVICE_CONFIG",
        requested: { orientation: "LANDSCAPE", presentation: "AUTO" },
        resolved: { orientation: "LANDSCAPE", presentation: "FULLSCREEN" },
      },
    }),
  });
  assert.ok(
    e.diagnostics.some(
      (d) => d.code === "ORIENTATION_MISMATCH" && d.severity === "WARNING",
    ),
  );
  report.scenarioE = { code: "ORIENTATION_MISMATCH", severity: "WARNING" };

  // Scenario F — tenant isolation
  assert.throws(() =>
    assertTenantDeviceScope("tenant-a", "tenant-b", "dev-a", "dev-a"),
  );
  report.scenarioF = { tenantIsolation: "DENY cross-tenant" };

  // Scenario G — Chromium admin routes load (login gate OK)
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    const resList = await page.goto(`${BASE}/admin/devices`, {
      waitUntil: "domcontentloaded",
    });
    assert.ok(resList);
    const url = page.url();
    // Either devices page or redirected to login — both acceptable without session
    assert.ok(
      url.includes("/admin/devices") || url.includes("/admin/login"),
      `unexpected url ${url}`,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewWidth = await page.evaluate(() => window.innerWidth);
    report.scenarioG = {
      url,
      mobileBodyWidth: bodyWidth,
      viewWidth,
      noExtremeHorizontalBleed: bodyWidth < viewWidth + 80,
    };

    // Presence API without auth should fail (not leak)
    const api = await page.request.get(`${BASE}/api/admin/devices/presence`);
    assert.ok(api.status() === 401 || api.status() === 403 || api.status() === 302);
    report.scenarioG = {
      ...((report.scenarioG as object) ?? {}),
      presenceUnauthorized: api.status(),
    };
    await page.close();
  } finally {
    await browser.close();
  }

  report.verdict = "PASS";
  fs.writeFileSync(
    path.join(EVIDENCE, "DEVICE-OBSERVABILITY-E2E-RESULTS.md"),
    `# Device Observability E2E

**Date:** ${report.date}
**Base:** ${BASE}

\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`

## Verdict
**IMPLEMENTATION VALIDATED**
`,
    "utf8",
  );
  console.log("DEVICE OBSERVABILITY LIVE PASS");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("DEVICE OBSERVABILITY LIVE FAIL", err);
  process.exit(1);
});
