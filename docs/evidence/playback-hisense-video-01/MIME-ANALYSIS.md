# MIME ANALYSIS

## 1. Blob Type Wrapping
For GIF images, the `playback-renderer-adapter.tsx` manually forces the `image/gif` MIME type when converting the `Response` to a `Blob` in order to ensure Chromium/Opera animate the blob correctly.
This technique is NOT applied to VIDEO, which means the video blob relies entirely on the HTTP `Content-Type` headers returned by the `/api/device/media/` endpoint.

## 2. API Headers
If the API endpoint serves the video with an incorrect or generic MIME type (such as `application/octet-stream`), `URL.createObjectURL(blob)` might produce a Blob URL that the TV player refuses to decode, regardless of the byte-range issue.
The Sraf browser is known to be very strict about MIME types for hardware-accelerated playback.

## 3. Impact
While fixing the Blob URL issue (by bypassing Blob for video on online TVs) mitigates the byte-range issue, we must ensure that the direct URL (`/api/device/media/...`) serves the correct `video/mp4` or `video/webm` MIME type in its headers. If the API is backed by R2/S3, the Content-Type should be correctly populated during upload.
