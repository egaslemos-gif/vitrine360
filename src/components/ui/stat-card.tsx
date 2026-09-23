import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "info" | "success" | "danger" | "accent" | "warning";

/** Compact operational metric — value dominant, low height. */
export function StatCard({
  title,
  value,
  hint,
  icon,
  tone = "neutral",
  className,
}: {
  title: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: StatTone;
  className?: string;
}) {
  void tone;
  void icon;
  return (
    <Card
      className={cn(
        "border border-[var(--color-border)] bg-[var(--color-surface)] shadow-none",
        className,
      )}
    >
      <CardContent className="px-4 py-3">
        <p className="ui-caption font-medium uppercase tracking-wide">{title}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)]">
          {value}
        </p>
        {hint ? <p className="ui-caption mt-0.5">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
