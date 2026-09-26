# Vitrine360 — RUNTIME-EXPERIENCE-06  
# Sandbox Host + CSP / Permissions-Policy Enforcement

**Date:** 2026-09-23  
**Status:** SANDBOX HOST VALIDATED (no bridge · no Player playback wire)  
**Depends on:** EXPERIENCE-01 … 05  
**ADR:** [ADR-EXPERIENCE-006](./adr/ADR-EXPERIENCE-006.md)

**Not claimed:** postMessage bridge · HTML_APP · Player content integration · PRODUCTION / PHYSICAL VALIDATED

---

## 0. Purpose

Provide a **sandboxed iframe host** that can load Experience packages from the dedicated origin, with **deny-by-default** sandbox tokens, iframe `allow` Permissions-Policy, and package CSP `frame-ancestors` aligned to the app origin.

```text
Dedicated Experience Origin
        +
Sandboxed iframe host
        +
CSP / Permissions-Policy
        ≠
Bridge (EXPERIENCE-07)
        ≠
Player playback CONTENT_TYPE (EXPERIENCE-09)
```

---

## 1. Scope

### In scope

- Pure sandbox policy builders (`experience-sandbox.ts`)  
- `ExperienceSandboxFrame` client component  
- Safe `src` checks (`/x/…` on Experience origin only)  
- Package response `frame-ancestors` includes app origin  
- Deny-by-default Permissions-Policy on iframe `allow`  
- Docs / ADR / tests  

### Out of scope

| Item | Status |
|------|--------|
| postMessage bridge | Forbidden (EXPERIENCE-07) |
| HTML_APP / CONTENT_TYPES | Forbidden |
| Wiring into Player playlist/playback | Forbidden |
| Fullscreen/orientation via iframe allow | Denied (`fullscreen 'none'`) — host mediates later |
| Migrations | Forbidden |

---

## 2. Sandbox tokens

| Token | Default | Rule |
|-------|---------|------|
| `allow-scripts` | On | Required for interactive HTML when admitted |
| `allow-same-origin` | Only if dedicated origin ≠ app | **Never** on privileged same-origin |
| `allow-forms` | Off | |
| `allow-popups` | Off | T8 |
| `allow-modals` | Off | |
| `allow-downloads` | Off | |
| `allow-top-navigation*` | Off | T7 |
| `allow-pointer-lock` | Off | |
| `allow-presentation` | Off | |

Anti-pattern remains: `allow-scripts` + `allow-same-origin` on the **app** origin.

---

## 3. Permissions-Policy (iframe `allow`)

Default deny: camera, microphone, geolocation, payment, usb, sensors, clipboard, display-capture, **fullscreen**.

Fullscreen / orientation remain **host-mediated** (POLICY-08A/08B + future bridge).

---

## 4. CSP enforcement

### Package responses (EXPERIENCE-05+, updated)

- Document CSP keep deny-by-default (`connect-src 'none'`, …)  
- `frame-ancestors 'self' {NEXT_PUBLIC_APP_URL origin}` so the app may embed  
- Omit `X-Frame-Options` when app origin is listed (avoid blocking cross-origin embed)

### Host embed guidance

`buildHostEmbedCspFragment(experienceOrigin)` → `frame-src` limited to Experience origin.  
**Not** applied to `/player` in this phase (no Player wire).

---

## 5. Component

`src/features/experience-sandbox/sandbox-frame.tsx` → `ExperienceSandboxFrame`

- Validates `src` before render  
- Sets `sandbox`, `allow`, `referrerPolicy="no-referrer"`  
- **No** `message` event listeners  
- **No** token props  

Rejected `src` schemes: `javascript:`, `data:`, `blob:`, non-`/x/` paths.

---

## 6. Implementation map

| Module | Role |
|--------|------|
| `src/domain/experience-sandbox.ts` | Policy + src safety + frame-ancestors |
| `src/features/experience-sandbox/sandbox-frame.tsx` | Sandboxed iframe host |
| Serve route | Passes `frameAncestors` from `NEXT_PUBLIC_APP_URL` |

---

## 7. Threat delta

| Threat | Control |
|--------|---------|
| T2 DOM access | Separate origin + sandbox |
| T7 Top nav | No allow-top-navigation |
| T8 Popups | No allow-popups |
| T4 Cookies | Dedicated origin + no allow-same-origin on app host |
| T12 Bridge abuse | Bridge still absent |

---

## 8. Next phase

EXPERIENCE-07 — Controlled postMessage bridge (allowlisted methods only).

---

## Evidence

- ADR: `docs/adr/ADR-EXPERIENCE-006.md`  
- Checklist: `docs/evidence/runtime-experience-06/SANDBOX-HOST-CHECKLIST.md`  
- Validation: `npm run test:runtime-experience-06`
