# PI-10O Test Results

Date: 2026-09-25

## Primary

| Command | Result |
|---------|--------|
| `npm run test:platform-identity-10o` | PASS (51 assertions; live Preview deploy limited) |
| Preview R2 probe (`scripts/probe-pi10o-preview-r2.ts`) | PASS (PUT/HEAD/DELETE on `vitrine360-preview`) |

## Regressions

| Suite | Result |
|-------|--------|
| PI-10G | PASS |
| PI-10I | PASS |
| PI-10J | PASS |
| PI-10K | PASS |
| PI-10L | PASS (prior suite; included in gate run chain) |
| PI-10N | PASS (prior suite; included in gate run chain) |
| PI-04 | PASS (gate chain) |
| PI-05B | PASS (gate chain) |
| PI-06B | PASS (gate chain) |
| PI-07 | PASS (gate chain) |
| PI-09 | PASS (gate chain) |

## Tooling

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors; pre-existing warnings only) |
| `npm run build` | PASS |

## Playwright / Chromium

| Item | Status |
|------|--------|
| `playwright` CLI | NOT SET |
| `node_modules/playwright` | SET |
| `@playwright/test` | NOT SET |

Browser E2E not required for this phase; not executed.

## Environment limitation

Live Vercel Preview deploy OFF→ON→OFF **not executed** because Preview lacks isolated `DATABASE_*` / auth / R2 env on Vercel. Pipeline proven on isolated file DB instead.
