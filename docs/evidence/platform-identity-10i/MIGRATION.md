# MIGRATION — PI-10I

- File: `drizzle/0008_storage_reservations.sql`
- Journal: additive entry `0008_storage_reservations` (historical 0000–0002 entries unchanged; 0003–0007 remain unjournaled as previously documented)
- Runtime: `ensureSchema()` creates table + indexes
- No historical migration rewrite
