# SECURITY SMOKE

## Audit Checklist
*(QA Operator: Inspect network responses and logs)*

- [ ] Device Bearer NOT exposed in command payload
- [ ] JWT NOT exposed
- [ ] AUTH_SECRET NOT exposed
- [ ] R2 credentials NOT exposed
- [ ] AWS credentials NOT exposed
- [ ] Tenant secrets NOT exposed
- [ ] Sensitive cookies NOT exposed
- [ ] Signed media URLs NOT exposed unnecessarily

## Tenant / Device Isolation Test
- **Test Setup**: [PENDING]
- **Attempt**: Tenant A sending command to Device B.
- **Expected**: DENY.
- **Result**: [PENDING]
