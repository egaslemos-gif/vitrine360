# ADR-001: Technology Stack

## Decision

- **App:** Next.js (App Router) + TypeScript strict + React + Tailwind + shadcn/ui  
- **API:** Route Handlers + Server Actions where appropriate  
- **DB:** SQLite via Turso + Drizzle ORM (local `file:` SQLite for dev)  
- **Deploy:** Vercel + Turso  
- **Player:** Web Player PWA (React), later wrap for Android TV (TWA/WebView)

## Why

Matches MVP constraints: low cost, single codebase, device-agnostic player, Turso free tier friendly.

## Consequences

Serverless constraints on long uploads/sync; media via external storage abstraction.
