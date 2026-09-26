# FLAG-MATRIX — PI-10G

| Scenario | Flag | Plan | Usage | Max | Operation | Expected |
|---|---|---|---:|---:|---|---|
| Legacy | OFF | any | any | any | pair | ALLOW (legacy) |
| Under quota | ON | active | 0 | 1 | pair | ALLOW |
| At limit | ON | active | 1 | 1 | pair | DENY |
| Over after downgrade | ON | downgraded | 5 | 2 | pair | DENY |
| Existing overage | ON | downgraded | 5 | 2 | existing devices | ALLOW (kept) |
| Delete overage | ON | downgraded | >max | max | delete | ALLOW |
| Disable overage | ON | downgraded | >max | max | disable | ALLOW |
| Reactivate overage | ON | downgraded | ≥max | max | reactivate | DENY |
| Upgrade | ON | upgraded | 2 | 10 | pair | ALLOW |
| Offline | ON | active | 1 | 1 | offline/heartbeat | no usage change |
| Suspended | ON | active | 0 | 10 | API allocate | DENY (lifecycle) |
| No plan | ON | none | 0 | — | pair | DENY |
| Flag off mid | OFF | none | — | — | pair | ALLOW |

Default production: **OFF**.
