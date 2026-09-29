# PRE-IMPLEMENTATION AUDIT

## 1. Initial State
- VIDEO item fails on Hisense TV (skips directly).
- IMAGE, AUDIO, GIF work.
- Chromium VIDEO works.

## 2. Constraints
- Do not alter `public/tv.js`, Legacy Player, Auth, Sync, etc.
- Fix explicitly for `/player` in React runtime.

## 3. Findings
- `playback-renderer-adapter.tsx` handles VIDEO via `<video>` tag.
- It might use Blob URLs for offline videos, or direct URLs if not offline.
- `ensureMediaPlayback` handles play() rejections.
