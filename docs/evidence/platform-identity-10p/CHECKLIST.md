# PI-10P Checklist

## Release gate — Preview OFF Baseline

- [x] dedicated Preview DB exists (`vitrine360-preview`)
- [x] Preview DB != Production DB
- [x] Preview storage namespace exists (`vitrine360-preview`)
- [x] Preview credentials configured on Vercel (Preview target only)
- [x] credentials not exposed in prepare route / logs
- [x] Preview deployment exists (`dpl_4PZzzQ9LLpR1uYbWMUMFct6xjRgA`)
- [x] flag OFF baseline live
- [ ] staging plans / ON cohort live — **next gate**
- [ ] flag ON live — **next gate**
- [ ] rollback live — later
- [x] Production unchanged (env + deployment + no pi10p tenants)
- [x] security checks PASS
- [x] typecheck/lint/build PASS

## Verdict

**PREVIEW OFF BASELINE READY**
