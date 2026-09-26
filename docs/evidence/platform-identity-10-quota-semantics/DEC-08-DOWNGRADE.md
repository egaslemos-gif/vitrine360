# DEC-08-DOWNGRADE — CLOSED

## Decision

**BLOCK NEW + ALLOW EXISTING**

When `usage > HARD_LIMIT` after plan downgrade (or any EffectiveEntitlements shrink):

1. Existing counted resources keep operating.
2. Operations that would **increase** Usage are DENY.
3. Reactivate DISABLED → counted status is a **new allocation** (subject to limit).
4. No automatic DISABLED of excess, no grace timer, no tenant SUSPEND solely for overage (v1).

Upgrade never reduces Usage; never forces action.

## PI-10G implication

`pairDevice` / future create paths: if flag ON and `evaluateQuota(HARD)` DENY → ENTITLEMENT_DENIED.  
Existing paired devices: unaffected by downgrade alone.
