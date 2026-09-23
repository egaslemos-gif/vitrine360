import { generateKeyPairSync } from "node:crypto";
import assert from "node:assert/strict";
import { GoogleDriveProvider } from "../src/services/media/google-drive-provider";

let originalFetch: typeof global.fetch;

async function runTests() {
  console.log("Starting Google Drive Provider Tests...");

  // Save original fetch
  originalFetch = global.fetch;

  // Generate a dummy valid RSA key
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
  });

  // Mock process.env
  process.env.GOOGLE_DRIVE_CLIENT_EMAIL = "test@example.com";
  process.env.GOOGLE_DRIVE_PRIVATE_KEY = privateKey;
  process.env.GOOGLE_DRIVE_FOLDER_ID = "test-folder-123";
  // process.env.NODE_ENV = "production";
  process.env.STAGING = "true"; // allow public access

  const fetchCalls: { url: string; opts: RequestInit | undefined }[] = [];

  // Implement mock fetch
  global.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString();
    fetchCalls.push({ url, opts: init });

    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({
        access_token: "mock-access-token",
        expires_in: 3600
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (url === "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable" && init?.method === "POST") {
      return new Response("", { status: 200, headers: { Location: "https://www.googleapis.com/upload/resumable/test" } });
    }

    if (url === "https://www.googleapis.com/upload/resumable/test" && init?.method === "PUT") {
      return new Response(JSON.stringify({ id: "mock-file-123" }), { status: 200 });
    }

    if (url === "https://www.googleapis.com/drive/v3/files/mock-file-123/permissions" && init?.method === "POST") {
      return new Response(JSON.stringify({ id: "perm-123" }), { status: 200 });
    }
    
    if (url.startsWith("https://www.googleapis.com/drive/v3/files/") && init?.method === "DELETE") {
      // Simulate 404 if ends with 404
      if (url.endsWith("404")) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(null, { status: 204 });
    }

    return new Response("Not found", { status: 404 });
  };

  const provider = new GoogleDriveProvider();

  console.log("Testing getUrl...");
  const url = await provider.getUrl("mock-file-123");
  assert.equal(url, "https://drive.google.com/uc?export=download&id=mock-file-123");

  console.log("Testing put() - upload sequence & JWT...");
  const stored = await provider.put({
    key: "video.mp4",
    data: Buffer.from("hello world"),
    fileName: "video.mp4",
    mimeType: "video/mp4"
  });
  
  assert.equal(stored.storageKey, "mock-file-123");
  assert.ok(stored.checksum.startsWith("sha256:"));
  assert.equal(stored.fileSize, 11);

  // Validate that the correct endpoints were hit in order
  const callUrls = fetchCalls.map(c => c.url);
  assert.ok(callUrls.includes("https://oauth2.googleapis.com/token"), "Must request token");
  assert.ok(callUrls.includes("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable"), "Must initiate upload");
  assert.ok(callUrls.includes("https://www.googleapis.com/upload/resumable/test"), "Must upload data");
  assert.ok(callUrls.includes("https://www.googleapis.com/drive/v3/files/mock-file-123/permissions"), "Must grant permissions for staging");

  console.log("Testing put() token caching...");
  const oldFetchCount = fetchCalls.length;
  await provider.put({
    key: "img.png",
    data: Buffer.from("img"),
    fileName: "img.png",
    mimeType: "image/png"
  });
  
  const tokenCalls = fetchCalls.slice(oldFetchCount).filter(c => c.url === "https://oauth2.googleapis.com/token");
  assert.equal(tokenCalls.length, 0, "Should use cached token without fetching again");

  console.log("Testing delete() with idempotent 404...");
  await provider.delete("mock-file-123"); // 204 success
  await provider.delete("mock-file-404"); // 404 should not throw

  console.log("Testing missing config...");
  delete process.env.GOOGLE_DRIVE_FOLDER_ID;
  await assert.rejects(
    () => provider.put({ key: "k", data: Buffer.from(""), fileName: "f", mimeType: "text/plain" }),
    /Missing GOOGLE_DRIVE_FOLDER_ID/
  );

  console.log("Google Drive Provider Tests Passed!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
}).finally(() => {
  global.fetch = originalFetch;
});
