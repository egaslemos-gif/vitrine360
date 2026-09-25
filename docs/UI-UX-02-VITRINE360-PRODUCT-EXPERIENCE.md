# UI/UX-02 — Vitrine360 Product Experience

**Status:** Implementation complete — see evidence + final verdict  
**Date:** 2026-09-25  
**Scope:** Visual language, app shell IA, Dashboard, Device experience, Landing Page, Device Control **concept**  
**Not in scope:** Remote playback commands, schema, entitlements, Production deploy

## Objective

Elevate Vitrine360 into a professional SaaS presentation surface — coherent admin chrome plus a public landing — without changing validated architecture or inventing remote-control behaviour.

## Product Positioning

**Vitrine360 — Digital Display & Presentation Platform**

> A platform to create, distribute, play and control digital experiences on screens and devices.

Capabilities: **CREATE · DISTRIBUTE · PLAY · CONTROL** (+ future **INTERACT**).

Not positioned solely as a “digital signage CMS”.

## Design Principles

Linear / Stripe / Notion inspired — clean, premium, editorial, operational, low-noise, restrained colour (existing emerald primary), Inter operational + Fraunces brand-only.

## Brand System

| Layer | Choice |
|-------|--------|
| Operational UI | Inter (`--font-sans`) |
| Brand / editorial | Fraunces (`--font-display`) — logo, landing brand, final CTA |
| Tokens | Extended in `src/app/globals.css` (surface, text, semantic, `.dark` opt-in) |

## Application Shell

Sidebar IA (`src/components/admin-nav.ts`):

- **Overview** — Dashboard  
- **Content** — Media, Conteúdos, Playlists  
- **Devices** — Ecrãs, Grupos  
- **Playback** — Agendamentos  
- **System** — Actividade, Membros, Definições  

Future routes (Experiences, Locations, Now Playing nav, Device Control nav) **not** added as dead links.

Tagline: “Digital Display & Presentation”.

## Dashboard

Operational overview: greeting, 4 stats, Ecrãs list, Now Playing panel, recent activity, content shortcuts. Uses real tenant data + `EmptyState`.

## Device Experience

Device detail: Live/Current state, metadata, observability, actions.  
**Device Control** = visual concept only (`device-control-concept.tsx`) — buttons disabled / Coming soon.

## Device Control Concept

Device Control visual ≠ Remote Command implementation.

## Content / Playlist / Media

Shared `PageHeader` / badges / cards retained. Copy refined for professional library/playlist framing. No domain model changes.

## Landing Page

Public `/` (`LandingPage`) — does **not** break `/admin/login`.  
Sections: Hero, Capabilities, Interactive vision, Remote Control mock, Architecture, Use cases, Reliability, CTA, Footer.  
Messaging does **not** claim unimplemented remote commands as production-ready.

## Responsive Design

Landing and shell use existing responsive patterns (mobile drawer, max-width canvas, overflow strategies on lists).

## Accessibility

Focus rings on nav/CTAs; disabled control buttons keep `aria-label`; Device Control progress/volume labelled; semantic landmarks on landing.

## Validation

See `docs/evidence/ui-ux-02/VALIDATION.md`.

## Known Future UI

- Remote Play/Pause/Next/Previous/Stop/Seek/Volume → **RUNTIME-PLAYBACK-01**
- Touch interaction engine  
- Experiences / Locations nav entries when routes exist  
