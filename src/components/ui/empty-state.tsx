import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)]/60 px-6 py-12 text-center",
        className,
      )}
      role="status"
    >
      {icon ? (
        <div className="mb-3 text-[var(--color-muted-foreground)]">{icon}</div>
      ) : null}
      <p className="text-base font-medium text-[var(--color-foreground)]">
        {title}
      </p>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Não foi possível carregar os dados.",
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 px-6 py-10 text-center",
        className,
      )}
      role="alert"
    >
      <p className="text-base font-medium text-[var(--color-foreground)]">
        {title}
      </p>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingState({
  label = "A carregar…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-10",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent"
        aria-hidden
      />
      <span className="text-sm text-[var(--color-muted-foreground)]">{label}</span>
    </div>
  );
}
