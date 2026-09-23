# Vitrine360

Digital Signage platform — the TV is only a playback device; the platform is the product.

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Drizzle ORM + SQLite (Turso-ready via `@libsql/client`)
- Web Player PWA (offline-first)

## Docs

- Architecture: [docs/architecture/](./docs/architecture/)
- Acceptance: [docs/ACCEPTANCE.md](./docs/ACCEPTANCE.md)
- Android TV install: [docs/android-tv.md](./docs/android-tv.md)
- Android TV checklist: [docs/android-tv-checklist.md](./docs/android-tv-checklist.md)
- Hardware validation report: [docs/HARDWARE-VALIDATION-REPORT.md](./docs/HARDWARE-VALIDATION-REPORT.md)
- Security audit: [docs/AUDIT-REPORT.md](./docs/AUDIT-REPORT.md)
- Multi-tenant ADR: [docs/architecture/adr/005-multi-tenant.md](./docs/architecture/adr/005-multi-tenant.md)
- Player Runtime ADR: [docs/architecture/adr/006-player-runtime.md](./docs/architecture/adr/006-player-runtime.md)

## Setup

```bash
cp .env.example .env.local
npm install
npm run db:push
npm run db:seed
npm run dev
```

**Seed credentials are DEVELOPMENT ONLY** (printed by `npm run db:seed`).  
Change `AUTH_SECRET` and admin password before any shared/staging/production deploy.  
Default tenant slug after seed: `demo`

- Admin: http://localhost:3000/admin
- Player pairing: http://localhost:3000/player

### Device pairing

1. Open `/player` → note 6-digit activation code (device also stores a pairing secret locally)
2. Admin → Devices → enter code, name, `TV-…` device code
3. Player claims a device Bearer token (requires pairing secret) → ACTIVE
4. Assign playlist → sync + playback

### Offline behaviour

Player keeps `CURRENT_MANIFEST` in IndexedDB. Updates download into `NEXT` and activate only when all assets validate; on failure the previous version stays active.

### Heartbeat / presence

`HEARTBEAT_OFFLINE_AFTER_MS` (default **90000**) — device is not marked OFFLINE after a single missed beat.

### Tests

```bash
npm run test
npm run test:tenant
npm run test:security
npm run test:acceptance
npm run typecheck
npm run lint
npm run build
```

Billing/subscriptions/IA are explicitly out of scope.
