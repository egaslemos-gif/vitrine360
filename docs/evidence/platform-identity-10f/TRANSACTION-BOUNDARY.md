# TRANSACTION-BOUNDARY — PI-10F

Future HARD_LIMIT path (not implemented):

```
BEGIN IMMEDIATE
  verify tenant / authz (outer)
  resolveUsage(metric)
  evaluateQuota(usage, limit, HARD_LIMIT)
  if DENY → ROLLBACK
  mutate resource
COMMIT
```

PI-10F does not alter existing mutations. Avoid SELECT→check→INSERT outside a single TX (PI-10E DEC-06).
