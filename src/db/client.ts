import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import fs from "node:fs";
import path from "node:path";

function resolveDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.TURSO_DATABASE_URL ??
    "file:./data/vitrine360.db";
  if (url.startsWith("file:")) {
    const filePath = url.replace(/^file:/, "");
    const absolute = path.isAbsolute(filePath)
      ? filePath
      : path.join(/*turbopackIgnore: true*/ process.cwd(), filePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    return `file:${absolute.replace(/\\/g, "/")}`;
  }
  return url;
}

const client = createClient({ 
  url: resolveDatabaseUrl(),
  authToken: process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN,
});

let schemaReady: Promise<void> | null = null;

/**
 * Idempotent guard for columns added after some environments were deployed.
 * Keeps pilot environments self-healing when a migration has not reached the
 * database that the running deployment actually points to.
 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        await client.execute(
          "ALTER TABLE playlist_items ADD COLUMN fit_mode text NOT NULL DEFAULT 'black'",
        );
      } catch (err) {
        if (!String(err).toLowerCase().includes("duplicate column")) {
          throw err;
        }
      }
      try {
        await client.execute(
          "ALTER TABLE devices ADD COLUMN effective_playback_key text",
        );
      } catch (err) {
        if (!String(err).toLowerCase().includes("duplicate column")) {
          throw err;
        }
      }
      await client.execute(`CREATE TABLE IF NOT EXISTS memberships (
        id text PRIMARY KEY NOT NULL,
        user_id text NOT NULL,
        tenant_id text NOT NULL,
        role text NOT NULL,
        status text DEFAULT 'ACTIVE' NOT NULL,
        created_at text DEFAULT (datetime('now')) NOT NULL,
        updated_at text DEFAULT (datetime('now')) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE cascade
      )`);
      await client.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS memberships_user_tenant_uidx ON memberships (user_id, tenant_id)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (user_id)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS memberships_tenant_idx ON memberships (tenant_id)",
      );
      await client.execute(`CREATE TABLE IF NOT EXISTS user_identities (
        id text PRIMARY KEY NOT NULL,
        user_id text NOT NULL,
        provider text NOT NULL,
        provider_account_id text NOT NULL,
        email text NOT NULL,
        created_at text DEFAULT (datetime('now')) NOT NULL,
        updated_at text DEFAULT (datetime('now')) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade
      )`);
      await client.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS user_identities_provider_account_uidx ON user_identities (provider, provider_account_id)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS user_identities_user_idx ON user_identities (user_id)",
      );
      await client.execute(`INSERT OR IGNORE INTO memberships (id, user_id, tenant_id, role, status, created_at, updated_at)
        SELECT id || ':home', id, tenant_id, role, 'ACTIVE', created_at, updated_at FROM users`);
      // PLATFORM-IDENTITY-04 — additive only; never backfills from memberships
      await client.execute(`CREATE TABLE IF NOT EXISTS platform_assignments (
        id text PRIMARY KEY NOT NULL,
        user_id text NOT NULL,
        role text NOT NULL,
        status text DEFAULT 'ACTIVE' NOT NULL,
        created_by_user_id text,
        created_at text DEFAULT (datetime('now')) NOT NULL,
        updated_at text DEFAULT (datetime('now')) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE set null
      )`);
      await client.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS platform_assignments_user_role_uidx ON platform_assignments (user_id, role)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS platform_assignments_user_idx ON platform_assignments (user_id)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS platform_assignments_status_idx ON platform_assignments (status)",
      );

      // PLATFORM-IDENTITY-10B — entitlements foundation (additive; no enforcement)
      await client.execute(`CREATE TABLE IF NOT EXISTS entitlement_definitions (
        id text PRIMARY KEY NOT NULL,
        key text NOT NULL,
        name text NOT NULL,
        description text,
        value_type text NOT NULL,
        enforcement_type text NOT NULL,
        active integer DEFAULT 1 NOT NULL,
        created_at text DEFAULT (datetime('now')) NOT NULL,
        updated_at text DEFAULT (datetime('now')) NOT NULL
      )`);
      await client.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS entitlement_definitions_key_uidx ON entitlement_definitions (key)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS entitlement_definitions_active_idx ON entitlement_definitions (active)",
      );
      await client.execute(`CREATE TABLE IF NOT EXISTS plans (
        id text PRIMARY KEY NOT NULL,
        key text NOT NULL,
        name text NOT NULL,
        description text,
        active integer DEFAULT 1 NOT NULL,
        created_at text DEFAULT (datetime('now')) NOT NULL,
        updated_at text DEFAULT (datetime('now')) NOT NULL
      )`);
      await client.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS plans_key_uidx ON plans (key)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS plans_active_idx ON plans (active)",
      );
      await client.execute(`CREATE TABLE IF NOT EXISTS plan_entitlements (
        id text PRIMARY KEY NOT NULL,
        plan_id text NOT NULL,
        entitlement_definition_id text NOT NULL,
        value text NOT NULL,
        created_at text DEFAULT (datetime('now')) NOT NULL,
        updated_at text DEFAULT (datetime('now')) NOT NULL,
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE restrict,
        FOREIGN KEY (entitlement_definition_id) REFERENCES entitlement_definitions(id) ON DELETE restrict
      )`);
      await client.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS plan_entitlements_plan_def_uidx ON plan_entitlements (plan_id, entitlement_definition_id)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS plan_entitlements_plan_idx ON plan_entitlements (plan_id)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS plan_entitlements_def_idx ON plan_entitlements (entitlement_definition_id)",
      );
      await client.execute(`CREATE TABLE IF NOT EXISTS tenant_plans (
        id text PRIMARY KEY NOT NULL,
        tenant_id text NOT NULL,
        plan_id text NOT NULL,
        status text DEFAULT 'ACTIVE' NOT NULL,
        starts_at text DEFAULT (datetime('now')) NOT NULL,
        ends_at text,
        created_at text DEFAULT (datetime('now')) NOT NULL,
        updated_at text DEFAULT (datetime('now')) NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE cascade,
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE restrict
      )`);
      await client.execute(
        "CREATE INDEX IF NOT EXISTS tenant_plans_tenant_idx ON tenant_plans (tenant_id)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS tenant_plans_plan_idx ON tenant_plans (plan_id)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS tenant_plans_status_idx ON tenant_plans (status)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS tenant_plans_tenant_status_idx ON tenant_plans (tenant_id, status)",
      );

      // PLATFORM-IDENTITY-10I — storage reservation foundation (additive; no enforcement)
      await client.execute(`CREATE TABLE IF NOT EXISTS storage_reservations (
        id text PRIMARY KEY NOT NULL,
        tenant_id text NOT NULL,
        operation_id text NOT NULL,
        expected_bytes integer NOT NULL,
        status text DEFAULT 'RESERVED' NOT NULL,
        created_at text DEFAULT (datetime('now')) NOT NULL,
        expires_at text,
        committed_at text,
        released_at text,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE cascade
      )`);
      await client.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS storage_reservations_tenant_operation_uidx ON storage_reservations (tenant_id, operation_id)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS storage_reservations_tenant_idx ON storage_reservations (tenant_id)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS storage_reservations_tenant_status_idx ON storage_reservations (tenant_id, status)",
      );
      await client.execute(`CREATE TABLE IF NOT EXISTS device_command_inbox (
        id text PRIMARY KEY NOT NULL,
        command_id text NOT NULL,
        tenant_id text NOT NULL,
        device_id text NOT NULL,
        session_id text,
        binding text DEFAULT 'SESSION_BOUND' NOT NULL,
        type text NOT NULL,
        payload text DEFAULT '{}' NOT NULL,
        issued_at integer NOT NULL,
        expires_at integer NOT NULL,
        status text DEFAULT 'QUEUED' NOT NULL,
        result_status text,
        result_reason text,
        attempts integer DEFAULT 0 NOT NULL,
        available_at integer NOT NULL,
        claimed_at integer,
        lease_until integer,
        correlation_id text,
        created_at text DEFAULT (datetime('now')) NOT NULL,
        updated_at text DEFAULT (datetime('now')) NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE cascade,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE cascade
      )`);
      await client.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS device_command_inbox_command_id_uidx ON device_command_inbox (command_id)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS device_command_inbox_tenant_device_status_idx ON device_command_inbox (tenant_id, device_id, status)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS device_command_inbox_device_status_available_idx ON device_command_inbox (device_id, status, available_at)",
      );
      await client.execute(
        "CREATE INDEX IF NOT EXISTS device_command_inbox_expires_idx ON device_command_inbox (expires_at)",
      );
      // PI-10L: diagnose duplicates → create unique only when safe; never mask as OK
      const { ensureMediaChecksumUniqueIntegrity } = await import(
        "@/services/media-checksum-integrity"
      );
      const checksumIntegrity = await ensureMediaChecksumUniqueIntegrity();
      if (checksumIntegrity.status !== "OK") {
        console.warn(
          "[ensureSchema] checksum unique integrity:",
          checksumIntegrity.status,
          checksumIntegrity.detail ?? "",
        );
      }
    })();
  }
  return schemaReady;
}

export const db = drizzle(client, { schema });
export { schema, client };

/**
 * Drizzle transaction handle (libsql `client.transaction()` → BEGIN IMMEDIATE).
 * COUNT + mutation MUST use this same handle — bare BEGIN/COMMIT via
 * client.execute does not hold the connection and is not atomic with drizzle.
 */
export type AllocationTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Per-tenant async mutex (in-process) + drizzle write transaction
 * (SQLite BEGIN IMMEDIATE via libsql). Serializes quota check + allocation
 * within and across Node processes sharing the same DB file / Turso primary.
 */
const tenantAllocChains = new Map<string, Promise<unknown>>();

export async function withTenantAllocationLock<T>(
  tenantId: string,
  fn: (tx: AllocationTx) => Promise<T>,
): Promise<T> {
  const prev = tenantAllocChains.get(tenantId) ?? Promise.resolve();
  let release!: () => void;
  const hold = new Promise<void>((r) => {
    release = r;
  });
  const tail = prev.then(() => hold);
  tenantAllocChains.set(tenantId, tail);
  await prev;
  try {
    return await db.transaction(async (tx) => fn(tx));
  } finally {
    release();
    if (tenantAllocChains.get(tenantId) === tail) {
      tenantAllocChains.delete(tenantId);
    }
  }
}

/** @deprecated Use withTenantAllocationLock — kept for call-site clarity. */
export async function withImmediateTransaction<T>(
  fn: (tx: AllocationTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => fn(tx));
}
