# PLAN-CHANGE-MODEL — PI-10E

## Upgrade

Plan BASIC `devices.max=10` (usage 9) → PRO `100`: remain operable; no forced action.

## Downgrade (usage > new max)

Example: usage 12, new max 10.

| Policy | Effect | Pros | Cons |
|--------|--------|------|------|
| **BLOCK NEW** | Deny creates until usage ≤ max | Safe, simple | Existing overage persists |
| ALLOW EXISTING | Implicit with BLOCK NEW | — | — |
| GRACE PERIOD | Soft warn then hard | Better UX | Needs timers/product |
| SUSPEND RESOURCE | Disable excess devices | Frees capacity | Destructive UX |
| SUSPEND TENANT | Lifecycle hammer | Strong | Overbroad |

**Architecture decision (CLOSED):** **BLOCK NEW + ALLOW EXISTING** for HARD_LIMIT overage after downgrade.  
No auto-disable of excess, no grace timer, no tenant suspend-for-overage in v1.  
Reactivate DISABLED counts as NEW allocation. See `docs/PLATFORM-IDENTITY-10-QUOTA-SEMANTICS.md`.

## Plan swap mechanics

- Change ACTIVE TenantPlan (future Plan Management).
- EffectiveEntitlements recompute on next resolve (no cache today).
- Usage unchanged by plan change.

## Missing TenantPlan

When flag ON: resolve → `NO_ACTIVE_PLAN` → deny (PI-10D). Assignment is separate responsibility — not silent default in resolver.
