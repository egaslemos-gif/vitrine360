# RATIONALE — Decision Closure

## Why PAIRED_NON_DISABLED

Digital signage inventory is the licensed unit. Offline TVs still consume a slot. DISABLED is the product’s soft-retire path (`setDeviceStatus`), so it must free quota. Unpaired PENDING bootstrap must never consume tenant quota.

## Why BLOCK NEW + ALLOW EXISTING

Destructive auto-disable on downgrade risks black screens without operator intent. Blocking growth is fail-closed and reversible (delete/disable frees slots). Grace periods need product UX + jobs — not required to start `devices.max` enforcement behind the flag.
