/**
 * AES-256-GCM encryption for Google Drive refresh tokens at rest.
 * Key: DRIVE_TOKEN_ENCRYPTION_KEY (base64, 32 bytes) or HKDF(AUTH_SECRET).
 * Ciphertext format: v1:<iv_b64url>:<tag_b64url>:<ct_b64url>
 */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { getAuthSecretString } from "@/lib/auth";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN = 32;

function resolveKeyBytes(): Buffer {
  const raw = process.env.DRIVE_TOKEN_ENCRYPTION_KEY?.trim();
  if (raw) {
    const fromB64 = Buffer.from(raw, "base64");
    if (fromB64.byteLength === KEY_LEN) return fromB64;
    const fromHex = Buffer.from(raw, "hex");
    if (fromHex.byteLength === KEY_LEN) return fromHex;
    throw new Error("DRIVE_TOKEN_ENCRYPTION_KEY must be 32 bytes (base64 or hex)");
  }
  // Derive from AUTH_SECRET — stable per deployment, rotatable by changing AUTH_SECRET
  // (requires reconnect of Drive after rotation).
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(getAuthSecretString(), "utf8"),
      Buffer.alloc(0),
      Buffer.from("v360-drive-token-v1", "utf8"),
      KEY_LEN,
    ),
  );
}

export function encryptDriveSecret(plaintext: string): string {
  const key = resolveKeyBytes();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(":");
}

export function decryptDriveSecret(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid drive token ciphertext");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const key = resolveKeyBytes();
  const decipher = createDecipheriv(
    ALGO,
    key,
    Buffer.from(ivB64!, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64!, "base64url"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(ctB64!, "base64url")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/** Fingerprint for logs — never log the token. */
export function driveTokenFingerprint(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex").slice(0, 12);
}
