/**
 * CONTENT-TEMPLATES-01 — Template Registry + independence + CLOCK contracts.
 * Run: npm run test:content-templates-01
 */
import assert from "node:assert/strict";
import {
  TemplateRegistry,
  deepCloneDefaults,
  REQUIRED_TEMPLATE_IDS,
  TEMPLATE_CATEGORIES,
} from "../src/domain/content-templates";
import { CONTENT_TYPES } from "../src/domain/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runClockLegacyParityTests } from "./test-clock-legacy-parity";

function main() {
  console.log("CONTENT-TEMPLATES-01");

  // TEMPLATE-001
  const all = TemplateRegistry.getAll();
  assert.ok(all.length >= 9, "TEMPLATE-001 registry loads templates");

  // TEMPLATE-002
  const ids = all.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "TEMPLATE-002 unique ids");

  // TEMPLATE-003 / 004
  for (const t of all) {
    assert.ok(
      (CONTENT_TYPES as readonly string[]).includes(t.type),
      `TEMPLATE-003 type valid ${t.id}`,
    );
    assert.ok(t.name && t.description && t.version && t.category, `TEMPLATE-004 meta ${t.id}`);
    assert.ok(TEMPLATE_CATEGORIES.includes(t.category), `category ${t.id}`);
  }

  // TEMPLATE-005..008
  assert.ok(TemplateRegistry.getById("clock-digital"), "TEMPLATE-005 getById");
  assert.ok(TemplateRegistry.getByType("CLOCK").length >= 2, "TEMPLATE-006 getByType");
  assert.ok(TemplateRegistry.getByCategory("TEXT").length >= 3, "TEMPLATE-007 getByCategory");
  assert.equal(TemplateRegistry.getById("no-such"), null, "TEMPLATE-008 missing");
  assert.equal(TemplateRegistry.exists("no-such"), false);
  assert.equal(TemplateRegistry.createContentSeed("no-such"), null);

  // TEMPLATE-009..017
  for (const id of REQUIRED_TEMPLATE_IDS) {
    assert.ok(TemplateRegistry.exists(id), `required ${id}`);
  }

  // TEMPLATE-018 type mapping
  assert.equal(TemplateRegistry.getById("text-information")!.type, "TEXT");
  assert.equal(TemplateRegistry.getById("clock-digital")!.type, "CLOCK");
  assert.equal(TemplateRegistry.getById("clock-analog")!.type, "CLOCK");
  assert.equal(TemplateRegistry.getById("notice-standard")!.type, "NOTICE");
  assert.equal(TemplateRegistry.getById("notice-urgent")!.type, "NOTICE");
  assert.equal(TemplateRegistry.getById("event-institutional")!.type, "EVENT");
  assert.equal(TemplateRegistry.getById("qr-instruction")!.type, "QR_CODE");

  // TEMPLATE-019 deep clone
  const seed = TemplateRegistry.createContentSeed("clock-digital")!;
  const tpl = TemplateRegistry.getById("clock-digital")!;
  seed.payload.showSeconds = false;
  assert.equal(tpl.defaults.payload.showSeconds, true, "TEMPLATE-019/020 independent");

  // TEMPLATE-021 version preserved
  assert.equal(seed.templateVersion, tpl.version);
  assert.equal(seed.payload.createdFromTemplateVersion, tpl.version);

  // TEMPLATE-022 Content independent
  assert.ok(seed.payload.createdFromTemplateId === "clock-digital");
  const again = TemplateRegistry.createContentSeed("clock-digital")!;
  assert.equal(again.payload.showSeconds, true, "TEMPLATE-022 registry intact");

  // TEMPLATE-029 no EXPERIENCE templates
  assert.equal(TemplateRegistry.getByType("EXPERIENCE").length, 0, "TEMPLATE-029");

  // TEMPLATE-030 no eval/new Function in registry source
  const src = readFileSync(
    join(process.cwd(), "src/domain/content-templates.ts"),
    "utf8",
  );
  assert.ok(!src.includes("eval("), "TEMPLATE-030 no eval");
  assert.ok(!src.includes("new Function"), "TEMPLATE-030 no Function");

  // CLOCK domain contracts in defaults
  const digital = TemplateRegistry.getById("clock-digital")!;
  const analog = TemplateRegistry.getById("clock-analog")!;
  assert.equal(digital.defaults.payload.style, "digital", "CLOCK-012 digital");
  assert.equal(analog.defaults.payload.style, "analog", "CLOCK-012 analog");
  assert.equal(digital.defaults.payload.showSeconds, true, "CLOCK-001 defaults");

  // deepCloneDefaults utility
  const obj = { a: { b: 1 } };
  const cloned = deepCloneDefaults(obj);
  cloned.a.b = 2;
  assert.equal(obj.a.b, 1, "deepCloneDefaults");

  // live clock hook source — no network
  const liveSrc = readFileSync(
    join(process.cwd(), "src/features/contents/use-live-clock.ts"),
    "utf8",
  );
  assert.ok(!liveSrc.includes("fetch("), "CLOCK-018 no fetch");
  assert.ok(liveSrc.includes("clearInterval"), "CLOCK-009 cleanup");

  // display-engine uses LiveClock
  const eng = readFileSync(
    join(process.cwd(), "src/player/playback/display-engine.tsx"),
    "utf8",
  );
  assert.ok(eng.includes("useLiveClock"), "CLOCK player live");
  assert.ok(!eng.includes("eval("), "CLOCK-017");

  // tv.js clock timer — digital + analog parity
  const tv = readFileSync(join(process.cwd(), "public/tv.js"), "utf8");
  assert.ok(tv.includes("showSeconds"), "tv.js respects showSeconds");
  assert.ok(tv.includes("renderAnalogClockFace"), "tv.js analog live");
  assert.ok(tv.includes("renderDigitalClockFace"), "tv.js digital live");
  assert.ok(tv.includes("clearClockTimer"), "tv.js clock cleanup");
  assert.ok(tv.includes("h * 30 + m * 0.5"), "tv.js hour hand follows minutes");
  assert.ok(tv.includes("showSeconds ? 1000 : 30000"), "tv tick cadence");

  // Nested CLOCK-LEGACY suite
  runClockLegacyParityTests();

  console.log("CONTENT-TEMPLATES-01 PASS");
}

main();
