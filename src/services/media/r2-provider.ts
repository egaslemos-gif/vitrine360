import { createHash } from "node:crypto";
import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { MediaStorageProvider, StoredObject, StoredObjectBytes } from "./types";

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (r2Client) return r2Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  let endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
  // Strip trailing bucket name if user accidentally included it in the endpoint URL
  if (endpoint.endsWith(`/${process.env.R2_BUCKET_NAME}`)) {
    endpoint = endpoint.replace(`/${process.env.R2_BUCKET_NAME}`, "");
  }

  if (!accessKeyId || !secretAccessKey || !accountId) {
    throw new Error("Missing R2 credentials: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY");
  }

  r2Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return r2Client;
}

function getBucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing R2_BUCKET_NAME configuration");
  }
  return bucketName;
}

export class R2StorageProvider implements MediaStorageProvider {
  readonly name = "r2";

  async put(params: {
    key: string;
    data: Buffer;
    mimeType: string;
    fileName: string;
  }): Promise<StoredObject> {
    const client = getR2Client();
    const bucket = getBucketName();
    
    // key comes from contents.ts as 'tenantId/id.ext'
    // This inherently creates a logical isolation inside the bucket.
    const storageKey = `tenants/${params.key}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: params.data,
      ContentType: params.mimeType,
      ContentLength: params.data.byteLength,
    });

    try {
      await client.send(command);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Cloudflare R2 upload failed: ${message}`);
    }

    const checksum = createHash("sha256").update(params.data).digest("hex");

    return {
      storageKey,
      url: await this.getUrl(storageKey),
      checksum: `sha256:${checksum}`,
      fileSize: params.data.byteLength,
      mimeType: params.mimeType,
    };
  }

  async getUrl(storageKey: string): Promise<string> {
    const client = getR2Client();
    const bucket = getBucketName();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    });

    // 7 days expiration for presigned URL (maximum allowed by AWS Signature V4)
    // The web player should sync and download the asset via IndexedDB before this expires.
    const expiresIn = 604800; 

    try {
      const url = await getSignedUrl(client, command, { expiresIn });
      return url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to generate R2 presigned URL: ${message}`);
    }
  }

  async getObject(storageKey: string): Promise<StoredObjectBytes> {
    const client = getR2Client();
    const bucket = getBucketName();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    });

    try {
      const out = await client.send(command);
      if (!out.Body) {
        throw new Error("Empty R2 object body");
      }
      const bytes = Buffer.from(await out.Body.transformToByteArray());
      return {
        body: bytes,
        contentType: out.ContentType || "application/octet-stream",
        contentLength: out.ContentLength ?? bytes.byteLength,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read R2 object: ${message}`);
    }
  }

  async delete(storageKey: string): Promise<void> {
    const client = getR2Client();
    const bucket = getBucketName();

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    });

    try {
      await client.send(command);
    } catch (err: unknown) {
      // S3 DeleteObject is idempotent
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to delete object from R2: ${message}`);
    }
  }
}
