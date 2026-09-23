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
}
