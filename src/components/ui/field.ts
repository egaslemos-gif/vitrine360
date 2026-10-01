/** Shared native form-control classes — avoid `flex` on replaced elements. */
export const fieldControlClass =
  "box-border block h-10 w-full min-w-0 max-w-full rounded-2xl border border-[var(--color-input)] bg-white/90 px-4 py-1 text-sm shadow-[var(--shadow-subtle)] transition-colors placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50";

export const nativeSelectClass =
  "box-border block h-10 w-full min-w-0 max-w-full rounded-2xl border border-[var(--color-input)] bg-white/90 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50";

export const fieldStackClass = "block w-full min-w-0 space-y-2";

export const formShellClass =
  "w-[min(100%,36rem)] max-w-full shrink-0";
