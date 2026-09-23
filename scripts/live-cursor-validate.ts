/**
 * RUNTIME-POLICY-02 — Playwright cursor E2E for React /player and Legacy /tv.html
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000 npx tsx scripts/live-cursor-validate.ts
 *   npm run test:cursor-live
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const EVIDENCE = path.resolve("docs/evidence/runtime-policy-02");
const IDLE_MS = 3200;

async function readHtmlCursor(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.documentElement).cursor);
}

async function waitCursor(page: Page, expected: string, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    last = await readHtmlCursor(page);
    // Browsers may report "auto" or "" equivalent — accept both as visible
    if (expected === "none" && (last === "none" || last === "")) {
      // empty is not none — require none
    }
    if (expected === "none" && last === "none") return last;
    if (expected === "auto" && (last === "auto" || last === "default")) return last;
    await page.waitForTimeout(100);
  }
  throw new Error(`cursor expected ${expected}, got ${JSON.stringify(last)}`);
}

async function exerciseCursor(page: Page, label: string) {
  await page.waitForTimeout(400);
  // Initial: hidden
  let cursor = await waitCursor(page, "none");
  console.log(label, "initial", cursor);

  // Mouse move → visible
  await page.mouse.move(120, 140);
  cursor = await waitCursor(page, "auto");
  console.log(label, "after move", cursor);

  // Idle → hidden
  await page.waitForTimeout(IDLE_MS);
  cursor = await waitCursor(page, "none");
  console.log(label, "after idle", cursor);

  // Move again → visible
  await page.mouse.move(200, 180);
  cursor = await waitCursor(page, "auto");

  // Key resets timer
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1500);
  cursor = await readHtmlCursor(page);
  assert.ok(
    cursor === "auto" || cursor === "default",
    `${label} key should keep cursor visible mid-idle, got ${cursor}`,
  );
  await page.waitForTimeout(IDLE_MS);
  cursor = await waitCursor(page, "none");
  console.log(label, "after key+idle", cursor);

  return { label, ok: true };
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results: Record<string, unknown> = {
    date: new Date().toISOString(),
    base: BASE,
    target: "document.documentElement",
  };

  try {
    // React /player
    const reactPage = await browser.newPage();
    await reactPage.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
    // Wait for shell effect
    await reactPage.waitForTimeout(800);
    results.react = await exerciseCursor(reactPage, "react");
    await reactPage.close();

    // Legacy /tv.html
    const legacyPage = await browser.newPage();
    await legacyPage.goto(`${BASE}/tv.html?v=043`, {
      waitUntil: "domcontentloaded",
    });
    await legacyPage.waitForTimeout(800);
    results.legacy = await exerciseCursor(legacyPage, "legacy");
    await legacyPage.close();

    results.verdict = "PASS";
    fs.writeFileSync(
      path.join(EVIDENCE, "CURSOR-E2E-RESULTS.md"),
      `# Cursor E2E Results

**Date:** ${results.date}
**Base:** ${BASE}
**Canonical target:** document.documentElement

## React /player
PASS — initial none → move auto → idle none → key reset → idle none

## Legacy /tv.html
PASS — equivalent contract

## Verdict
**IMPLEMENTATION VALIDATED** (software E2E; Hisense physical not required)
`,
      "utf8",
    );

    console.log("\nCURSOR LIVE VALIDATION PASS");
    console.log(JSON.stringify(results, null, 2));
  } catch (e) {
    results.verdict = "FAIL";
    results.error = e instanceof Error ? e.message : String(e);
    fs.writeFileSync(
      path.join(EVIDENCE, "CURSOR-E2E-RESULTS.md"),
      `# Cursor E2E Results\n\n**FAIL** ${results.error}\n`,
      "utf8",
    );
    throw e;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("CURSOR LIVE VALIDATION FAIL", e);
  process.exit(1);
});
