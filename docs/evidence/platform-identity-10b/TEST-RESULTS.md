# PLATFORM-IDENTITY-10B TEST RESULTS

| Test | Result | Detail |
|------|--------|--------|
| PI10B-FLAG-01 | PASS | undefined/empty/false → OFF |
| PI10B-FLAG-02 | PASS | true/1 → ON |
| PI10B-FLAG-03 | PASS | request-derived override ignored (fail-closed) |
| PI10B-SCHEMA-01 | PASS | tables=entitlement_definitions,plans,plan_entitlements,tenant_plans |
| PI10B-SCHEMA-02 | PASS | Plan has no tenant_id / price / currency |
| PI10B-SCHEMA-03 | PASS | drizzle/0007_entitlements.sql present |
| PI10B-VALUE-01 | PASS | BOOLEAN valid |
| PI10B-VALUE-02 | PASS | BOOLEAN invalid |
| PI10B-VALUE-03 | PASS | INTEGER valid |
| PI10B-VALUE-04 | PASS | INTEGER invalid |
| PI10B-VALUE-05 | PASS | BYTES valid |
| PI10B-VALUE-06 | PASS | BYTES negative reject |
| PI10B-DOMAIN-01 | PASS | valueType enum + ENUM deferred |
| PI10B-DOMAIN-02 | PASS | enforcementType enum |
| PI10B-PLAN-01 | PASS | create Definition |
| PI10B-PLAN-02 | PASS | duplicate Definition key → reject |
| PI10B-PLAN-03 | PASS | create Plan |
| PI10B-PLAN-04 | PASS | duplicate Plan key → reject |
| PI10B-PLAN-05 | PASS | create PlanEntitlement BOOLEAN |
| PI10B-PLAN-06 | PASS | duplicate PlanEntitlement → reject |
| PI10B-PLAN-07 | PASS | INTEGER 10.5 → reject |
| PI10B-TENANT-01 | PASS | TenantPlan válido |
| PI10B-TENANT-02 | PASS | dois ACTIVE mesmo tenant → reject |
| PI10B-TENANT-03 | PASS | Tenant A isolado de Tenant B |
| PI10B-TENANT-04 | PASS | TenantPlan referencia tenant correto |
| PI10B-TENANT-05 | PASS | Plan global acessível como catálogo |
| PI10B-SEED-01 | PASS | seed idempotente |
| PI10B-SEED-02 | PASS | DEFAULT PLAN = COMPATIBILITY PLAN |
| PI10B-SEED-03 | PASS | compatibility plan has no artificial quota bindings |
| PI10B-REGRESSION-01 | PASS | flag OFF default |
| PI10B-REGRESSION-02 | PASS | flag OFF não bloqueia createTenant |
| PI10B-REGRESSION-03 | PASS | flag ON |
| PI10B-REGRESSION-04 | PASS | flag ON não introduz enforcement nesta fase |
| PI10B-PLAN-08 | PASS | deactivate Plan with ACTIVE TenantPlan → reject |
| PI10B-PLAN-09 | PASS | Plan soft-deactivate via active=false |

Generated: 2026-09-25T15:27:14.147Z

PI-10B NÃO implementa enforcement.