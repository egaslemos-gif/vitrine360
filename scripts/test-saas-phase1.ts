/**
 * Phase 1 identity, membership, workspace session, and Google claim checks.
 * OAuth provider calls are not made. ID tokens are signed with a local key.
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet, jwtVerify } from "jose";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const { hashPassword, authenticateUser, createSessionToken, sessionFromUser } =
    await import("../src/lib/auth");
  const { getAuthSecretString } = await import("../src/lib/auth");
  const {
    createMembership,
    resolveActiveMembership,
    getMembership,
  } = await import("../src/services/memberships");
  const { hasPermission } = await import("../src/domain/types");
  const {
    assertGoogleIdentityClaims,
    createOAuthTransaction,
    readOAuthCookie,
    signOAuthCookie,
    verifyGoogleIdToken,
    GOOGLE_SCOPES,
  } = await import("../src/lib/google-oauth");
  const { findGoogleIdentity, linkGoogleIdentity, loginWithGoogleClaims } =
    await import("../src/services/google-identity");
  const { listContents, createContent } = await import("../src/services/contents");

  assert.equal(GOOGLE_SCOPES, "openid email profile");
  assert.ok(!GOOGLE_SCOPES.includes("drive"));

  const stamp = Date.now().toString(36);
  const tenantA = await createTenant({ name: `WS A ${stamp}`, slug: `ws-a-${stamp}` });
  const tenantB = await createTenant({ name: `WS B ${stamp}`, slug: `ws-b-${stamp}` });
  const passwordHash = await hashPassword("Phase1pass!");
  const userId = crypto.randomUUID();
  await db.insert(schema.users).values({
    id: userId,
    email: `phase1-${stamp}@example.com`,
    name: "Phase One",
    passwordHash,
    role: "VIEWER",
    tenantId: tenantA,
  });
  const membershipA = await createMembership({ userId, tenantId: tenantA, role: "ADMIN" });
  await db
    .update(schema.memberships)
    .set({ createdAt: "2000-01-01 00:00:00" })
    .where(eq(schema.memberships.id, membershipA));
  await createMembership({ userId, tenantId: tenantB, role: "EDITOR" });

  await assert.rejects(() =>
    db.insert(schema.memberships).values({
      id: crypto.randomUUID(),
      userId,
      tenantId: tenantA,
      role: "VIEWER",
      status: "ACTIVE",
    }),
  );

  const passwordUser = await authenticateUser(`phase1-${stamp}@example.com`, "Phase1pass!");
  assert.ok(passwordUser);
  assert.equal(passwordUser?.id, userId);

  const home = await sessionFromUser(passwordUser!);
  assert.ok(home);
  assert.equal(home?.activeTenantId, tenantA);
  assert.equal(home?.role, "ADMIN");
  assert.notEqual(home?.role, passwordUser?.role);

  const switched = await sessionFromUser(passwordUser!, tenantB);
  assert.equal(switched?.activeTenantId, tenantB);
  assert.equal(switched?.role, "EDITOR");
  assert.equal(await sessionFromUser(passwordUser!, crypto.randomUUID()), null);

  const token = await createSessionToken(switched!);
  const verified = await jwtVerify(
    token,
    new TextEncoder().encode(getAuthSecretString()),
  );
  assert.equal(verified.payload.activeTenantId, tenantB);
  assert.equal(verified.payload.role, "EDITOR");
  assert.equal(verified.payload.sub, userId);

  const stranger = crypto.randomUUID();
  await db.insert(schema.users).values({
    id: stranger,
    email: `stranger-${stamp}@example.com`,
    name: "Stranger",
    passwordHash,
    role: "ADMIN",
    tenantId: tenantB,
  });
  await createMembership({ userId: stranger, tenantId: tenantB, role: "ADMIN" });
  assert.equal(await getMembership(stranger, tenantA), null);
  assert.equal(await resolveActiveMembership(stranger, tenantA), null);

  const invitedId = crypto.randomUUID();
  await db.insert(schema.users).values({
    id: invitedId,
    email: `invited-${stamp}@example.com`,
    name: "Invited",
    passwordHash,
    role: "VIEWER",
    tenantId: tenantA,
  });
  await createMembership({
    userId: invitedId,
    tenantId: tenantA,
    role: "VIEWER",
    status: "INVITED",
  });
  const invitedUser = await authenticateUser(`invited-${stamp}@example.com`, "Phase1pass!");
  assert.equal(await sessionFromUser(invitedUser!), null);

  const suspendedId = crypto.randomUUID();
  await db.insert(schema.users).values({
    id: suspendedId,
    email: `suspended-${stamp}@example.com`,
    name: "Suspended",
    passwordHash,
    role: "ADMIN",
    tenantId: tenantA,
  });
  await createMembership({
    userId: suspendedId,
    tenantId: tenantA,
    role: "ADMIN",
    status: "SUSPENDED",
  });
  const suspendedUser = await authenticateUser(`suspended-${stamp}@example.com`, "Phase1pass!");
  assert.equal(await sessionFromUser(suspendedUser!), null);

  await createContent(
    { type: "TEXT", title: "Only A", durationMs: 5000, payload: { body: "a" }, status: "ACTIVE" },
    tenantA,
  );
  const visibleToB = await listContents(tenantB);
  assert.ok(!visibleToB.some((row) => row.title === "Only A"));

  assert.equal(hasPermission("VIEWER", "manage_devices"), false);
  assert.equal(hasPermission("SUPER_ADMIN", "manage_users"), true);
  assert.equal(hasPermission("ADMIN", "manage_users"), true);
  assert.notEqual(
    (await sessionFromUser(passwordUser!, tenantA))?.role,
    "SUPER_ADMIN",
  );

  const transaction = createOAuthTransaction();
  const signed = await signOAuthCookie(transaction);
  const readBack = await readOAuthCookie(signed);
  assert.equal(readBack?.state, transaction.state);
  assert.notEqual(readBack?.state, "tampered");
  assert.equal(await readOAuthCookie("not-a-token"), null);

  assert.throws(
    () =>
      assertGoogleIdentityClaims(
        {
          iss: "https://accounts.google.com",
          aud: "client",
          sub: "sub-1",
          email: "a@example.com",
          email_verified: false,
          nonce: "n",
        },
        { clientId: "client", nonce: "n" },
      ),
    /email_unverified/,
  );
  assert.throws(
    () =>
      assertGoogleIdentityClaims(
        {
          iss: "https://evil.example",
          aud: "client",
          sub: "sub-1",
          email: "a@example.com",
          email_verified: true,
          nonce: "n",
        },
        { clientId: "client", nonce: "n" },
      ),
    /invalid_issuer/,
  );

  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "phase1";
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const idToken = await new SignJWT({
    email: `new-${stamp}@example.com`,
    email_verified: true,
    name: "New Google",
    nonce: "nonce-1",
  })
    .setProtectedHeader({ alg: "RS256", kid: "phase1" })
    .setIssuer("https://accounts.google.com")
    .setAudience("test-client")
    .setSubject(`google-sub-${stamp}`)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  const claims = await verifyGoogleIdToken(
    idToken,
    { clientId: "test-client", nonce: "nonce-1" },
    jwks,
  );
  const created = await loginWithGoogleClaims(claims);
  assert.equal(created.kind, "created");
  if (created.kind !== "created") throw new Error("expected created");
  const again = await loginWithGoogleClaims(claims);
  assert.equal(again.kind, "session");
  const [createdUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, created.userId));
  const membershipsForNew = await db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, created.userId));
  assert.equal(membershipsForNew.length, 1);
  assert.equal(membershipsForNew[0]?.role, "ADMIN");
  assert.equal(createdUser?.tenantId, created.tenantId);

  const linkAttempt = await loginWithGoogleClaims({
    sub: `other-sub-${stamp}`,
    email: `phase1-${stamp}@example.com`,
    emailVerified: true,
    name: "Phase One",
  });
  assert.equal(linkAttempt.kind, "link_required");
  await linkGoogleIdentity({
    userId,
    claims: {
      sub: `other-sub-${stamp}`,
      email: `phase1-${stamp}@example.com`,
      emailVerified: true,
      name: "Phase One",
    },
  });
  const linked = await findGoogleIdentity(`other-sub-${stamp}`);
  assert.equal(linked?.userId, userId);
  await assert.rejects(() =>
    linkGoogleIdentity({
      userId: stranger,
      claims: {
        sub: `other-sub-${stamp}`,
        email: `stranger-${stamp}@example.com`,
        emailVerified: true,
        name: "Stranger",
      },
    }),
  );

  const superId = crypto.randomUUID();
  await db.insert(schema.users).values({
    id: superId,
    email: `super-${stamp}@example.com`,
    name: "Super",
    passwordHash,
    role: "SUPER_ADMIN",
    tenantId: tenantA,
  });
  await createMembership({ userId: superId, tenantId: tenantA, role: "SUPER_ADMIN" });
  const superUser = await authenticateUser(`super-${stamp}@example.com`, "Phase1pass!");
  const superSession = await sessionFromUser(superUser!, tenantA);
  assert.equal(superSession?.role, "SUPER_ADMIN");
  assert.equal(await sessionFromUser(superUser!, tenantB), null);
  assert.equal(
    await db
      .select()
      .from(schema.memberships)
      .where(and(eq(schema.memberships.userId, superId), eq(schema.memberships.tenantId, tenantB)))
      .then((rows) => rows.length),
    0,
  );

  console.log("saas phase 1 tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
