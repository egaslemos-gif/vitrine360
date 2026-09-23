"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Overlay + panel for admin modals.
 * Uses explicit min()/flex-col so panels do not collapse under flex % width cycles.
 */
export function ModalOverlay({
  children,
  className,
  onClose,
}: {
  children: ReactNode;
  className?: string;
  onClose?: () => void;
}) {
  return (
    <div
      role="presentation"
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm",
        className,
      )}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

export function ModalPanel({
  children,
  className,
  size = "md",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  onClick?: (e: React.MouseEvent) => void;
}) {
  const sizeClass =
    size === "sm"
      ? "max-w-sm"
      : size === "lg"
        ? "max-w-2xl"
        : size === "xl"
          ? "max-w-3xl"
          : "max-w-md";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        // Critical: definite width — avoid w-full alone inside flex row (collapses).
        "relative my-auto w-[min(100%,28rem)] shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-left shadow-[var(--shadow-modal)]",
        size === "sm" && "w-[min(100%,24rem)]",
        size === "lg" && "w-[min(100%,42rem)]",
        size === "xl" && "w-[min(100%,48rem)]",
        sizeClass,
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
