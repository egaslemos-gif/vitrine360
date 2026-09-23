/** Shared native form-control classes — avoid `flex` on replaced elements. */
export const fieldControlClass =
  "box-border block h-9 w-full min-w-0 max-w-full rounded-md border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50";

export const nativeSelectClass =
  "box-border block h-9 w-full min-w-0 max-w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50";

export const fieldStackClass = "block w-full min-w-0 space-y-2";

export const formShellClass = "block w-full min-w-0 max-w-xl";
