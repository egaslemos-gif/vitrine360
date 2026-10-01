/**
 * AUTHZ-DEVICE-02B — live API + browser validation (Playwright).
 *
 * Prereqs (throwaway DB!):
 *   DATABASE_URL=file:./data/authz02-e2e.db npx drizzle-kit push --force
 *   DATABASE_URL=file:./data/authz02-e2e.db npx tsx scripts/authz02-e2e-seed.ts
 *   DATABASE_URL=file:./data/authz02-e2e.db ENTITLEMENTS_ENABLED=true npx next start -p 3120
 *   DATABASE_URL=file:./data/authz02-e2e.db BASE_URL=http://localhost:3120 npx tsx scripts/authz02-e2e-browser.ts
 */
import { chromium, type Page, type BrowserContext } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3120";
const OUT = "docs/evidence/authz-device-02";
const seed = JSON.parse(fs.readFileSync("data/authz02-e2e-seed.json", "utf8")) as {
  password: string;
  tenants: Record<string, { slug: string; users: Record<string, string> }>;
  codes: string[];
};
const codes = [...seed.codes];
const nextCode = () => {
  const c = codes.shift();
  if (!c) throw new Error("out of activation codes");
  return c;
};

type Row = { id: string; ok: boolean; detail: string };
const rows: Row[] = [];
function check(id: string, ok: boolean, detail = "") {
  rows.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` — ${detail}` : ""}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TECH_CODES = /\b(PERMISSION_DENIED|ENTITLEMENT_DENIED|QUOTA_EXCEEDED|ACTIVATION_CODE_INVALID|DEVICE_ALREADY_REGISTERED|AUTHENTICATION_REQUIRED|VALIDATION_ERROR|INTERNAL_ERROR|TENANT_SUSPENDED)\b/;

// login rate limit: 20 / 60s per IP
let loginTimes: number[] = [];
async function throttleLogin() {
  const now = Date.now();
  loginTimes = loginTimes.filter((t) => now - t < 61_000);
  if (loginTimes.length >= 18) {
    const wait = 61_000 - (now - loginTimes[0]!) + 500;
    console.log(`  (login rate-limit pause ${Math.ceil(wait / 1000)}s)`);
    await sleep(wait);
    loginTimes = [];
  }
  loginTimes.push(Date.now());
}

async function apiLogin(ctx: BrowserContext, email: string) {
  await throttleLogin();
  const r = await ctx.request.post(`${BASE}/api/auth/login`, {
    data: { email, password: seed.password },
  });
  if (!r.ok()) throw new Error(`login ${email} → ${r.status()}`);
}

async function apiPair(ctx: BrowserContext, body: Record<string, string>) {
  const r = await ctx.request.post(`${BASE}/api/admin/devices`, { data: body });
  let json: Record<string, unknown> = {};
  try {
    json = (await r.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return { status: r.status(), json };
}

async function uiLogin(page: Page, email: string) {
  await throttleLogin();
  await page.goto(`${BASE}/admin/login`);
  await page.fill("#email", email);
  await page.fill("#password", seed.password);
  await Promise.all([
    page.waitForURL((u) => u.pathname === "/admin" || u.pathname.startsWith("/admin/") && !u.pathname.includes("login"), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
}

function watch(page: Page) {
  const issues: string[] = [];
  const posts: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") issues.push(`console.error: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => issues.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/api/admin/devices")) posts.push(r.url());
  });
  return { issues, posts };
}

async function fillForm(page: Page, v: { code: string; id: string; name: string; loc: string }) {
  await page.fill("#code", v.code);
  await page.fill("#deviceCode", v.id);
  await page.fill("#name", v.name);
  await page.fill("#location", v.loc);
}

async function formValues(page: Page) {
  return {
    code: await page.inputValue("#code"),
    id: await page.inputValue("#deviceCode"),
    name: await page.inputValue("#name"),
    loc: await page.inputValue("#location"),
  };
}

async function main() {
  fs.mkdirSync(`${OUT}/screenshots`, { recursive: true });
  const browser = await chromium.launch();
  const T = seed.tenants;
  const ROLES = ["VIEWER", "EDITOR", "OPERATOR", "ADMIN", "SUPER_ADMIN"] as const;

  // ───────────── A. REAL ROLE × LAYER MATRIX (API, real backend) ─────────────
  console.log("\n## A. Role × layer matrix (real backend)");
  const matrix: Record<string, Record<string, string>> = {};
  for (const [tname, expectErr] of [
    ["ok", "SUCCESS"],
    ["disabled", "ENTITLEMENT_DENIED"],
    ["quota", "QUOTA_EXCEEDED"],
  ] as const) {
    matrix[tname] = {};
    for (const role of ROLES) {
      const ctx = await browser.newContext();
      await apiLogin(ctx, T[tname]!.users[role]!);
      const dc = `${role.slice(0, 3)}-${tname.slice(0, 3)}-${Date.now().toString(36).slice(-4)}`.toUpperCase();
      const res = await apiPair(ctx, {
        activationCode: nextCode(),
        name: `${role} ${tname}`,
        location: "lab",
        deviceCode: dc,
      });
      const outcome = res.status === 200 ? "SUCCESS" : String(res.json.code ?? res.json.error);
      matrix[tname]![role] = `${res.status} ${outcome}`;
      const rbacDeny = role === "VIEWER" || role === "EDITOR";
      const expected = rbacDeny ? "PERMISSION_DENIED" : expectErr;
      const expStatus = expected === "SUCCESS" ? 200 : 403;
      check(
        `MATRIX ${tname}/${role}`,
        res.status === expStatus && outcome === expected &&
          (expected === "SUCCESS" || (res.json.error === expected && res.json.code === expected)),
        `${res.status} ${outcome} (expected ${expStatus} ${expected})`,
      );
      await ctx.close();
    }
  }

  // ───────────── B. Domain errors (ADMIN, ok tenant) ─────────────
  console.log("\n## B. Domain errors");
  {
    const ctx = await browser.newContext();
    await apiLogin(ctx, T.ok!.users.ADMIN!);
    const bad = await apiPair(ctx, { activationCode: "000000", name: "x", deviceCode: "BAD-001" });
    check("API activation invalid", bad.status === 400 && bad.json.error === "ACTIVATION_CODE_INVALID" && bad.json.code === "ACTIVATION_CODE_INVALID", `${bad.status} ${JSON.stringify(bad.json)}`);
    const first = await apiPair(ctx, { activationCode: nextCode(), name: "dup1", deviceCode: "DUP-001" });
    const dup = await apiPair(ctx, { activationCode: nextCode(), name: "dup2", deviceCode: "DUP-001" });
    check("API device already registered", first.status === 200 && dup.status === 400 && dup.json.error === "DEVICE_ALREADY_REGISTERED" && dup.json.code === "DEVICE_ALREADY_REGISTERED", `first=${first.status} dup=${dup.status} ${JSON.stringify(dup.json)}`);
    const val = await apiPair(ctx, { activationCode: "12", name: "", deviceCode: "x" });
    check("API validation (zod) keeps readable text + code", val.status === 400 && val.json.code === "VALIDATION_ERROR" && typeof val.json.error === "string" && val.json.error !== "VALIDATION_ERROR", JSON.stringify(val.json).slice(0, 160));
    const unauth = await browser.newContext();
    const un = await apiPair(unauth, { activationCode: "123456", name: "x", deviceCode: "UNA-001" });
    check("API unauthenticated", un.status === 401 && un.json.error === "AUTHENTICATION_REQUIRED" && un.json.code === "AUTHENTICATION_REQUIRED", `${un.status} ${JSON.stringify(un.json)}`);
    await ctx.close();
    await unauth.close();
  }

  // ───────────── C. Browser: ADMIN ─────────────
  console.log("\n## C. Browser — ADMIN (ok tenant)");
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageA = await ctxA.newPage();
  const wA = watch(pageA);
  await uiLogin(pageA, T.ok!.users.ADMIN!);
  await pageA.goto(`${BASE}/admin/devices`);
  await pageA.waitForSelector("#code");
  const body0 = await pageA.innerText("body");
  check("ADMIN sees Ecrãs + form", /Ecrãs/.test(body0) && (await pageA.locator("#code").count()) === 1);
  await pageA.screenshot({ path: `${OUT}/screenshots/admin-form.png`, fullPage: true });

  // F — real success
  const okVals = { code: nextCode(), id: "ADM-OK-001", name: "Ecrã Browser ADMIN", loc: "Piso 0" };
  await fillForm(pageA, okVals);
  await pageA.click('form:has(#code) button[type="submit"]');
  await pageA.getByText("Ecrã associado com sucesso.").waitFor({ timeout: 15_000 });
  const after = await formValues(pageA);
  check("CASE F success message", true);
  check("CASE F activation code cleared, other fields kept (pre-existing UX)", after.code === "" && after.name === okVals.name && after.id === okVals.id && after.loc === okVals.loc, JSON.stringify(after));
  await pageA.waitForFunction((n) => document.body.innerText.includes(n), okVals.name, { timeout: 15_000 }).catch(() => {});
  check("CASE F list updated (new device visible)", (await pageA.innerText("body")).includes(okVals.name));
  await pageA.screenshot({ path: `${OUT}/screenshots/admin-success.png`, fullPage: true });

  // Real activation invalid + preservation
  const badVals = { code: "000000", id: "ADM-BAD-001", name: "Preservar nome", loc: "Preservar local" };
  await fillForm(pageA, badVals);
  await pageA.click('form:has(#code) button[type="submit"]');
  await pageA.getByText("Código de activação inválido").waitFor({ timeout: 15_000 });
  const keep = await formValues(pageA);
  check("CASE D real: activation invalid title", true);
  check("PRESERVE on error (all 4 fields)", JSON.stringify(keep) === JSON.stringify(badVals), JSON.stringify(keep));
  check("CASE D no technical code in UI", !TECH_CODES.test(await pageA.innerText("body")));
  await pageA.screenshot({ path: `${OUT}/screenshots/admin-activation-invalid.png`, fullPage: true });

  // Real already registered (DUP-001 exists from section B)
  await fillForm(pageA, { code: nextCode(), id: "DUP-001", name: "Dup UI", loc: "x" });
  await pageA.click('form:has(#code) button[type="submit"]');
  await pageA.getByText("Ecrã já associado").waitFor({ timeout: 15_000 });
  check("CASE E real: device already registered", true);
  check("CASE E no technical code in UI", !TECH_CODES.test(await pageA.innerText("body")));

  // Mocked HTTP cases A–E (exact payloads from the spec) through the real page
  async function mockCase(status: number, payload: unknown, expectTitle: string, label: string, notContain: RegExp) {
    await pageA.route("**/api/admin/devices", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
    });
    await fillForm(pageA, { code: "123456", id: "MOCK-001", name: "Mock", loc: "Mock" });
    await pageA.click('form:has(#code) button[type="submit"]');
    await pageA.getByText(expectTitle, { exact: false }).first().waitFor({ timeout: 10_000 });
    const text = await pageA.innerText("body");
    check(`${label} UI title "${expectTitle}"`, true);
    check(`${label} no technical code`, !notContain.test(text) && !TECH_CODES.test(text));
    await pageA.unroute("**/api/admin/devices");
  }
  await mockCase(403, { error: "PERMISSION_DENIED" }, "Permissão insuficiente", "CASE A (mock)", /PERMISSION_DENIED/);
  await mockCase(403, { error: "ENTITLEMENT_DENIED" }, "Funcionalidade indisponível", "CASE B (mock)", /ENTITLEMENT_DENIED/);
  await mockCase(403, { error: "QUOTA_EXCEEDED" }, "Limite de Ecrãs atingido", "CASE C (mock)", /QUOTA_EXCEEDED/);
  await mockCase(400, { error: "ACTIVATION_CODE_INVALID" }, "Código de activação inválido", "CASE D (mock)", /ACTIVATION_CODE_INVALID/);
  await mockCase(409, { error: "DEVICE_ALREADY_REGISTERED" }, "Ecrã já associado", "CASE E (mock 409)", /DEVICE_ALREADY_REGISTERED/);
  await mockCase(500, { error: "INTERNAL_ERROR", message: "Internal server error" }, "Não foi possível completar a operação", "INTERNAL (mock)", /INTERNAL_ERROR/);
  // Legacy-shaped payloads still safe
  await mockCase(403, { error: "Forbidden" }, "Permissão insuficiente", "LEGACY 403 'Forbidden' (mock)", /Forbidden/);

  // Duplicate submission: delayed response, 3 rapid clicks + 3 forced requestSubmit
  let dupCount = 0;
  await pageA.route("**/api/admin/devices", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    dupCount++;
    await sleep(1200);
    return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "QUOTA_EXCEEDED" }) });
  });
  await fillForm(pageA, { code: "123456", id: "DUP-CLICK", name: "Dup click", loc: "x" });
  await pageA.evaluate(() => {
    const btn = document.querySelector('form:has(#code) button[type="submit"]') as HTMLButtonElement;
    const form = btn.closest("form") as HTMLFormElement;
    btn.click(); btn.click(); btn.click();
    form.requestSubmit(); form.requestSubmit(); form.requestSubmit();
  });
  await sleep(150);
  const midDisabled = await pageA.locator('form:has(#code) button[type="submit"]').isDisabled();
  const midLabel = await pageA.locator('form:has(#code) button[type="submit"]').innerText();
  await pageA.getByText("Limite de Ecrãs atingido").waitFor({ timeout: 10_000 });
  check("DUPLICATE: button disabled while submitting", midDisabled && /A associar/.test(midLabel), midLabel);
  check("DUPLICATE: exactly one request for 3 clicks + 3 requestSubmit", dupCount === 1, `requests=${dupCount}`);
  check("DUPLICATE: button re-enabled after response", await pageA.locator('form:has(#code) button[type="submit"]').isEnabled());
  await pageA.unroute("**/api/admin/devices");

  // Long text overflow (mobile 390px + desktop)
  await pageA.route("**/api/admin/devices", (route) =>
    route.request().method() !== "POST"
      ? route.continue()
      : route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "VALIDATION_ERROR", message: "X".repeat(400) + " " + "palavra ".repeat(60) }) }),
  );
  for (const [w, h, tag] of [[390, 800, "mobile"], [1280, 900, "desktop"]] as const) {
    await pageA.setViewportSize({ width: w, height: h });
    await pageA.goto(`${BASE}/admin/devices#registar-ecra`);
    await pageA.waitForSelector("#code");
    await fillForm(pageA, { code: "123456", id: "LONG-001", name: "Long", loc: "x" });
    await pageA.click('form:has(#code) button[type="submit"]');
    await pageA.locator("text=Dados inválidos").waitFor({ timeout: 10_000 });
    const ov = await pageA.evaluate(() => {
      const el = Array.from(document.querySelectorAll("div")).find((d) => d.textContent?.startsWith("Dados inválidos") && d.className.includes("border")) as HTMLElement | undefined;
      const card = el?.closest("form") as HTMLElement | null;
      return {
        errBox: el ? el.scrollWidth - el.clientWidth : -1,
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        form: card ? card.scrollWidth - card.clientWidth : -1,
      };
    });
    check(`OVERFLOW ${tag}: long error stays inside box/page`, ov.errBox <= 0 && ov.page <= 0 && ov.form <= 0, JSON.stringify(ov));
    await pageA.screenshot({ path: `${OUT}/screenshots/long-error-${tag}.png`, fullPage: true });
    // usable on mobile: submit button visible & enabled
    check(`USABLE ${tag}: submit button visible/enabled`, (await pageA.locator('form:has(#code) button[type="submit"]').isVisible()) && (await pageA.locator('form:has(#code) button[type="submit"]').isEnabled()));
  }
  await pageA.unroute("**/api/admin/devices");
  await pageA.setViewportSize({ width: 1280, height: 900 });
  check("ADMIN DevTools: no console/page errors, no duplicate POSTs", wA.issues.filter((i) => !/Failed to load resource/.test(i)).length === 0, wA.issues.join(" | ").slice(0, 300));
  await ctxA.close();

  // ───────────── D. Browser: OPERATOR + real PERMISSION_DENIED via demotion ─────────────
  console.log("\n## D. Browser — OPERATOR");
  const ctxO = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageO = await ctxO.newPage();
  const wO = watch(pageO);
  await uiLogin(pageO, T.ok!.users.OPERATOR!);
  await pageO.goto(`${BASE}/admin/devices`);
  await pageO.waitForSelector("#code");
  await fillForm(pageO, { code: nextCode(), id: "OPR-OK-001", name: "Ecrã Browser OPERATOR", loc: "Piso 1" });
  await pageO.click('form:has(#code) button[type="submit"]');
  await pageO.getByText("Ecrã associado com sucesso.").waitFor({ timeout: 15_000 });
  check("OPERATOR real success (passes RBAC+Entitlement+Quota+Domain)", true);

  // demote OPERATOR → VIEWER in DB while the form is open (reported scenario: no manage_devices)
  const { db } = await import("../src/db");
  const { sql } = await import("drizzle-orm");
  await db.run(sql`UPDATE memberships SET role='VIEWER' WHERE user_id=(SELECT id FROM users WHERE email=${T.ok!.users.OPERATOR!})`);
  await db.run(sql`UPDATE users SET role='VIEWER' WHERE email=${T.ok!.users.OPERATOR!}`);
  await fillForm(pageO, { code: nextCode(), id: "OPR-DENY-001", name: "Sem permissão", loc: "x" });
  const respP = pageO.waitForResponse((r) => r.url().endsWith("/api/admin/devices") && r.request().method() === "POST");
  await pageO.click('form:has(#code) button[type="submit"]');
  const resp = await respP;
  const rj = (await resp.json()) as Record<string, unknown>;
  await pageO.getByText("Permissão insuficiente").first().waitFor({ timeout: 10_000 });
  const tO = await pageO.innerText("body");
  check("REPORTED CASE: real 403 PERMISSION_DENIED from API", resp.status() === 403 && rj.error === "PERMISSION_DENIED" && rj.code === "PERMISSION_DENIED", `${resp.status()} ${JSON.stringify(rj)}`);
  check("REPORTED CASE: UI shows 'Permissão insuficiente', not ENTITLEMENT_DENIED / raw code", !/ENTITLEMENT_DENIED|PERMISSION_DENIED|Funcionalidade indisponível/.test(tO));
  check("REPORTED CASE: values preserved", (await formValues(pageO)).name === "Sem permissão");
  await pageO.screenshot({ path: `${OUT}/screenshots/operator-permission-denied.png`, fullPage: true });
  check("OPERATOR DevTools: no page errors", wO.issues.filter((i) => !/Failed to load resource/.test(i)).length === 0, wO.issues.join(" | ").slice(0, 300));
  await ctxO.close();

  // ───────────── E. Browser: EDITOR (and VIEWER) ─────────────
  console.log("\n## E. Browser — EDITOR / VIEWER");
  for (const role of ["EDITOR", "VIEWER"] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const w = watch(page);
    await uiLogin(page, T.ok!.users[role]!);
    await page.goto(`${BASE}/admin/devices`);
    await page.waitForLoadState("networkidle");
    const t = await page.innerText("body");
    check(`${role}: Ecrãs page shows access denied, no pairing form`, (await page.locator("#code").count()) === 0 && !TECH_CODES.test(t), t.replace(/\s+/g, " ").slice(0, 120));
    await page.screenshot({ path: `${OUT}/screenshots/${role.toLowerCase()}-denied.png`, fullPage: true });
    // direct API with this session
    const api = await apiPair(ctx, { activationCode: nextCode(), name: "x", deviceCode: "EDT-001" });
    check(`${role}: direct API → 403 PERMISSION_DENIED`, api.status === 403 && api.json.error === "PERMISSION_DENIED");
    check(`${role} DevTools: no page errors`, w.issues.filter((i) => !/Failed to load resource/.test(i)).length === 0, w.issues.join(" | ").slice(0, 300));
    await ctx.close();
  }

  // ───────────── F. Browser: real ENTITLEMENT + QUOTA ─────────────
  console.log("\n## F. Browser — real entitlement / quota");
  for (const [tname, title, label] of [
    ["disabled", "Funcionalidade indisponível", "ENTITLEMENT real (devices.enabled=false)"],
    ["quota", "Limite de Ecrãs atingido", "QUOTA real (usage>=max)"],
  ] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const w = watch(page);
    await uiLogin(page, T[tname]!.users.ADMIN!);
    await page.goto(`${BASE}/admin/devices`);
    await page.waitForSelector("#code");
    await fillForm(page, { code: nextCode(), id: `${tname.toUpperCase()}-001`, name: `Real ${tname}`, loc: "x" });
    const rp = page.waitForResponse((r) => r.url().endsWith("/api/admin/devices") && r.request().method() === "POST");
    await page.click('form:has(#code) button[type="submit"]');
    const r = await rp;
    const j = (await r.json()) as Record<string, unknown>;
    await page.getByText(title).first().waitFor({ timeout: 10_000 });
    const t = await page.innerText("body");
    const expectedErr = tname === "disabled" ? "ENTITLEMENT_DENIED" : "QUOTA_EXCEEDED";
    check(`${label}: API ${expectedErr}`, r.status() === 403 && j.error === expectedErr && j.code === expectedErr, `${r.status()} ${JSON.stringify(j)}`);
    check(`${label}: UI "${title}", no 'Permissão insuficiente' / raw code`, !/Permissão insuficiente/.test(t) && !TECH_CODES.test(t));
    check(`${label}: values preserved`, (await formValues(page)).name === `Real ${tname}`);
    await page.screenshot({ path: `${OUT}/screenshots/real-${tname}.png`, fullPage: true });
    check(`${label} DevTools: no page errors`, w.issues.filter((i) => !/Failed to load resource/.test(i)).length === 0, w.issues.join(" | ").slice(0, 300));
    check(`${label}: exactly one POST`, w.posts.length === 1, `posts=${w.posts.length}`);
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "e2e-results.json"), JSON.stringify({ matrix, rows }, null, 2));
  const failed = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - failed.length}/${rows.length} PASS`);
  if (failed.length) {
    console.log("FAILED:", failed.map((f) => f.id).join("; "));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
