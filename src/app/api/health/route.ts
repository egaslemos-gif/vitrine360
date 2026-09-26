import { NextResponse } from "next/server";
import { isEntitlementsEnabled } from "@/lib/entitlements-flag";

/**
 * Safe deployment identity probe for PI-10P Preview verification.
 * Returns hostname only — never tokens/secrets.
 */
export async function GET() {
  const raw =
    process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "";
  let databaseHost = "unset";
  try {
    if (raw.startsWith("libsql://") || raw.startsWith("https://")) {
      databaseHost = new URL(raw.replace(/^libsql:/, "https:")).host;
    } else if (raw.startsWith("file:")) {
      databaseHost = "file-local";
    }
  } catch {
    databaseHost = "parse-error";
  }

  const bucket = process.env.R2_BUCKET_NAME || "unset";
  const provider = process.env.MEDIA_STORAGE_PROVIDER || "unset";

  return NextResponse.json({
    ok: true,
    environmentHint: process.env.VERCEL_ENV || "local",
    entitlementsEnabled: isEntitlementsEnabled(),
    databaseHost,
    r2BucketName: bucket,
    mediaStorageProvider: provider,
  });
}
