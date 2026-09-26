# ROOT-CAUSE — Player Legacy Smart TV SyntaxError

**Date:** 2026-09-24  
**Surface:** Hisense / VIDAA (Sraf) → `/tv.html` → `/tv.js`  
**Symptom:** `Erro no arranque` · `Uncaught SyntaxError: Unexpected token ) (L1199)`

## ROOT CAUSE

Trailing comma in a **CallExpression** argument list inside `public/tv.js` (analog clock timer):

```js
playState.clockTimer = setInterval(
  applyHands,
  showSeconds ? 1000 : 30000,  // ← trailing comma
);
```

ES5 / legacy Smart TV parsers reject trailing commas in function **calls**.  
Node / modern Chromium accept them → local parse can PASS while Hisense fails.

TV reported **L1199** which matched the closing `)` of that `setInterval` in the published `0.1.22` / `?v=050` script.

## CONTRIBUTING FACTOR

- Cache-bust mismatch risk: `/player` redirected Smart TVs to `/tv.html?v=044` while shell had moved to `tv.js?v=050` (now aligned to `051`).
- Service Worker `tv-sw.js` can retain prior shell revisions if cache name / query are not bumped together.

## NOT THE CAUSE

- Pairing protocol
- Device Bearer
- Sync / manifest contract
- Platform Identity / tenant lifecycle
- React player runtime (Smart TV redirects away before hydration)

## PLATFORM LIMITATION

Hisense/VIDAA may discard or limit IndexedDB / Service Worker across cold power cycles.  
Identity for Legacy Player is primarily **`localStorage`** (`v360-player-config`). Do not treat SW/IDB loss as “must re-pair” unless `deviceToken` is missing or server returns 401.
