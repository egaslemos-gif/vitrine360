# PLATFORM-IDENTITY-02 — Permission Matrix

**Date:** 2026-09-23  
**Design catalogues only — not implemented in code**

---

## 1. Platform permissions (conceptual catalogue)

| Permission | Intent |
|------------|--------|
| `platform.tenants.read` | List/search tenants, status, plan binding |
| `platform.tenants.manage` | Create tenant, rename, metadata |
| `platform.tenants.suspend` | Suspend / reactivate tenant |
| `platform.plans.read` | View plan catalogue |
| `platform.plans.manage` | Create/update plans |
| `platform.pricing.manage` | Prices / currency / intervals |
| `platform.subscriptions.read` | View subscriptions |
| `platform.subscriptions.manage` | Attach/change/cancel subscriptions |
| `platform.billing.read` | Invoices, payment status |
| `platform.billing.manage` | Refunds, manual adjustments (restricted) |
| `platform.usage.read` | Global / per-tenant usage |
| `platform.entitlements.manage` | Override or inspect effective entitlements |
| `platform.settings.manage` | Global platform settings |
| `platform.audit.read` | Platform audit stream |
| `platform.support.session.start` | Open audited Tenant Support Context |
| `platform.staff.manage` | Assign platform roles (SUPER only) |

### Suggested role → platform permission (target)

| Permission | SUPER | ADMIN | SUPPORT | VIEWER |
|------------|:-----:|:-----:|:-------:|:------:|
| tenants.read | ✓ | ✓ | ✓ | ✓ |
| tenants.manage | ✓ | ✓ | | |
| tenants.suspend | ✓ | ✓* | | |
| plans.* | ✓ | read / manage split | | read |
| pricing.manage | ✓ | optional | | |
| subscriptions.read | ✓ | ✓ | ✓ | ✓ |
| subscriptions.manage | ✓ | ✓ | | |
| billing.read | ✓ | ✓ | limited | ✓ |
| billing.manage | ✓ | optional SoD | | |
| usage.read | ✓ | ✓ | ✓ | ✓ |
| entitlements.manage | ✓ | ✓ | | |
| settings.manage | ✓ | ✓ | | |
| audit.read | ✓ | ✓ | own+tenant support | ✓ |
| support.session.start | ✓ | ✓ | ✓ | |
| staff.manage | ✓ | | | |

\*suspend may require SUPER or dual-control later.

---

## 2. Tenant permissions (conceptual — mapped from product today)

Current code uses coarse names (`manage_devices`, …). Target catalogue is **namespaced** for clarity; mapping is conceptual.

| Target permission | Maps from today | SUPER | ADMIN | EDITOR | OPERATOR | VIEWER |
|-------------------|-----------------|:-----:|:-----:|:------:|:--------:|:------:|
| `tenant.dashboard.read` | `view_dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `tenant.devices.read` | (implied by manage) | ✓ | ✓ | | ✓ | ✓* |
| `tenant.devices.manage` | `manage_devices` | ✓ | ✓ | | ✓ | |
| `tenant.groups.manage` | `manage_devices` | ✓ | ✓ | | ✓ | |
| `tenant.contents.read` | (implied) | ✓ | ✓ | ✓ | | ✓* |
| `tenant.contents.manage` | `manage_contents` | ✓ | ✓ | ✓ | | |
| `tenant.media.manage` | `manage_contents` | ✓ | ✓ | ✓ | | |
| `tenant.playlists.manage` | `manage_playlists` | ✓ | ✓ | ✓ | ✓ | |
| `tenant.schedules.manage` | `manage_schedules` | ✓ | ✓ | ✓ | ✓ | |
| `tenant.experiences.manage` | (future; contents-adjacent) | ✓ | ✓ | ✓ | | |
| `tenant.members.read` | part of manage_users | ✓ | ✓ | | | |
| `tenant.members.manage` | `manage_users` | ✓ | ✓ | | | |
| `tenant.settings.manage` | `manage_users` (workspace) | ✓ | ✓ | | | |
| `tenant.audit.read` | `view_logs` | ✓ | ✓ | ✓ | ✓ | ✓ |
| assign `SUPER_ADMIN` membership | special-case today | ✓ | | | | |

\*VIEWER read-only device/content lists optional product decision; today VIEWER mainly dashboard + logs.

**Normalization (Phase C later):** introduce namespaced permissions without changing behaviour — alias old → new.

---

## 3. Platform vs Tenant matrix

| Capability | Platform | Tenant |
|------------|:--------:|:------:|
| Manage tenants (lifecycle) | ✓ | ✗ |
| Manage plans / pricing | ✓ | ✗ |
| Manage billing / subscriptions | ✓ | ✗ |
| Manage feature entitlements (definition) | ✓ | ✗ (consumes) |
| Manage devices | ✗* | ✓ |
| Manage contents / media | ✗* | ✓ |
| Manage playlists / schedules | ✗* | ✓ |
| Manage members | ✗* | ✓ |
| Workspace settings | ✗* | ✓ |

### Asterisk (*) — Platform must not auto-own tenant ops

Platform staff **do not** receive `tenant.devices.manage` (etc.) by holding a platform role.

To touch tenant content:

1. **Support / Impersonation Context** (preferred for ops), or  
2. **Explicit Membership** in that tenant (normal product user path),  
never silent elevation.

Platform *may* change **tenant record** state (suspend) and **entitlements** without opening content APIs.
