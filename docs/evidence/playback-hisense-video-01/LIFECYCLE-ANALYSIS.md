# LIFECYCLE ANALYSIS

## 1. Generation Lifecycle
The `PlaybackRendererAdapter` uses a `generation` token to tie events to the current slide presentation. 
If a `video` element emits an event (e.g., `onEnded` or `onError`), the event is dispatched to the `PlaybackController` along with the `generation` number. The controller discards events from stale generations.

## 2. Cleanup
When the active `item` changes, the `Slide` component is unmounted. 
The `useEffect` cleanup function on `localMediaRef.current`:
```typescript
    return () => {
      const el = localMediaRef.current;
      if (el) {
        try {
          el.pause();
          el.removeAttribute("src");
          el.load();
        } catch {
          // ignore
        }
      }
    };
```
This correctly detaches the source and cleans up the element memory before the ObjectURL is revoked.

## 3. ObjectURL Revocation
The ObjectURL is revoked properly in the cleanup of the data-fetching `useEffect`:
```typescript
    return () => {
      cancelled = true;
      if (revoked && revoked.startsWith("blob:")) {
        URL.revokeObjectURL(revoked);
      }
    };
```
This guarantees no memory leaks. The only issue was passing `blob:` URLs to the Hisense player in the first place when online.
