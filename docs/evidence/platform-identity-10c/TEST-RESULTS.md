# PLATFORM-IDENTITY-10C TEST RESULTS

| Test | Result | Detail |
|------|--------|--------|
| PI10C-RESOLVER-24 | PASS | flag OFF default |
| PI10C-RESOLVER-24b | PASS | flag OFF não altera createTenant |
| PI10C-RESOLVER-01 | PASS | tenant with ACTIVE TenantPlan |
| PI10C-RESOLVER-02 | PASS | resolver returns Plan correto |
| PI10C-RESOLVER-03 | PASS | resolver retorna todos entitlements ativos |
| PI10C-RESOLVER-04 | PASS | BOOLEAN parsing |
| PI10C-RESOLVER-05 | PASS | INTEGER parsing |
| PI10C-RESOLVER-06 | PASS | BYTES parsing |
| PI10C-RESOLVER-07 | PASS | inactive definition ignorada |
| PI10C-RESOLVER-08 | PASS | no active plan |
| PI10C-RESOLVER-09 | PASS | tenant inexistente |
| PI10C-RESOLVER-10 | PASS | plan inexistente |
| PI10C-RESOLVER-11 | PASS | invalid entitlement value |
| PI10C-RESOLVER-12 | PASS | duplicate binding |
| PI10C-RESOLVER-13 | PASS | tenant A não lê tenant B |
| PI10C-RESOLVER-14 | PASS | default compatibility plan funciona normalmente |
| PI10C-RESOLVER-15 | PASS | resolver é determinístico |
| PI10C-RESOLVER-16 | PASS | ordering determinístico |
| PI10C-RESOLVER-17 | PASS | resolver não modifica DB |
| PI10C-RESOLVER-18 | PASS | resolver não consulta JWT |
| PI10C-RESOLVER-19 | PASS | resolver não depende de RBAC |
| PI10C-RESOLVER-20 | PASS | resolver não depende de Tenant lifecycle |
| PI10C-RESOLVER-21 | PASS | resolver não consulta Billing |
| PI10C-RESOLVER-22 | PASS | resolver não calcula Usage |
| PI10C-RESOLVER-23 | PASS | overrides não são considerados |
| PI10C-RESOLVER-25 | PASS | flag ON |
| PI10C-RESOLVER-25b | PASS | flag ON disponibiliza resolução sem enforcement |
| PI10C-RESOLVER-25c | PASS | nenhuma API de recurso chama o resolver (sem enforcement) |
| PI10C-INV-01 | PASS | mesmo tenant + estado → mesmo resultado |
| PI10C-INV-02 | PASS | Tenant A nunca recebe TenantPlan de B |
| PI10C-INV-03 | PASS | Membership role não altera EffectiveEntitlements (resolver sem user) |
| PI10C-INV-04 | PASS | Tenant lifecycle não altera Plan value |
| PI10C-INV-05 | PASS | Device Bearer não altera entitlement |
| PI10C-INV-06 | PASS | JWT não é source of truth |
| PI10C-INV-07 | PASS | Usage não é calculado pelo resolver |
| PI10C-INV-08 | PASS | Billing não é consultado |
| PI10C-INV-09 | PASS | No active plan → resultado explícito |
| PI10C-INV-10 | PASS | Default Plan sem privilégios especiais |
| PI10C-RESOLVER-26 | PASS | múltiplos ACTIVE → typed failure |

Generated: 2026-09-25T15:27:16.255Z

PI-10C RESOLVE — PI-10D ENFORCES.
