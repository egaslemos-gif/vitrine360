# Android TV Box — Installation & Kiosk (Passive Runtime)

> The Smart TV is only a display. The Android TV Box runs the Vitrine360 **Passive Player Runtime** (`/player`).

This guide is **device-specific**: behaviour depends on the box model, Android version, and kiosk browser chosen. **Do not claim universal compatibility** with all Android TV Boxes.

---

**Operador Smart TV (piloto):** guia curto com credenciais e passos → [smart-tv-quickstart.md](./smart-tv-quickstart.md)

## Dependencies

| Dependency | Purpose |
|------------|---------|
| Android TV Box with HDMI out | Compute + Player host |
| Smart TV (or monitor) | Picture only |
| HDMI cable | Box → TV |
| Network (Ethernet preferred) | First sync, heartbeat, updates |
| Reachable Vitrine360 origin | `https://<host>` or LAN IP for pilot |
| Kiosk browser / WebView | Fully Kiosk, SureMDM browser, Chrome + launcher, or TWA later |
| Admin account (separate machine) | Pairing only — **never** on the box |

**Not installed on the box:** admin JWT, `AUTH_SECRET`, DB credentials, storage master keys. The Player keeps only a device Bearer token (+ ephemeral pairing secret during claim).

---

## Step-by-step installation

### 1. Hardware

1. Connect Android TV Box HDMI → Smart TV HDMI input.
2. Power both devices; select the correct TV HDMI source.
3. Confirm picture from the box Android UI.

### 2. Network

1. Connect Ethernet (preferred) or Wi‑Fi.
2. Verify the box can open the Vitrine360 origin in a browser.
3. Note DNS / firewall rules if using a private LAN hostname.

### 3. Browser / WebView

1. Install the chosen kiosk browser (see [Kiosk mode](#kiosk-mode) below).
2. Confirm JavaScript, cookies/storage, and Service Workers are allowed for the origin.
3. Open `https://<host>/player` (or a **secure-context** local URL for lab pilots — see below).

### Secure context (required for offline cold start)

Service Workers and reliable offline reboot require a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts):

| URL | SW / offline cold start |
|-----|-------------------------|
| `https://<host>/player` | Supported (production / pilot) |
| `http://127.0.0.1:<port>/player` | Supported (lab) |
| `http://localhost:<port>/player` | Supported (lab) |
| `http://10.0.2.2:<port>/player` (Android emulator → host) | **Not** a secure context — SW may not register; offline cold start fails |
| `http://<lan-ip>/player` | Often **not** secure — prefer HTTPS or tunnel |

**Emulator lab tip:** `adb reverse tcp:3006 tcp:3006` then open `http://127.0.0.1:3006/player` (not `10.0.2.2`).

After Chrome process kill, SW may take several seconds to intercept the first navigation; the Player then serves `/v360-offline.html` (vanilla IndexedDB boot) so Next hydration is not required offline.

### 4. Pairing

1. Player shows a 6-digit activation code.
2. On a **separate** admin workstation: Admin Console → Devices → enter code, name, location, `TV-…` device code.
3. Device must land in the **correct tenant**.
4. Player claims token automatically (uses local pairing secret) → status ACTIVE.

### 5. Content

1. Admin: upload media / create contents / build playlist.
2. Assign playlist to the device.
3. Player syncs (manifest + assets) and starts Passive playback.

### 6. Lock as appliance

Apply kiosk + auto-start (below). Reboot the box and confirm Player returns without manual URL entry.

---

## Kiosk mode

**Goal**

```text
Power ON → Android boot → Player launch → Playback
```

Hide: address bar, bookmarks, browser chrome, system menus, stray cursor, external pages.

### Documented dependency (example paths)

| Approach | Notes |
|----------|--------|
| **Fully Kiosk Browser** | Common on Android TV / firestick-class devices. Lock URL to `/player`, enable start on boot, fullscreen, kiosk exit gesture for admins only. |
| **SureMDM / MDM launcher** | Enterprise; enforces single-app / single-URL. |
| **Chrome + custom launcher** | Weaker; may show chrome unless wrapped. |
| **TWA (Bubblewrap)** | Later distribution; same origin as PWA. |

**Known limitation:** kiosk quality is **not** guaranteed by Vitrine360 software alone — it depends on the box + browser/MDM. Record the exact app + version in the hardware report.

---

## Auto-start

Required behaviour:

```text
TV OFF → TV ON → Box boot → Player start → Playlist
Box reboot → Player resumes (local cache first)
```

Configure in the kiosk app:

- Start on boot / device admin auto-launch
- Restart on crash
- Keep screen on / disable sleep
- Homepage = `/player` only

If the chosen box cannot auto-start, document the limitation and the workaround (e.g. manual Fully Kiosk start after boot).

---

## Offline & recovery (operator checks)

After first sync:

1. Disable network → playback of images/text/video must continue.
2. Reboot box **while offline** → Player must load local config + CURRENT manifest (no white screen waiting for internet).
3. Re-enable network with server at v2 → atomic sync (keep v1 until v2 valid).

Detailed checklist: [android-tv-checklist.md](./android-tv-checklist.md)

---

## Security reminders

- Pair only with Admin on a trusted machine.
- Factory-reset Player local state: `/player?reset=1` or diagnostic `D` then `R` (when overlay open).
- Disable lost devices from Admin (`PATCH` set_status DISABLED) to revoke tokens.
