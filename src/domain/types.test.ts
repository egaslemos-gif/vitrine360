import test from "node:test";
import assert from "node:assert/strict";
import { derivePresence } from "./types";

test("derivePresence", async (t) => {
  const ONLINE_WINDOW = 3 * 60 * 1000; // 3 min
  const AWAY_WINDOW = 15 * 60 * 1000; // 15 min

  await t.test("should be ONLINE for now", () => {
    const now = Date.now();
    const lastSeenAt = new Date(now).toISOString();
    assert.equal(derivePresence(lastSeenAt, ONLINE_WINDOW, AWAY_WINDOW, now), "ONLINE");
  });

  await t.test("should be ONLINE for 2 min ago", () => {
    const now = Date.now();
    const lastSeenAt = new Date(now - 2 * 60 * 1000).toISOString();
    assert.equal(derivePresence(lastSeenAt, ONLINE_WINDOW, AWAY_WINDOW, now), "ONLINE");
  });

  await t.test("should be ONLINE for exactly 3 min ago", () => {
    const now = Date.now();
    const lastSeenAt = new Date(now - ONLINE_WINDOW).toISOString();
    assert.equal(derivePresence(lastSeenAt, ONLINE_WINDOW, AWAY_WINDOW, now), "ONLINE");
  });

  await t.test("should be AWAY for 3 min + 1 ms ago", () => {
    const now = Date.now();
    const lastSeenAt = new Date(now - ONLINE_WINDOW - 1).toISOString();
    assert.equal(derivePresence(lastSeenAt, ONLINE_WINDOW, AWAY_WINDOW, now), "AWAY");
  });

  await t.test("should be AWAY for 5 min ago", () => {
    const now = Date.now();
    const lastSeenAt = new Date(now - 5 * 60 * 1000).toISOString();
    assert.equal(derivePresence(lastSeenAt, ONLINE_WINDOW, AWAY_WINDOW, now), "AWAY");
  });

  await t.test("should be AWAY for exactly 15 min ago", () => {
    const now = Date.now();
    const lastSeenAt = new Date(now - AWAY_WINDOW).toISOString();
    assert.equal(derivePresence(lastSeenAt, ONLINE_WINDOW, AWAY_WINDOW, now), "AWAY");
  });

  await t.test("should be OFFLINE for 15 min + 1 ms ago", () => {
    const now = Date.now();
    const lastSeenAt = new Date(now - AWAY_WINDOW - 1).toISOString();
    assert.equal(derivePresence(lastSeenAt, ONLINE_WINDOW, AWAY_WINDOW, now), "OFFLINE");
  });

  await t.test("should be OFFLINE for 30 min ago", () => {
    const now = Date.now();
    const lastSeenAt = new Date(now - 30 * 60 * 1000).toISOString();
    assert.equal(derivePresence(lastSeenAt, ONLINE_WINDOW, AWAY_WINDOW, now), "OFFLINE");
  });

  await t.test("should be OFFLINE if lastSeenAt is null", () => {
    const now = Date.now();
    assert.equal(derivePresence(null, ONLINE_WINDOW, AWAY_WINDOW, now), "OFFLINE");
  });
});
