# FIX — Player Legacy SyntaxError

## Exact change

**File:** `public/tv.js`  
**Area:** `renderAnalogClockFace` → `setInterval`

Before (invalid on ES5 Smart TV):

```js
playState.clockTimer = setInterval(
  applyHands,
  showSeconds ? 1000 : 30000,
);
```

After:

```js
playState.clockTimer = setInterval(
  applyHands,
  showSeconds ? 1000 : 30000
);
```

Also removed other trailing **call** commas in `public/player-smarttv.js` (secondary legacy entry).

## Version / cache

| Artifact | Version |
|----------|---------|
| `VERSION` in `tv.js` | `0.1.23-smarttv-static` |
| `tv.html` script | `/tv.js?v=051` |
| `tv-sw.js` shell cache | `v360-tv-shell-v051` |
| `/player` Smart TV redirect | `/tv.html?v=051` |
| `player-app.tsx` TV fallback | `/tv.html?v=051` |

## Scanner

`scripts/diag-tv-es5-boot.mjs` — trailing call commas + modern syntax heuristics + `acorn` `ecmaVersion: 5` parse + cache version alignment.

## Intentionally unchanged

Pairing, claim, Bearer, sync, heartbeat, manifest schema, React Experience runtime, Platform Identity.
