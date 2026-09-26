# PERIOD-MODEL — PI-10E

## Period kinds

| Kind | Use |
|------|-----|
| LIFETIME | Cumulative forever |
| CALENDAR_MONTH (UTC) | Default for future monthly meters |
| ROLLING_WINDOW | Optional (e.g. 30d) |
| BILLING_PERIOD | **OPEN** — requires Billing product |
| DAILY / WEEKLY | Possible ops metrics |

## Recommendation

- Default timezone for server aggregates: **UTC**.
- Tenant `timezone` exists for display/schedules — **do not** use for quota boundaries unless product requires (**OPEN**).
- DST: avoided by UTC calendar months.
- Month length: calendar month `[start, nextStart)`.

## Reset

- Period aggregates are immutable after close; new period starts empty.
- Current RESOURCE_COUNT / STORAGE do **not** reset with months — only temporal metrics do.

## Not implemented

No period counters, jobs, or billing alignment in PI-10E.
