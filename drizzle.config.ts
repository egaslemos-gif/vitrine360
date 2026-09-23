import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

function resolveSqliteUrl() {
  const raw =
    process.env.DATABASE_URL ??
    process.env.TURSO_DATABASE_URL ??
    "file:./data/vitrine360.db";
  if (!raw.startsWith("file:")) return raw;
  const filePath = raw.replace(/^file:/, "");
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  // libsql on Windows prefers forward slashes / absolute file URL
  return `file:${absolute.replace(/\\/g, "/")}`;
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: resolveSqliteUrl(),
    token: process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN,
  },
});
