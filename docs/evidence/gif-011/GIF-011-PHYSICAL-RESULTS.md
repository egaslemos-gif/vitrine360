# GIF-011 Physical Validation

**Date:** 2026-09-22 (UTC)  
**Phase:** GIF-011 physical validation only — **no product code changes**  
**Operator/agent:** Cursor agent (control-plane probe only; **no operator in front of Hisense**)

| Field | Value |
|-------|--------|
| Device | `TV-CASA-001` / **HISENSE** (`463c0c7d-e588-4913-9ce8-572e83a0ab4d`) |
| Requested code `TV-WC-MUD3IFGI` | **Not present** in production device list this session |
| Hardware | Hisense / VIDAA (prior: Sraf, 1280×720, `0.1.16-smarttv-static`) |
| Browser | VIDAA/Sraf (not observed this session) |
| Firmware/Software | Device reports `0.1.16-smarttv-static` (last session) |
| Vitrine360 URL | `https://vitrine360-psi.vercel.app/tv.html` (HTTP 200) |
| Presence at probe | **OFFLINE** |
| lastSeenAt | `2026-09-21T18:19:10.469Z` (~26h before probe) |
| Manifest version (device row) | **9** |
| MediaAsset | `b2fd7ea4-4a55-49e9-9aa3-30919009488a` · `gif-011-animated.gif` · `image/gif` · **6960** bytes |
| Content | `9b5d1345-a1e4-47f8-acfc-c2b139c28c29` · IMAGE · **9000** ms · ACTIVE · title `GIF-011 Hisense Validation` |
| Playlist | `f2ea84e4-4b5a-4784-9f78-debd3e4f9692` (`Playlist Padrão`) — assigned to HISENSE |

Other devices seen: `MEU-PC` / MEU-LAPTOP **ONLINE** (same playlist) — **not** the Hisense DUT.

---

## Test 1 — Render

**NOT OBSERVABLE** — Hisense OFFLINE; no physical screen observation.

## Test 2 — Animation

**NOT OBSERVABLE**

## Test 3 — Timer

**NOT OBSERVABLE**

## Test 4 — Playlist Advance

**NOT OBSERVABLE**

## Test 5 — Refresh

**NOT OBSERVABLE**

## Test 6 — Offline

**NOT TESTED** / **BLOCKED** — device not powered/online for GIF playback observation.

---

## Evidence

### Control plane (probed 2026-09-22)

- Production `tv.html` reachable (200).
- Admin login OK; devices list confirms HISENSE **OFFLINE**.
- MediaAsset `gif-011-animated.gif` still present (MIME `image/gif`, 6960 B).
- Content GIF-011 still ACTIVE IMAGE 9000 ms.
- Prior attach evidence: playlist item `783d5e6e-8ede-4599-8ce9-036822fd74b3` (`docs/evidence/gif-011/playlist-item-response.json`).

### Physical (Hisense panel)

- **Nothing observed this session.**  
- Agent cannot view Sraf output; Cursor/desktop Chromium is **not** a substitute for GIF-011.  
- No console capture, no broken-image report, no animation frames logged from the TV.

## Limitations

- Physical validation requires an operator with Hisense powered, on LAN/WAN to Vercel, `tv.html` open, Admin ONLINE.
- VIDAA offline/cache persistence remains platform-dependent (not claimed here).
- `TV-WC-MUD3IFGI` from warm-cache lab is a different ephemeral device — not the house Hisense.

## Final Verdict

```text
GIF-011 — BLOCKED
```

**Reason:** HISENSE device present in Admin but **OFFLINE**; no physical observation of render, animation, timer, or playlist advance. Software prep remains PASS (see `GIF-011-RESULTS.md`); **PHYSICAL VALIDATED is not claimed.**

### Operator resume checklist

1. Power Hisense; open `https://vitrine360-psi.vercel.app/tv.html`.  
2. Confirm HISENSE **ONLINE** in Admin.  
3. Observe GIF-011 slide: frames change; ~9 s advance; ≥2 cycles.  
4. Optional: refresh; optional offline — classify separately.  
5. Update this file with PASS/FAIL per test and promote verdict only with real observation.
