# CONTROL-ARCHITECTURE

UI/Input → PlaybackAction → PlaybackController → PlaybackState → Renderer.

Files: `playback-controls.tsx`, `playback-chrome.tsx`, `use-playback-keyboard.ts`, `control-availability.ts`, `format-time.ts`.

No DisplayEngine import in controls. No direct media / index mutation from UI.
