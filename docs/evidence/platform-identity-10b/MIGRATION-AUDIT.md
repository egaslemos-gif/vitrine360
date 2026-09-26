# MIGRATION-AUDIT — PI-10B

## Pre-existing journal lag

`drizzle/meta/_journal.json` ends at **0002**, while SQL files `0003`–`0006` exist.
Runtime deploy path remains **`ensureSchema()`**, consistent with PI-04.

## This phase

| Artifact | Path |
|----------|------|
| SQL | `drizzle/0007_entitlements.sql` |
| ensureSchema | `src/db/client.ts` |
| Drizzle schema | `src/db/schema.ts` |

## Safety

- Additive only (`CREATE TABLE IF NOT EXISTS`)
- No DROP / rewrite of tenants, memberships, devices, content, media, playlists, schedules, experience
- Historical migrations not rewritten
