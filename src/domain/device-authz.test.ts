import test from "node:test";
import assert from "node:assert/strict";
import {
  hasPermission,
  type UserRole,
  type Permission,
} from "./types";

/* ────────────────────────────────────────────────────────────────────
 * AUTHZ-DEVICE-02 — RBAC Device Authorization tests.
 *
 * Validates the RBAC matrix for device operations against every role.
 * Does NOT test Entitlements, Quotas, or Tenant lifecycle — those are
 * independent layers evaluated AFTER RBAC passes.
 * ──────────────────────────────────────────────────────────────────── */

const DEVICE_PERMISSION: Permission = "manage_devices";

const ROLE_EXPECTATIONS: Array<{
  role: UserRole;
  expected: "ALLOW" | "DENY";
}> = [
  { role: "SUPER_ADMIN", expected: "ALLOW" },
  { role: "ADMIN", expected: "ALLOW" },
  { role: "OPERATOR", expected: "ALLOW" },
  { role: "EDITOR", expected: "DENY" },
  { role: "VIEWER", expected: "DENY" },
];

test("RBAC device authorization matrix", async (t) => {
  for (const { role, expected } of ROLE_EXPECTATIONS) {
    await t.test(`${role} → ${expected} for ${DEVICE_PERMISSION}`, () => {
      const result = hasPermission(role, DEVICE_PERMISSION);
      if (expected === "ALLOW") {
        assert.equal(result, true, `${role} should have ${DEVICE_PERMISSION}`);
      } else {
        assert.equal(result, false, `${role} should NOT have ${DEVICE_PERMISSION}`);
      }
    });
  }
});

test("RBAC device operations per role", async (t) => {
  const DEVICE_OPERATIONS = [
    "CREATE DEVICE",
    "PAIR DEVICE",
    "UPDATE DEVICE",
    "DELETE DEVICE",
  ] as const;

  for (const { role, expected } of ROLE_EXPECTATIONS) {
    for (const op of DEVICE_OPERATIONS) {
      await t.test(`${role} → ${expected} for ${op}`, () => {
        // All device operations use the same permission: manage_devices
        const result = hasPermission(role, DEVICE_PERMISSION);
        if (expected === "ALLOW") {
          assert.equal(result, true, `${role} should be ALLOWED for ${op}`);
        } else {
          assert.equal(result, false, `${role} should be DENIED for ${op}`);
        }
      });
    }
  }
});

test("RBAC complete permission matrix", async (t) => {
  const ALL_PERMISSIONS: Permission[] = [
    "manage_users",
    "manage_devices",
    "manage_contents",
    "manage_playlists",
    "manage_schedules",
    "view_logs",
    "view_dashboard",
  ];

  const EXPECTED_MATRIX: Record<UserRole, Permission[]> = {
    SUPER_ADMIN: ALL_PERMISSIONS,
    ADMIN: ALL_PERMISSIONS,
    EDITOR: [
      "manage_contents",
      "manage_playlists",
      "manage_schedules",
      "view_dashboard",
      "view_logs",
    ],
    OPERATOR: [
      "manage_devices",
      "manage_playlists",
      "manage_schedules",
      "view_dashboard",
      "view_logs",
    ],
    VIEWER: ["view_dashboard", "view_logs"],
  };

  for (const [role, expectedPermissions] of Object.entries(EXPECTED_MATRIX) as Array<
    [UserRole, Permission[]]
  >) {
    for (const perm of ALL_PERMISSIONS) {
      const shouldHave = expectedPermissions.includes(perm);
      await t.test(`${role} ${shouldHave ? "HAS" : "LACKS"} ${perm}`, () => {
        assert.equal(
          hasPermission(role, perm),
          shouldHave,
          `${role} should ${shouldHave ? "have" : "lack"} ${perm}`,
        );
      });
    }
  }
});
