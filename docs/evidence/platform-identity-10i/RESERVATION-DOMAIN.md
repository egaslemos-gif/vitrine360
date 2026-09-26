# RESERVATION-DOMAIN — PI-10I

Types in `src/domain/storage-reservation.ts`.

Statuses: `RESERVED` | `COMMITTED` | `RELEASED` | `EXPIRED`

Active hold: **RESERVED only**.

No `FAILED` status — abort uses `RELEASED`.

Pure helpers: `validateExpectedBytes`, `assertActualWithinReservation`, `canTransitionReservation`.

Service: `src/services/storage-reservation.ts`.
