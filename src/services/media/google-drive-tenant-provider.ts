/**
 * Per-tenant Google Drive provider (OAuth user tokens).
 * Option B: app-created folder under drive.file. Files stay private.
 */
import { createHash } from "node:crypto";
import type {
  MediaStorageProvider,
  ObjectHead,
  StoredObject,
  StoredObjectBytes,
} from "./types";

export type DriveTokenProvider = {
  getAccessToken(): Promise<string>;
  folderId: string;
};

/** Thrown when Drive returns 401/403 — callers must invalidate token cache. */
export class DriveAuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "DriveAuthError";
  }
}

function throwIfAuth(status: number, context: string): void {
  if (status === 401 || status === 403) {
    throw new DriveAuthError(`${context} (${status})`, status);
  }
}

export class GoogleDriveTenantProvider implements MediaStorageProvider {
  readonly name = "google_drive";

  constructor(private readonly auth: DriveTokenProvider) {}

  async put(params: {
    key: string;
    data: Buffer;
    mimeType: string;
    fileName: string;
  }): Promise<StoredObject> {
    const token = await this.auth.getAccessToken();
    const folderId = this.auth.folderId;
    if (!folderId) throw new Error("Tenant Drive folder not configured");

    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": params.mimeType,
          "X-Upload-Content-Length": String(params.data.byteLength),
        },
        body: JSON.stringify({
          name: params.fileName,
          parents: [folderId],
          appProperties: { v360: "1", storageKey: params.key },
        }),
      },
    );
    throwIfAuth(initRes.status, "Drive upload init auth failed");
    if (!initRes.ok) {
      throw new Error(
        `Drive upload init failed: ${await initRes.text()}`.slice(0, 300),
      );
    }
    const locationUrl = initRes.headers.get("Location");
    if (!locationUrl) throw new Error("Missing Drive resumable Location");

    const uploadRes = await fetch(locationUrl, {
      method: "PUT",
      headers: { "Content-Length": String(params.data.byteLength) },
      body: new Uint8Array(params.data),
    });
    if (!uploadRes.ok) {
      throw new Error(
        `Drive upload failed: ${await uploadRes.text()}`.slice(0, 300),
      );
    }
    const fileMeta = (await uploadRes.json()) as { id: string };
    const checksum = createHash("sha256").update(params.data).digest("hex");

    return {
      storageKey: fileMeta.id,
      url: `/api/media/drive/${encodeURIComponent(fileMeta.id)}`,
      checksum: `sha256:${checksum}`,
      fileSize: params.data.byteLength,
      mimeType: params.mimeType,
    };
  }

  async getUrl(storageKey: string): Promise<string> {
    return `/api/media/drive/${encodeURIComponent(storageKey)}`;
  }

  /**
   * Full-object read — only for small probes. Device proxy must prefer getObjectRange.
   * Hard cap avoids accidental OOM on large videos.
   */
  async getObject(storageKey: string): Promise<StoredObjectBytes> {
    const MAX = 2 * 1024 * 1024; // 2 MiB
    const head = await this.headObject(storageKey);
    if (head.contentLength != null && head.contentLength > MAX) {
      throw new Error(
        `Drive getObject refused: object ${head.contentLength} bytes exceeds ${MAX} (use Range)`,
      );
    }
    const token = await this.auth.getAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(storageKey)}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    throwIfAuth(res.status, "Drive getObject auth failed");
    if (!res.ok) {
      throw new Error(`Drive getObject failed (${res.status})`);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength > MAX) {
      throw new Error(
        `Drive getObject refused: downloaded ${bytes.byteLength} exceeds ${MAX}`,
      );
    }
    return {
      body: bytes,
      contentType: res.headers.get("content-type") || "application/octet-stream",
      contentLength: bytes.byteLength,
    };
  }

  async getObjectRange(
    storageKey: string,
    start: number,
    end: number,
  ): Promise<Buffer> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(storageKey)}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Range: `bytes=${start}-${end}`,
        },
        cache: "no-store",
      },
    );
    throwIfAuth(res.status, "Drive range auth failed");
    if (res.status !== 206 && res.status !== 200) {
      throw new Error(`Drive range read failed (${res.status})`);
    }
    const raw = Buffer.from(await res.arrayBuffer());
    const expected = end - start + 1;
    // Defense in depth (C1): if Drive ignores Range and returns from offset 0,
    // extract the requested window. serveDeviceObject also normalizes.
    if (raw.byteLength > expected && raw.byteLength > end) {
      return raw.subarray(start, end + 1);
    }
    if (raw.byteLength > expected) {
      throw new Error(
        `Drive range body length ${raw.byteLength} exceeds requested ${expected}`,
      );
    }
    return raw;
  }

  async headObject(storageKey: string): Promise<ObjectHead> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(storageKey)}?fields=size,mimeType`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    throwIfAuth(res.status, "Drive headObject auth failed");
    if (!res.ok) throw new Error(`Drive headObject failed (${res.status})`);
    const data = (await res.json()) as { size?: string; mimeType?: string };
    return {
      contentLength: data.size ? Number(data.size) : undefined,
      contentType: data.mimeType,
    };
  }

  async delete(storageKey: string): Promise<void> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(storageKey)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 404) return;
    throwIfAuth(res.status, "Drive delete auth failed");
    if (!res.ok) {
      throw new Error(`Drive delete failed: ${await res.text()}`.slice(0, 300));
    }
  }
}

/**
 * Option B — create a dedicated app-owned folder (drive.file compatible).
 * Existing arbitrary folders are NOT supported without Picker (out of scope).
 */
export async function createTenantDriveFolder(params: {
  accessToken: string;
  tenantId: string;
  folderName: string;
}): Promise<{ folderId: string; name: string }> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.folderName,
      mimeType: "application/vnd.google-apps.folder",
      appProperties: {
        v360: "1",
        tenantId: params.tenantId,
      },
    }),
  });
  if (!res.ok) {
    const raw = (await res.text()).slice(0, 400);
    let reason = "";
    try {
      const parsed = JSON.parse(raw) as {
        error?: { errors?: { reason?: string }[]; message?: string };
      };
      reason =
        parsed.error?.errors?.[0]?.reason ||
        parsed.error?.message ||
        "";
    } catch {
      /* keep raw */
    }
    // 403 accessNotConfigured = Drive API disabled in GCP (most common LIVE cause)
    throw new Error(
      `Drive folder create failed (${res.status}${reason ? `:${reason}` : ""}): ${raw}`.slice(
        0,
        280,
      ),
    );
  }
  const data = (await res.json()) as { id?: string; name?: string };
  if (!data.id) throw new Error("Drive folder create returned no id");
  return { folderId: data.id, name: data.name ?? params.folderName };
}

/** Confirm app-created folder is readable/usable before marking CONNECTED. */
export async function verifyDriveFolderAccess(
  accessToken: string,
  folderId: string,
): Promise<{ ok: true; name: string } | { ok: false; reason: string }> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,capabilities`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  if (res.status === 404 || res.status === 403) {
    return {
      ok: false,
      reason:
        "Folder not accessible with drive.file. Only app-created folders are supported (Option B).",
    };
  }
  if (!res.ok) {
    return { ok: false, reason: `Drive files.get failed (${res.status})` };
  }
  const data = (await res.json()) as {
    name?: string;
    mimeType?: string;
  };
  if (data.mimeType !== "application/vnd.google-apps.folder") {
    return { ok: false, reason: "Selected id is not a folder" };
  }
  return { ok: true, name: data.name ?? folderId };
}
