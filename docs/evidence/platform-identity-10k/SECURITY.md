# PI-10K Security Matrix

| ID | Scenario | Result |
|----|----------|--------|
| PI10K-SEC-001 | cross-tenant device quota | PASS |
| PI10K-SEC-002 | cross-tenant storage reservation | PASS |
| PI10K-SEC-003 | client cannot override maxBytes | PASS |
| PI10K-SEC-004 | client cannot override usage | PASS |
| PI10K-SEC-005 | client cannot approve quota | PASS |
| PI10K-SEC-006 | SUPER_ADMIN cannot bypass quota | PASS |
| PI10K-SEC-007 | PLATFORM_SUPER_ADMIN cannot bypass quota | PASS |
| PI10K-SEC-008 | Device Bearer cannot bypass quota | PASS |
| PI10K-SEC-009 | SUSPENDED tenant cannot allocate | PASS |
| PI10K-SEC-010 | quota failure cannot result in upload | PASS |
| PI10K-SEC-011 | actual > reserved cannot commit | PASS |
| PI10K-SEC-012 | same operationId cannot duplicate reservation | PASS |
| PI10K-SEC-013 | same checksum cannot create duplicate MediaAsset | PASS |
| PI10K-SEC-014 | cross-tenant same checksum remains isolated | PASS |
