# BLOB URL ANALYSIS

## 1. Blob URLs for VIDEO on Hisense (Sraf)
Hisense TVs using the Sraf Open Browser have known limitations with `blob:` URLs for media elements (`<video>`, `<audio>`).
The Sraf browser's media player often delegates media decoding to a hardware-level player (e.g., GStreamer or a native TV player). This native player expects an HTTP/HTTPS URL that supports byte-range requests (HTTP 206 Partial Content) to stream the media.
Because `blob:` URLs are handled strictly within the browser memory space and do not support byte-range requests, the native player fails to initialize the source, emitting a `MEDIA_DECODE_ERROR` or similar `MEDIA_ERROR` event almost immediately.

## 2. Current Strategy in `playback-renderer-adapter.tsx`
The code has a special condition:
```typescript
// Smart TVs (Hisense Vidaa, old WebOS) fail to stream video via blob URL
// because they require HTTP byte-range requests directly from the <video> tag.
if (item.type === "VIDEO" && !offlineUrl) {
  setUrl(`${path}?token=${config.deviceToken}`);
  return;
}
```
This means if `offlineUrl` is NOT present, it uses a direct HTTP URL with a token.
However, if the video is already in IndexedDB, the code does:
```typescript
const objectUrl = await createObjectUrl(assetId).catch(() => null);
if (objectUrl) {
  revoked = objectUrl;
  setUrl(objectUrl);
  return;
}
```
This forces a `blob:` URL.

If the TV is caching assets in IndexedDB, the video will ALWAYS get a `blob:` URL and therefore will ALWAYS fail on Hisense.

## 3. Playback Error Consequence
When the `<video>` element emits `onError` (because Sraf fails to load the blob), the React wrapper maps this to:
```typescript
onError={() => {
  onMediaEvent({
    type: "MEDIA_ERROR",
    code: MEDIA_ERROR_CODES.MEDIA_DECODE_ERROR,
    message: "Media unavailable",
    recoverable: true,
    generation,
  });
}}
```
This `MEDIA_ERROR` is marked `recoverable: true`. The `PlaybackController` (via error policy) treats recoverable errors by skipping to the next slide to keep the playlist moving.
This explains the exact behavior observed: VIDEO is reached -> fails to render -> is skipped -> playlist continues.
