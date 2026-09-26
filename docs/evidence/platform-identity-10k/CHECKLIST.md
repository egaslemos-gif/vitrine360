# PI-10K CHECKLIST — Release Gate

- [x] Entitlement resolution centralizada
- [x] Usage source-of-truth consistente
- [x] devices.max consistente
- [x] storage.maxBytes consistente
- [x] reservation consistente
- [x] concurrency segura
- [x] dedup segura
- [x] tenant isolation PASS
- [x] lifecycle PASS
- [x] RBAC separado de entitlement
- [x] Device Bearer não bypassa quota
- [x] Platform role não bypassa quota
- [x] client não controla quota
- [x] flag OFF preserva legacy
- [x] flag ON aplica enforcement
- [x] fail-closed PASS
- [x] downgrade semantics PASS
- [x] delete semantics PASS (DB authority; documented)
- [x] orphan semantics PASS (documented)
- [x] transaction boundaries PASS
- [x] schema integrity PASS (residual MEDIUM on ensureSchema unique catch)
- [x] security tests PASS
- [x] regression tests (run in gate)
- [x] typecheck / lint / build (run in gate)
- [x] documentação criada

**Gate:** PASS when tooling + regressions green.
