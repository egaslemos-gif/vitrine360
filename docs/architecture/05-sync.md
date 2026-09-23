# Offline-First Sync

```
REMOTE CONTENT → SYNC ENGINE → LOCAL CACHE → PLAYER
```

## Local stack

- IndexedDB: manifests, metadata, blob handles  
- Cache API / SW: static player shell + media blobs when appropriate  
- Service Worker: PWA installability + offline shell  

## Manifest shape

```json
{
  "manifestVersion": 42,
  "playlist": { "id": "...", "version": 7, "items": [...] },
  "assets": [
    { "id": "asset-1", "checksum": "sha256:...", "url": "...", "mimeType": "..." }
  ],
  "schedules": []
}
```

## Incremental update

```
local=41, server=42 → download only changed assets → validate checksums
→ store as NEXT_MANIFEST → atomic activate → drop obsolete
```

On failure: keep CURRENT_MANIFEST. Never leave partial activation.

## Atomic activation

1. download  
2. validate  
3. store NEXT  
4. prepare  
5. swap CURRENT ← NEXT  

## Empty / error UX

Never white screen. Fallback: last good playlist, else full-screen `NO CONTENT AVAILABLE`.

## Player runtime UX

Signage app look: 1920×1080 landscape first; no chrome/menus/scrollbars/cursor in normal mode. Transitions: fade | slide | cut only.
