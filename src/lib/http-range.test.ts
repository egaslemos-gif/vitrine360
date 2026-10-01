import test from "node:test";
import assert from "node:assert/strict";
import {
  MEDIA_RANGE_MAX_CHUNK,
  contentRangeHeader,
  parseRangeHeader,
} from "./http-range";

const TOTAL = 20_000_000;

test("parseRangeHeader", async (t) => {
  await t.test("no header → full", () => {
    assert.deepEqual(parseRangeHeader(null, TOTAL), { type: "full" });
    assert.deepEqual(parseRangeHeader("", TOTAL), { type: "full" });
  });

  await t.test("bytes=0- (Chrome / Smart TV open range) is capped to one chunk", () => {
    const r = parseRangeHeader("bytes=0-", TOTAL);
    assert.deepEqual(r, { type: "range", start: 0, end: MEDIA_RANGE_MAX_CHUNK - 1, total: TOTAL });
  });

  await t.test("bytes=0-1 (Safari probe) is honoured exactly", () => {
    assert.deepEqual(parseRangeHeader("bytes=0-1", TOTAL), { type: "range", start: 0, end: 1, total: TOTAL });
  });

  await t.test("mid-file open range continues from start", () => {
    const r = parseRangeHeader("bytes=8000000-", TOTAL);
    assert.deepEqual(r, { type: "range", start: 8_000_000, end: 8_000_000 + MEDIA_RANGE_MAX_CHUNK - 1, total: TOTAL });
  });

  await t.test("range reaching EOF is clamped to total-1", () => {
    const r = parseRangeHeader("bytes=19999000-", TOTAL);
    assert.deepEqual(r, { type: "range", start: 19_999_000, end: TOTAL - 1, total: TOTAL });
  });

  await t.test("end beyond EOF is clamped", () => {
    const r = parseRangeHeader("bytes=100-999999999", 500);
    assert.deepEqual(r, { type: "range", start: 100, end: 499, total: 500 });
  });

  await t.test("suffix range (moov at end of MP4)", () => {
    const r = parseRangeHeader("bytes=-2048", TOTAL);
    assert.deepEqual(r, { type: "range", start: TOTAL - 2048, end: TOTAL - 1, total: TOTAL });
    // suffix larger than file → whole file start
    assert.deepEqual(parseRangeHeader("bytes=-999", 500), { type: "range", start: 0, end: 499, total: 500 });
  });

  await t.test("start past EOF or inverted → unsatisfiable (416)", () => {
    assert.deepEqual(parseRangeHeader("bytes=30000000-", TOTAL), { type: "unsatisfiable" });
    assert.deepEqual(parseRangeHeader("bytes=500-100", TOTAL), { type: "unsatisfiable" });
    assert.deepEqual(parseRangeHeader("bytes=-0", TOTAL), { type: "unsatisfiable" });
  });

  await t.test("garbage / unsupported unit / empty spec → full (ignore header)", () => {
    assert.deepEqual(parseRangeHeader("items=0-5", TOTAL), { type: "full" });
    assert.deepEqual(parseRangeHeader("bytes=-", TOTAL), { type: "full" });
    assert.deepEqual(parseRangeHeader("bytes=abc", TOTAL), { type: "full" });
  });

  await t.test("multi-range → first range only", () => {
    const r = parseRangeHeader("bytes=0-99, 200-299", TOTAL);
    assert.deepEqual(r, { type: "range", start: 0, end: 99, total: TOTAL });
  });

  await t.test("unknown size → full", () => {
    assert.deepEqual(parseRangeHeader("bytes=0-", 0), { type: "full" });
  });

  await t.test("no response exceeds the chunk cap", () => {
    for (const h of ["bytes=0-", "bytes=1-", "bytes=5000000-", "bytes=0-19999999"]) {
      const r = parseRangeHeader(h, TOTAL);
      assert.equal(r.type, "range");
      if (r.type === "range") assert.ok(r.end - r.start + 1 <= MEDIA_RANGE_MAX_CHUNK);
    }
    assert.ok(MEDIA_RANGE_MAX_CHUNK < 4.5 * 1024 * 1024);
  });

  await t.test("contentRangeHeader format", () => {
    assert.equal(contentRangeHeader(0, 99, 1000), "bytes 0-99/1000");
  });
});
