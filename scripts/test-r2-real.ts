import "dotenv/config"; // fallback
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createHash } from "node:crypto";
import { R2StorageProvider } from "../src/services/media/r2-provider";

async function runTests() {
  console.log("Starting Real R2 Provider Integration Test...");

  const missing = [];
  if (!process.env.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!process.env.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!process.env.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (!process.env.R2_BUCKET_NAME) missing.push("R2_BUCKET_NAME");

  if (missing.length > 0) {
    console.error(`Missing required environment variables: \n${missing.join("\n")}`);
    console.log("Please run this script with the real credentials to execute the final STAGING real test.");
    process.exit(1);
  }

  const provider = new R2StorageProvider();

  try {
    // 1. Upload Test Image
    console.log("\n[1/5] Uploading test image...");
    const imageBuffer = Buffer.from("fake-image-content-for-test");
    const imageUpload = await provider.put({
      key: "test-tenant/test-image.png",
      data: imageBuffer,
      fileName: "test-image.png",
      mimeType: "image/png"
    });
    console.log(`Image uploaded successfully. StorageKey: ${imageUpload.storageKey}`);

    // 2. Upload Test Video
    console.log("\n[2/5] Uploading test video...");
    const videoBuffer = Buffer.alloc(5000, "a"); // 5000 bytes
    const videoUpload = await provider.put({
      key: "test-tenant/test-video.mp4",
      data: videoBuffer,
      fileName: "test-video.mp4",
      mimeType: "video/mp4"
    });
    console.log(`Video uploaded successfully. StorageKey: ${videoUpload.storageKey}`);

    // 3. Download and Checksum Image
    console.log("\n[3/5] Testing Image GET & Checksum...");
    const imgRes = await fetch(imageUpload.url);
    if (!imgRes.ok) throw new Error(`Image download failed with status ${imgRes.status}`);
    const imgData = Buffer.from(await imgRes.arrayBuffer());
    const imgChecksum = "sha256:" + createHash("sha256").update(imgData).digest("hex");
    if (imgChecksum !== imageUpload.checksum) {
      throw new Error(`Checksum mismatch for image! Expected ${imageUpload.checksum}, got ${imgChecksum}`);
    }
    console.log("Image Checksum matched perfectly.");

    // 4. Test Video HEAD and Range GET
    console.log("\n[4/5] Testing HTTP Range on Video...");
    const headRes = await fetch(videoUpload.url, { method: "HEAD" });
    console.log(`HEAD Status: ${headRes.status}`);
    console.log(`HEAD Content-Length: ${headRes.headers.get("content-length")}`);
    console.log(`HEAD Content-Type: ${headRes.headers.get("content-type")}`);
    console.log(`HEAD Accept-Ranges: ${headRes.headers.get("accept-ranges")}`);

    const rangeRes = await fetch(videoUpload.url, {
      headers: {
        "Range": "bytes=0-1023" // request first 1024 bytes
      }
    });
    console.log(`Range GET Status: ${rangeRes.status}`);
    console.log(`Range GET Content-Range: ${rangeRes.headers.get("content-range")}`);
    console.log(`Range GET Content-Length: ${rangeRes.headers.get("content-length")}`);
    
    if (rangeRes.status !== 206) {
      console.error("WARNING: Range request did NOT return 206 Partial Content. This may break video streaming on Hisense!");
    } else {
      console.log("Range request successfully returned 206 Partial Content.");
      const rangeData = Buffer.from(await rangeRes.arrayBuffer());
      console.log(`Downloaded chunk size: ${rangeData.byteLength} bytes.`);
    }

    // 5. Delete Assets
    console.log("\n[5/5] Cleaning up resources from R2...");
    await provider.delete(imageUpload.storageKey);
    console.log("Image deleted.");
    await provider.delete(videoUpload.storageKey);
    console.log("Video deleted.");
    
    // Idempotency test
    console.log("Testing delete idempotency (deleting again)...");
    await provider.delete(imageUpload.storageKey);
    console.log("Delete idempotency OK.");

    console.log("\n✅ REAL CONTROLLED TEST SUCCESSFUL");
  } catch (error) {
    console.error("Test failed during execution:");
    console.error(error);
    process.exit(1);
  }
}

runTests();
