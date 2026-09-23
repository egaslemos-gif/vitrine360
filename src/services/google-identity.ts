import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { tenants, userIdentities, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import type { GoogleIdentityClaims } from "@/lib/google-oauth";
import { createMembership } from "@/services/memberships";
import { logActivity } from "@/services/activity-log";

export type GoogleLoginResult =
  | { kind: "session"; userId: string }
  | { kind: "link_required"; email: string }
  | { kind: "created"; userId: string; tenantId: string };

export async function findGoogleIdentity(providerAccountId: string) {
  await ensureSchema();
  const [row] = await db
    .select()
    .from(userIdentities)
    .where(
      and(
        eq(userIdentities.provider, "google"),
        eq(userIdentities.providerAccountId, providerAccountId),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function uniqueSlug(base: string) {
  const cleaned = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? cleaned.slice(0, 40) : `${cleaned.slice(0, 32)}-${randomBytes(2).toString("hex")}`;
    const [existing] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);
    if (!existing) return slug;
  }
  return `${cleaned.slice(0, 24)}-${randomBytes(4).toString("hex")}`;
}

export async function loginWithGoogleClaims(
  claims: GoogleIdentityClaims,
): Promise<GoogleLoginResult> {
  await ensureSchema();
  const existing = await findGoogleIdentity(claims.sub);
  if (existing) {
    await logActivity({
      userId: existing.userId,
      action: "LOGIN_GOOGLE",
      resource: "user",
      resourceId: existing.userId,
    });
    return { kind: "session", userId: existing.userId };
  }

  const matches = await db
    .select()
    .from(users)
    .where(eq(users.email, claims.email))
    .limit(5);
  if (matches.length > 0) {
    return { kind: "link_required", email: claims.email };
  }

  const userId = crypto.randomUUID();
  const tenantId = crypto.randomUUID();
  const slug = await uniqueSlug(claims.email.split("@")[0] || "workspace");
  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  await db.insert(tenants).values({
    id: tenantId,
    name: `${claims.name.split(/\s+/)[0] || "Novo"} Workspace`,
    slug,
    status: "ACTIVE",
  });
  await db.insert(users).values({
    id: userId,
    email: claims.email,
    name: claims.name,
    passwordHash,
    role: "ADMIN",
    tenantId,
  });
  await createMembership({ userId, tenantId, role: "ADMIN", status: "ACTIVE" });
  await db.insert(userIdentities).values({
    id: crypto.randomUUID(),
    userId,
    provider: "google",
    providerAccountId: claims.sub,
    email: claims.email,
  });
  await logActivity({
    userId,
    tenantId,
    action: "LOGIN_GOOGLE",
    resource: "user",
    resourceId: userId,
  });
  return { kind: "created", userId, tenantId };
}

export async function linkGoogleIdentity(params: {
  userId: string;
  claims: GoogleIdentityClaims;
}) {
  await ensureSchema();
  const taken = await findGoogleIdentity(params.claims.sub);
  if (taken && taken.userId !== params.userId) {
    throw new Error("identity_taken");
  }
  if (taken) return taken.id;
  const id = crypto.randomUUID();
  await db.insert(userIdentities).values({
    id,
    userId: params.userId,
    provider: "google",
    providerAccountId: params.claims.sub,
    email: params.claims.email,
  });
  await logActivity({
    userId: params.userId,
    action: "ACCOUNT_LINK",
    resource: "user_identity",
    resourceId: id,
    metadata: { provider: "google" },
  });
  return id;
}
