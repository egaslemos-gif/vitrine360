# ADR-CONTENT-TEMPLATES-001 — System Content Templates

## Status

Accepted — CONTENT-TEMPLATES-01

## Context

Operators need faster creation of frequent TEXT / CLOCK / NOTICE / EVENT / QR contents without inventing new Content Types or coupling Content to a template at runtime.

## Decision

1. **Templates are presets** — declarative defaults only.
2. **Templates are not Content** — and not MediaAssets, Playlists, or Experiences.
3. **Templates do not create new Content Types** — they map onto existing `CONTENT_TYPES`.
4. **System templates are static** in `TemplateRegistry` (code) for v1.
5. **Content becomes independent** after seed/clone; no runtime Template lookup.
6. **No Workspace Templates** in this phase.
7. Optional audit fields live in `payload.createdFromTemplateId` / `createdFromTemplateVersion` without schema migration.
8. **CLOCK** remains a native Content type with live device-time rendering (not Experience).
9. **CLOCK runtime parity** — Digital and Analog must behave equivalently in React Player and legacy `tv.js` (DOM+CSS hands; shared angle math; device-local `Date`; timer cleanup on slide/playlist change). Physical Hisense validation is separate evidence and must not be inferred.

## Consequences

- Small catalog (9) validates UX with low complexity.
- Extensible later to WORKSPACE catalogs without changing Content runtime.
- Renderers must honour CLOCK payload (`showSeconds`, `style`) on both React and legacy paths.
- Analog is not React-only; legacy ships `renderAnalogClockFace` with ES5-compatible transforms.

## Non-Goals

Workspace templates, template editor, marketplace, Experience templates, template scripting, system template DB.
