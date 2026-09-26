import assert from "node:assert/strict";
import { R2StorageProvider } from "../src/services/media/r2-provider";

// We need to mock @aws-sdk/client-s3 commands.
let lastSentCommand: { input?: Record<string, unknown> } | null = null;
const headObjectMockResponse: Record<string, unknown> = {};

// Mocking AWS modules
import * as S3Module from "@aws-sdk/client-s3";

type SendableCommand = {
  input?: Record<string, unknown>;
};

// Override prototype to intercept calls
(S3Module.S3Client.prototype as unknown as {
  send: (cmd: SendableCommand) => Promise<unknown>;
}).send = async function (cmd: SendableCommand) {
    lastSentCommand = cmd;
    if (cmd instanceof S3Module.HeadObjectCommand) {
      return headObjectMockResponse;
    }
    return {};
  };

// getSignedUrl actually runs completely offline and synchronous-like in AWS SDK v3
// It only requires credentials to exist, which we provide below.


async function runTests() {
  console.log("Starting R2 Provider Unit Tests...");

  console.log("Testing Missing Credentials Error...");
  let errorCaught = false;
  try {
    const errorProvider = new R2StorageProvider();
    await errorProvider.put({
      key: "tenant-1/asset.png",
      data: Buffer.from("dummy"),
      mimeType: "image/png",
      fileName: "asset.png"
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Missing R2 credentials")) {
      errorCaught = true;
    }
  }
  assert.equal(errorCaught, true);

  // Setup environment for testing
  process.env.R2_ACCOUNT_ID = "test-account";
  process.env.R2_ACCESS_KEY_ID = "test-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  process.env.R2_BUCKET_NAME = "test-bucket";

  const provider = new R2StorageProvider();
  
  const dummyBuffer = Buffer.from("test-data");
  
  console.log("Testing put() (Upload)...");
  const stored = await provider.put({
    key: "tenant-1/asset-123.png",
    data: dummyBuffer,
    mimeType: "image/png",
    fileName: "asset-123.png"
  });

  // Verify PutObjectCommand
  assert.equal(lastSentCommand instanceof S3Module.PutObjectCommand, true);
  assert.equal(lastSentCommand?.input?.Bucket, "test-bucket");
  assert.equal(lastSentCommand?.input?.Key, "tenants/tenant-1/asset-123.png");
  assert.equal(lastSentCommand?.input?.ContentType, "image/png");
  
  // Verify StoredObject output
  assert.equal(stored.storageKey, "tenants/tenant-1/asset-123.png");
  assert.equal(stored.url.includes("test-bucket"), true);
  assert.equal(stored.mimeType, "image/png");
  assert.equal(stored.fileSize, dummyBuffer.byteLength);

  console.log("Testing getUrl()...");
  const url = await provider.getUrl("tenants/tenant-1/asset-123.png");
  assert.equal(url.includes("test-bucket"), true);
  assert.equal(url.includes("X-Amz-Signature"), true);

  console.log("Testing createUploadUrl()...");
  const upload = await provider.createUploadUrl({
    storageKey: "tenants/tenant-1/asset-direct.png",
    mimeType: "image/png",
    expiresIn: 900,
    contentLength: 128,
  });
  assert.equal(upload.storageKey, "tenants/tenant-1/asset-direct.png");
  assert.equal(upload.expiresIn, 900);
  assert.equal(upload.contentLength, 128);
  assert.equal(upload.requiredHeaders["Content-Length"], "128");
  assert.equal(upload.uploadUrl.includes("X-Amz-Signature"), true);
  assert.equal(upload.uploadUrl.includes("test-bucket"), true);

  console.log("Testing headObject()...");
  headObjectMockResponse.ContentType = "image/png";
  headObjectMockResponse.ContentLength = 42;
  const head = await provider.headObject("tenants/tenant-1/asset-direct.png");
  assert.equal(lastSentCommand instanceof S3Module.HeadObjectCommand, true);
  assert.equal(head.contentType, "image/png");
  assert.equal(head.contentLength, 42);

  console.log("Testing delete()...");
  await provider.delete("tenants/tenant-1/asset-123.png");
  assert.equal(lastSentCommand instanceof S3Module.DeleteObjectCommand, true);
  assert.equal(lastSentCommand?.input?.Bucket, "test-bucket");
  assert.equal(lastSentCommand?.input?.Key, "tenants/tenant-1/asset-123.png");

  console.log("R2 Provider Unit Tests Passed! ✅");
}

runTests().catch(console.error);
