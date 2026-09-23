import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";

export const DEFAULT_TENANT_SLUG = "demo";

export async function createTenant(params: {
  name: string;
  slug: string;
}) {
  const id = crypto.randomUUID();
  await db.insert(tenants).values({
    id,
    name: params.name,
    slug: params.slug.toLowerCase(),
    status: "ACTIVE",
  });
  return id;
}

export async function getTenantById(id: string) {
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  return row ?? null;
}

export async function getTenantBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug.toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function ensureDefaultTenant() {
  const existing = await getTenantBySlug(DEFAULT_TENANT_SLUG);
  if (existing) return existing.id;
  return createTenant({ name: "Demo Organization", slug: DEFAULT_TENANT_SLUG });
}
