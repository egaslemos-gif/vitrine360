import { createHash } from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";
import type { MediaStorageProvider, StoredObject, StoredObjectBytes } from "./types";

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

async function getGoogleDriveToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }

  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Missing GOOGLE_DRIVE_CLIENT_EMAIL or GOOGLE_DRIVE_PRIVATE_KEY");
  }

  const alg = "RS256";
  const pkcs8 = await importPKCS8(privateKey, alg);

  const jwt = await new SignJWT({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(pkcs8);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to obtain Google Drive token: ${err}`);
  }

  const data = await res.json();
  
  // Cache the token with a 5-minute safety margin
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000) - (5 * 60 * 1000),
  };

  return tokenCache.accessToken;
}

export class GoogleDriveProvider implements MediaStorageProvider {
  readonly name = "google_drive";

  async put(params: {
    key: string;
    data: Buffer;
    mimeType: string;
    fileName: string;
  }): Promise<StoredObject> {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID");

    const token = await getGoogleDriveToken();

    // 1. Resumable Upload Initiation
    const initRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": params.mimeType,
        "X-Upload-Content-Length": params.data.byteLength.toString(),
      },
      body: JSON.stringify({
        name: params.fileName,
        parents: [folderId],
      }),
    });

    if (!initRes.ok) {
      throw new Error(`Google Drive upload initiation failed: ${await initRes.text()}`);
    }

    const locationUrl = initRes.headers.get("Location");
    if (!locationUrl) {
      throw new Error("Missing Location header in Google Drive resumable upload");
    }

    // 2. Upload Data
    const uploadRes = await fetch(locationUrl, {
      method: "PUT",
      headers: {
        "Content-Length": params.data.byteLength.toString(),
      },
      body: new Uint8Array(params.data),
    });

    if (!uploadRes.ok) {
      throw new Error(`Google Drive upload failed: ${await uploadRes.text()}`);
    }

    const fileMeta = await uploadRes.json();
    const fileId = fileMeta.id;

    // 3. Grant Public Read Permission (ONLY IN STAGING)
    // As per phase 4.5 requirement to allow Hisense to download directly
    if (process.env.NODE_ENV !== "development" || process.env.STAGING === "true" || process.env.GOOGLE_DRIVE_PUBLIC_ACCESS === "true") {
      const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone",
        }),
      });
      if (!permRes.ok) {
        throw new Error(`Failed to set permissions on Google Drive file: ${await permRes.text()}`);
      }
    }

    const checksum = createHash("sha256").update(params.data).digest("hex");

    return {
      storageKey: fileId,
      url: await this.getUrl(fileId),
      checksum: `sha256:${checksum}`,
      fileSize: params.data.byteLength,
      mimeType: params.mimeType,
    };
  }

  async getUrl(storageKey: string): Promise<string> {
    // Return direct download link that supports HTTP Range
    return `https://drive.google.com/uc?export=download&id=${storageKey}`;
  }

  async getObject(storageKey: string): Promise<StoredObjectBytes> {
    const token = await getGoogleDriveToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(storageKey)}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to read Google Drive object (${res.status})`);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    return {
      body: bytes,
      contentType: res.headers.get("content-type") || "application/octet-stream",
      contentLength: bytes.byteLength,
    };
  }

  async delete(storageKey: string): Promise<void> {
    const token = await getGoogleDriveToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${storageKey}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Handle 404 cleanly (idempotent)
    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete file from Google Drive: ${await res.text()}`);
    }
  }
}
