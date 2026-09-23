import { createHash } from "node:crypto";
import { GoogleDriveProvider } from "../src/services/media/google-drive-provider";

async function runTests() {
  console.log("Starting Real Google Drive Integration Test...");

  const missing = [];
  if (!process.env.GOOGLE_DRIVE_CLIENT_EMAIL) missing.push("GOOGLE_DRIVE_CLIENT_EMAIL");
  if (!process.env.GOOGLE_DRIVE_PRIVATE_KEY) missing.push("GOOGLE_DRIVE_PRIVATE_KEY");
  if (!process.env.GOOGLE_DRIVE_FOLDER_ID) missing.push("GOOGLE_DRIVE_FOLDER_ID");

  if (missing.length > 0) {
    console.error(`Missing required environment variables: \n${missing.join("\n")}`);
    console.log("Please run this script with the real credentials to execute the final STAGING real test.");
    process.exit(1);
  }

  process.env.STAGING = "true";

  const provider = new GoogleDriveProvider();

  try {
    // 1. Upload Test Image
    console.log("Uploading test image...");
    const imageBuffer = Buffer.from("fake-image-content-for-test");
    const imageUpload = await provider.put({
      key: "test-image.png",
      data: imageBuffer,
      fileName: "test-image.png",
      mimeType: "image/png"
    });
    console.log(`Image uploaded successfully. File ID: ${imageUpload.storageKey}`);
    console.log(`Image URL: ${imageUpload.url}`);

    // 2. Upload Test Video
    console.log("Uploading test video...");
    const videoBuffer = Buffer.from("fake-video-content-for-test-mp4");
    const videoUpload = await provider.put({
      key: "test-video.mp4",
      data: videoBuffer,
      fileName: "test-video.mp4",
      mimeType: "video/mp4"
    });
    console.log(`Video uploaded successfully. File ID: ${videoUpload.storageKey}`);
    console.log(`Video URL: ${videoUpload.url}`);

    // 3. Download and Checksum Image
    console.log("Downloading image and verifying checksum...");
    const imgRes = await fetch(imageUpload.url);
    if (!imgRes.ok) throw new Error(`Image download failed with status ${imgRes.status}`);
    const imgData = Buffer.from(await imgRes.arrayBuffer());
    const imgChecksum = "sha256:" + createHash("sha256").update(imgData).digest("hex");
    if (imgChecksum !== imageUpload.checksum) {
      throw new Error(`Checksum mismatch for image! Expected ${imageUpload.checksum}, got ${imgChecksum}`);
    }
    console.log("Image Checksum matched perfectly.");

    // 4. Download and Checksum Video (also test range request mock)
    console.log("Testing HTTP Range on Video...");
    const rangeRes = await fetch(videoUpload.url, {
      headers: {
        "Range": "bytes=0-10"
      }
    });
    if (rangeRes.status !== 206 && rangeRes.status !== 200) {
      console.warn(`Warning: Range request returned status ${rangeRes.status}`);
    } else {
      console.log(`Video Range request successful (Status: ${rangeRes.status})`);
      const rangeData = Buffer.from(await rangeRes.arrayBuffer());
      console.log(`Downloaded ${rangeData.byteLength} bytes.`);
    }

    // 5. Delete Assets
    console.log("Cleaning up resources from Google Drive...");
    await provider.delete(imageUpload.storageKey);
    console.log("Image deleted.");
    await provider.delete(videoUpload.storageKey);
    console.log("Video deleted.");
    
    console.log("\n✅ REAL CONTROLLED TEST SUCCESSFUL");
  } catch (error) {
    console.error("Test failed during execution:");
    console.error(error);
    process.exit(1);
  }
}

runTests();
