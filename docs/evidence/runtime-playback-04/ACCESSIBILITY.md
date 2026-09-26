# ACCESSIBILITY

aria-label on buttons; aria-pressed only when boolean (Play/Pause & Mute); seek/volume valuemin/max/now/valuetext; focus-visible outline; 44px targets.

## Hydration (RP-04 CONTROL-041)

**Did not exist before RP-04** — introduced when PlaybackControls + DisplayEngine shared `/player/lab`.

Root causes fixed:
1. `useSyncExternalStore` server `EMPTY` vs client `Date.now()` init
2. Chrome SSR of live controls/viewport before playlist load
3. Soft-nav restoring client tree against fresh RSC HTML

Fix: deterministic controller init; pristine → `EMPTY`; chrome `controlsReady` defer; lab `dynamic(ssr:false)` from Client Component. No `suppressHydrationWarning`.

Hydration warning: **RESOLVED**
