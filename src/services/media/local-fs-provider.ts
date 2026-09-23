import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { MediaStorageProvider, StoredObject, StoredObjectBytes } from "./types";
import { resolveUnderRoot } from "./paths";

export class LocalFsProvider implements MediaStorageProvider {
  readonly name = "local";

  constructor(private readonly rootDir: string) {}

  private resolve(key: string): string {
    return resolveUnderRoot(this.rootDir, key);
  }

  async put(params: {
    key: string;
    data: Buffer;
    mimeType: string;
    fileName: string;
  }): Promise<StoredObject> {
    const filePath = this.resolve(params.key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, params.data);
    const checksum = createHash("sha256").update(params.data).digest("hex");
    return {
      storageKey: params.key,
      url: `/api/media/${params.key.split("/").map(encodeURIComponent).join("/")}`,
      checksum: `sha256:${checksum}`,
      fileSize: params.data.byteLength,
      mimeType: params.mimeType,
    };
  }

  async getUrl(storageKey: string): Promise<string> {
    return `/api/media/${storageKey.split("/").map(encodeURIComponent).join("/")}`;
  }

  async getObject(storageKey: string): Promise<StoredObjectBytes> {
    const data = await fs.readFile(this.resolve(storageKey));
    return {
      body: data,
      contentType: "application/octet-stream",
      contentLength: data.byteLength,
    };
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(storageKey));
    } catch {
      /* ignore missing */
    }
  }
}
