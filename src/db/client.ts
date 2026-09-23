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
    })();
  }
  return schemaReady;
}

export const db = drizzle(client, { schema });
export { schema };
