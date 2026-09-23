import assert from "node:assert/strict";
import { derivePresence, hasPermission } from "../src/domain/types";

assert.equal(derivePresence(null, 180_000, 900_000), "OFFLINE");
assert.equal(
  derivePresence(new Date().toISOString(), 180_000, 900_000),
  "ONLINE",
);
assert.equal(
  derivePresence(new Date(Date.now() - 300_000).toISOString(), 180_000, 900_000),
  "AWAY",
);
assert.equal(
  derivePresence(new Date(Date.now() - 1_200_000).toISOString(), 180_000, 900_000),
  "OFFLINE",
);
assert.equal(hasPermission("VIEWER", "manage_devices"), false);
assert.equal(hasPermission("ADMIN", "manage_devices"), true);

console.log("domain tests passed");
