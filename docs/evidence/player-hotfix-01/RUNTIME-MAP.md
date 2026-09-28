# RUNTIME-MAP

## A. /player
- **Runtime**: React Player (Next.js Client-Side Application).
- **Renderer**: Relies on `src/player/playback/playback-renderer-adapter.tsx` which maps the state from `PlaybackController` to standard HTML5 `<video>`, `<img>`, and custom React components (`TextSlide`, etc).
- **Usage**: Standard modern web browsers (e.g., Opera on Laptop, Chrome, Safari) and high-end digital signage devices. 
- **Notes**: Any bug reported on the "Web Player" (Opera) executes within this runtime.

## B. /tv.html
- **Runtime**: Vanilla ES5 JavaScript.
- **Renderer**: Defined entirely within `public/tv.js` via direct DOM manipulation (`document.createElement`, `setHtml`). It bypasses React, Next.js, and modern APIs like IndexedDB (falling back to simple caches when needed).
- **Usage**: Legacy Smart TVs (Hisense Vidaa, Sraf HTML5 engine, older WebOS/Tizen) that either cannot run React/ES6 or crash frequently when doing so.
- **Notes**: Any bug reported on "Smart TV Hisense" runs this code. The React components (`playback-renderer-adapter.tsx`, `playback-controller.ts`) are **NEVER** executed on the Hisense TV.
