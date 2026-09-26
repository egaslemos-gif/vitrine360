# CHECKLIST — PI-10G Release Gate

- [x] devices.max implemented
- [x] flag OFF preserves behavior
- [x] flag ON applies quota
- [x] PAIRED_NON_DISABLED respected
- [x] PENDING / ACTIVE / OFFLINE / DISABLED semantics
- [x] DELETE / DISABLE liberate capacity
- [x] REACTIVATE / PAIR consume capacity
- [x] RBAC + tenant lifecycle preserved
- [x] SUSPENDED blocks via lifecycle
- [x] Upgrade / downgrade validated
- [x] Existing overage preserved; no auto disable/delete/suspend
- [x] No storage quota / billing / Player / Experience changes
- [x] Tenant isolation + security tests
- [x] Concurrent allocation tests
- [x] No bypass route
- [x] Typecheck / lint / build / regression (run at gate)
