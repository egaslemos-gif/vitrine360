# PLATFORM-IDENTITY-02 — Entitlement Model

**Date:** 2026-09-23  
**Design only — no engine / tables**

## Permission vs Entitlement

| | **Permission** | **Entitlement** |
|--|----------------|-----------------|
| Question | *Who* may do this? | *Does this tenant’s plan allow this?* |
| Axis | Identity → Role → Permission | Plan → Subscription → Entitlement → Tenant |
| Example | `tenant.devices.manage` | `maxDevices = 25` |
| Example | `tenant.experiences.manage` | `liveMedia = true` |
| Failure | 403 Forbidden | 402/403 Plan limit / feature disabled |
| Changed by | Membership / Platform staff assignment | Billing / plan change / manual override (audited) |

**Never** encode plan limits as roles.  
**Never** use billing webhooks to rewrite `memberships.role`.

## Conceptual flow

```
Identity
  → Permission check (may they?)
  → Entitlement check (may this tenant?)
  → Resource scope (is this object in tenant?)
  → Operation
```

Billing updates **Entitlement state** only.

## Platform domain entities (billing boundary)

```
Plan
  └── Entitlement definitions (features + limits)
Price (amount, interval, currency) → Plan
Subscription → Tenant + Plan (+ Status)
SubscriptionItem
Usage (meters: devices, storage bytes, …)
EffectiveEntitlements (resolved for tenant)
Invoice / Payment / BillingCustomer
```

**Tenant domain consumes** Effective Entitlements; it does not own Plan/Price tables.

## Example entitlements (illustrative)

| Key | Type | Meaning |
|-----|------|---------|
| `maxDevices` | number | Cap on ACTIVE devices |
| `maxStorageBytes` | number | Media library cap |
| `maxUsers` | number | ACTIVE memberships |
| `maxPlaylists` | number | |
| `maxExperiences` | number | |
| `liveMedia` | boolean | Feature flag |
| `advancedScheduling` | boolean | |
| `analytics` | boolean | |
| `customBranding` | boolean | |

## Effective entitlements

```
Plan defaults
  ⊕ Subscription overrides
  ⊕ Manual platform grants (time-boxed, audited)
  = EffectiveEntitlements(tenantId)
```

Platform `platform.entitlements.manage` may grant overrides; Tenant Admin **cannot** raise their own caps.
