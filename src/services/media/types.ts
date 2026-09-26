export interface StoredObject {
  storageKey: string;
  url: string;
  checksum: string;
  fileSize: number;
  mimeType: string;
}

export type StoredObjectBytes = {
  body: Buffer;
  contentType: string;
  contentLength: number;
};

export type PresignedUpload = {
  uploadUrl: string;
  storageKey: string;
  expiresIn: number;
  /** Headers the client MUST send on PUT (signed constraints). */
  requiredHeaders: Record<string, string>;
  /** Exact Content-Length signed into the URL when provider supports it. */
  contentLength: number;
};

export type ObjectHead = {
  contentType?: string;
  contentLength?: number;
};

export interface MediaStorageProvider {
  readonly name: string;
  put(params: {
    key: string;
    data: Buffer;
    mimeType: string;
    fileName: string;
  }): Promise<StoredObject>;
  getUrl(storageKey: string): Promise<string>;
  /** Server-side byte read for device media proxy (avoids fragile presigned fetch). */
  getObject(storageKey: string): Promise<StoredObjectBytes>;
  delete(storageKey: string): Promise<void>;
  /**
   * Browser-direct PUT (R2). Absent on local/Drive.
   * When contentLength is provided, the provider SHOULD sign it so oversized
   * PUTs are rejected at the storage edge (PI-10L). completeMediaUpload remains
   * the authority for final object size via HEAD.
   */
  createUploadUrl?(params: {
    storageKey: string;
    mimeType: string;
    expiresIn?: number;
    /** Exact byte length to bind into the signed PUT (required for R2 hardening). */
    contentLength: number;
  }): Promise<PresignedUpload>;
  headObject?(storageKey: string): Promise<ObjectHead>;
  /** First N bytes for MIME sniff after direct upload. */
  getObjectRange?(storageKey: string, start: number, end: number): Promise<Buffer>;
}
