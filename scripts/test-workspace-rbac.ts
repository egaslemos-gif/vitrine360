/**
 * Phase 2 workspace RBAC: members, last-admin, playlist permission map, workspace settings.
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const { hashPassword, authenticateUser, sessionFromUser, AuthError } =
    await import("../src/lib/auth");
  const { createMembership, resolveActiveMembership } = await import(
    "../src/services/memberships"
  );
  const {
    changeMemberRole,
    setMemberStatus,
    removeMember,
    listWorkspaceMembers,
    countActiveAdmins,
    MembershipError,
  } = await import("../src/services/members");
  const { hasPermission, ROLE_PERMISSIONS } = await import("../src/domain/types");
  const { createPlaylist, listPlaylists, deletePlaylist } = await import(
    "../src/services/playlists"
  );
  const { createContent, listContents } = await import("../src/services/contents");

  const stamp = Date.now().toString(36);
  const passwordHash = await hashPassword("Phase2pass!");
  const tenantA = await createTenant({ name: `P2 A ${stamp}`, slug: `p2-a-${stamp}` });
  const tenantB = await createTenant({ name: `P2 B ${stamp}`, slug: `p2-b-${stamp}` });

  async function makeUser(email: string, home: string, role: "ADMIN" | "EDITOR" | "VIEWER" | "OPERATOR" | "SUPER_ADMIN") {
    const id = crypto.randomUUID();
    await db.insert(schema.users).values({
      id,
      email,
      name: email.split("@")[0],
      passwordHash,
      role,
      tenantId: home,
    });
    await createMembership({ userId: id, tenantId: home, role, status: "ACTIVE" });
    return id;
  }

  const adminA = await makeUser(`admin-a-${stamp}@ex.com`, tenantA, "ADMIN");
  const editorA = await makeUser(`editor-a-${stamp}@ex.com`, tenantA, "EDITOR");
  const viewerA = await makeUser(`viewer-a-${stamp}@ex.com`, tenantA, "VIEWER");
  const adminB = await makeUser(`admin-b-${stamp}@ex.com`, tenantB, "ADMIN");
  await createMembership({
    userId: adminA,
    tenantId: tenantB,
    role: "VIEWER",
    status: "ACTIVE",
  });

  // Permission matrix §13 — VIEWER cannot manage playlists
  assert.equal(hasPermission("VIEWER", "manage_playlists"), false);
  assert.equal(hasPermission("EDITOR", "manage_playlists"), true);
  assert.equal(hasPermission("OPERATOR", "manage_devices"), true);
  assert.equal(hasPermission("EDITOR", "manage_devices"), false);
  assert.equal(hasPermission("ADMIN", "manage_users"), true);
  assert.deepEqual(
    [...ROLE_PERMISSIONS.SUPER_ADMIN].sort(),
    [...ROLE_PERMISSIONS.ADMIN].sort(),
  );

  // Cross-tenant: content in A invisible in B
  await createContent(
    { type: "TEXT", title: `secret-a-${stamp}`, durationMs: 5000, payload: { body: "a" }, status: "ACTIVE" },
    tenantA,
  );
  const inB = await listContents(tenantB);
  assert.ok(!inB.some((c) => c.title === `secret-a-${stamp}`));

  // Playlist scoped to tenant
  const playlistId = await createPlaylist(
    { name: `pl-${stamp}` },
    tenantA,
    adminA,
  );
  assert.equal((await listPlaylists(tenantB)).some((p) => p.id === playlistId), false);
  await assert.rejects(() => deletePlaylist(playlistId, tenantB, adminB));

  // Members list scoped
  const membersA = await listWorkspaceMembers(tenantA);
  assert.ok(membersA.every((m) => m.id === adminA || m.id === editorA || m.id === viewerA));
  assert.ok(!membersA.some((m) => m.id === adminB));

  // Role change + cannot self
  await assert.rejects(
    () =>
      changeMemberRole({
        operatorId: adminA,
        operatorRole: "ADMIN",
        tenantId: tenantA,
        targetUserId: adminA,
        role: "VIEWER",
      }),
    (e: unknown) => e instanceof MembershipError && e.status === 403,
  );
  await changeMemberRole({
    operatorId: adminA,
    operatorRole: "ADMIN",
    tenantId: tenantA,
    targetUserId: viewerA,
    role: "OPERATOR",
  });
  const viewerMem = await resolveActiveMembership(viewerA, tenantA);
  assert.equal(viewerMem?.role, "OPERATOR");

  // ADMIN cannot assign SUPER_ADMIN
  await assert.rejects(
    () =>
      changeMemberRole({
        operatorId: adminA,
        operatorRole: "ADMIN",
        tenantId: tenantA,
        targetUserId: editorA,
        role: "SUPER_ADMIN",
      }),
    (e: unknown) => e instanceof MembershipError && e.status === 403,
  );

  // Last ADMIN protection
  assert.equal(await countActiveAdmins(tenantA), 1);
  await assert.rejects(
    () =>
      changeMemberRole({
        operatorId: adminA,
        operatorRole: "ADMIN",
        tenantId: tenantA,
        targetUserId: adminA,
        role: "EDITOR",
      }),
    (e: unknown) => e instanceof MembershipError,
  );
  await changeMemberRole({
    operatorId: adminA,
    operatorRole: "ADMIN",
    tenantId: tenantA,
    targetUserId: editorA,
    role: "ADMIN",
  });
  assert.equal(await countActiveAdmins(tenantA), 2);
  await changeMemberRole({
    operatorId: editorA,
    operatorRole: "ADMIN",
    tenantId: tenantA,
    targetUserId: adminA,
    role: "EDITOR",
  });
  assert.equal(await countActiveAdmins(tenantA), 1);
  await assert.rejects(
    () =>
      changeMemberRole({
        operatorId: editorA,
        operatorRole: "ADMIN",
        tenantId: tenantA,
        targetUserId: editorA,
        role: "VIEWER",
      }),
    (e: unknown) => e instanceof MembershipError && e.status === 403,
  );
  await assert.rejects(
    () =>
      setMemberStatus({
        operatorId: editorA,
        tenantId: tenantA,
        targetUserId: editorA,
        status: "SUSPENDED",
      }),
    (e: unknown) => e instanceof MembershipError,
  );
  await assert.rejects(
    () =>
      removeMember({
        operatorId: editorA,
        tenantId: tenantA,
        targetUserId: editorA,
      }),
    (e: unknown) => e instanceof MembershipError,
  );

  // With two admins again, suspending the non-last is OK; suspending last is blocked
  await changeMemberRole({
    operatorId: editorA,
    operatorRole: "ADMIN",
    tenantId: tenantA,
    targetUserId: adminA,
    role: "ADMIN",
  });
  assert.equal(await countActiveAdmins(tenantA), 2);
  await setMemberStatus({
    operatorId: editorA,
    tenantId: tenantA,
    targetUserId: adminA,
    status: "SUSPENDED",
  });
  assert.equal(await countActiveAdmins(tenantA), 1);
  await assert.rejects(() =>
    setMemberStatus({
      operatorId: editorA,
      tenantId: tenantA,
      targetUserId: editorA,
      status: "SUSPENDED",
    }),
  );
  await setMemberStatus({
    operatorId: editorA,
    tenantId: tenantA,
    targetUserId: adminA,
    status: "ACTIVE",
  });

  // Suspend non-admin
  await setMemberStatus({
    operatorId: editorA,
    tenantId: tenantA,
    targetUserId: viewerA,
    status: "SUSPENDED",
  });
  const suspendedUser = await authenticateUser(`viewer-a-${stamp}@ex.com`, "Phase2pass!");
  assert.ok(suspendedUser);
  assert.equal(await sessionFromUser(suspendedUser!, tenantA), null);
  await setMemberStatus({
    operatorId: editorA,
    tenantId: tenantA,
    targetUserId: viewerA,
    status: "ACTIVE",
  });

  // Remove membership keeps user
  const doomed = await makeUser(`doomed-${stamp}@ex.com`, tenantA, "VIEWER");
  await removeMember({
    operatorId: editorA,
    tenantId: tenantA,
    targetUserId: doomed,
  });
  const [stillUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, doomed));
  assert.ok(stillUser);
  assert.equal(await resolveActiveMembership(doomed, tenantA), null);

  // Multi-workspace: adminA as VIEWER on B (adminA may be ADMIN again on A)
  const userA = await authenticateUser(`admin-a-${stamp}@ex.com`, "Phase2pass!");
  const sessB = await sessionFromUser(userA!, tenantB);
  assert.equal(sessB?.role, "VIEWER");
  assert.equal(sessB?.activeTenantId, tenantB);
  assert.equal(hasPermission(sessB!.role, "manage_users"), false);

  // Workspace timezone update fields exist
  await db
    .update(schema.tenants)
    .set({
      timezone: "Africa/Maputo",
      name: `Renamed ${stamp}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.tenants.id, tenantA));
  const [t] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantA));
  assert.equal(t?.timezone, "Africa/Maputo");

  // Cross-tenant membership ops denied (adminB has no ADMIN membership on A)
  await assert.rejects(
    () =>
      changeMemberRole({
        operatorId: adminB,
        operatorRole: "ADMIN",
        tenantId: tenantA,
        targetUserId: viewerA,
        role: "VIEWER",
      }),
    (e: unknown) => e instanceof MembershipError && e.status === 403,
  );

  console.log("workspace rbac phase 2 tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
