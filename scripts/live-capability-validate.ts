/**
 * RUNTIME-POLICY-03 — Live capability probe capture (React + Legacy)
 *
 *   BASE_URL=http://127.0.0.1:3001 npm run test:capability-live
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const EVIDENCE = path.resolve("docs/evidence/runtime-policy-03");

type Snap = {
  capabilities?: Record<string, boolean>;
  environment?: Record<string, unknown>;
  probedAt?: string;
  ok?: boolean;
  source?: string;
};

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report: Record<string, unknown> = {
    date: new Date().toISOString(),
    base: BASE,
    hisense: "NOT EXECUTED (no physical Hisense in this session)",
  };

  try {
    const reactPage = await browser.newPage();
    await reactPage.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
    await reactPage.waitForTimeout(1000);
    const reactSnap = (await reactPage.evaluate(() => {
      return (window as unknown as { __v360_runtime_capabilities?: Snap })
        .__v360_runtime_capabilities;
    })) as Snap | undefined;
    assert.ok(reactSnap?.capabilities, "React probe snapshot missing");
    assert.equal(reactSnap!.capabilities!.remote, false);
    assert.equal(typeof reactSnap!.capabilities!.fullscreen, "boolean");
    report.react = {
      viewport: reactPage.viewportSize(),
      snap: reactSnap,
    };
    await reactPage.close();

    const legacyPage = await browser.newPage();
    await legacyPage.goto(`${BASE}/tv.html?v=044`, {
      waitUntil: "domcontentloaded",
    });
    await legacyPage.waitForTimeout(800);
    const legacySnap = (await legacyPage.evaluate(() => {
      return (window as unknown as { __v360_runtime_capabilities?: Snap })
        .__v360_runtime_capabilities;
    })) as Snap | undefined;
    assert.ok(legacySnap?.capabilities, "Legacy probe snapshot missing");
    assert.equal(legacySnap!.capabilities!.remote, false);
    report.legacy = {
      viewport: legacyPage.viewportSize(),
      snap: legacySnap,
    };
    await legacyPage.close();

    report.verdict = "PASS";
    const md = `# Capability Probe E2E

**Date:** ${report.date}
**Base:** ${BASE}

## React /player
\`\`\`json
${JSON.stringify(report.react, null, 2)}
\`\`\`

## Legacy /tv.html
\`\`\`json
${JSON.stringify(report.legacy, null, 2)}
\`\`\`

## Hisense
NOT EXECUTED — physical device not online this session.

## Verdict
**IMPLEMENTATION VALIDATED** (Chromium software; Hisense separate)
`;
    fs.writeFileSync(path.join(EVIDENCE, "CAPABILITY-E2E-RESULTS.md"), md, "utf8");
    console.log("CAPABILITY LIVE VALIDATION PASS");
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    report.verdict = "FAIL";
    report.error = e instanceof Error ? e.message : String(e);
    fs.writeFileSync(
      path.join(EVIDENCE, "CAPABILITY-E2E-RESULTS.md"),
      `# Capability Probe E2E\n\nFAIL: ${report.error}\n`,
      "utf8",
    );
    throw e;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("CAPABILITY LIVE VALIDATION FAIL", e);
  process.exit(1);
});
