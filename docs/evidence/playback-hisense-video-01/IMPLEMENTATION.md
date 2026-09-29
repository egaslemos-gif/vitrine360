# IMPLEMENTATION STRATEGY

## Findings
1. The TV pre-caches all assets (including videos) into IndexedDB via the Sync engine.
2. When the slide is rendered, `createObjectUrl(assetId)` finds the video in IndexedDB and returns a `blob:` URL.
3. Hisense Sraf browser passes this `blob:` URL to the native player, which fails to stream it (no byte-range support for blobs).
4. As a result, the video immediately throws an error (`MEDIA_DECODE_ERROR`).
5. The `PlaybackController` interprets this as a recoverable error and advances to the next slide.

## Proposed Fix
Implement the requested strategy:
- **Online (navigator.onLine)**: Always use the direct URL (`/api/device/media/ID?token=TOKEN`) for VIDEO, completely bypassing the IndexedDB cache check and the Blob fetch fallback.
- **Offline (!navigator.onLine)**: Allow the code to fall through to `createObjectUrl` and use the cached `blob:` URL. (It will likely fail on Hisense, but this preserves the offline capability for Chromium and other browsers as requested by the rule "preservar Chromium, preservar offline").

To do this safely without breaking `token` security or other browsers:
```typescript
      // For VIDEO elements, if the device is online, we MUST use the direct URL
      // because Smart TVs (Hisense Vidaa, WebOS) require HTTP byte-range requests.
      // We bypass IndexedDB to avoid getting a Blob URL.
      if (item.type === "VIDEO" && navigator.onLine) {
        const config = await getConfig();
        if (config?.deviceToken) {
          const directPath = `/api/device/media/${encodeURIComponent(assetId)}?token=${config.deviceToken}`;
          setUrl(directPath);
          return;
        }
      }
```
This check should happen BEFORE `createObjectUrl(assetId)`.
This strictly enforces the Direct URL for online scenarios, fixing the physical Hisense test.
