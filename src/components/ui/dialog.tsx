"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ModalOverlay, ModalPanel } from "@/components/ui/modal-shell";
import { useIsClient } from "@/lib/use-is-client";

/* ── Dialog Root ── */
type DialogContextType = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};
const DialogCtx = React.createContext<DialogContextType>({
  open: false,
  onOpenChange: () => {},
});

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogCtx.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogCtx.Provider>
  );
}

/* ── Overlay + Content ── */
export function DialogContent({
  children,
  className,
  size = "md",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const { open, onOpenChange } = React.useContext(DialogCtx);
  const mounted = useIsClient();
  if (!open || !mounted) return null;

  return createPortal(
    <ModalOverlay onClose={() => onOpenChange(false)}>
      <ModalPanel
        size={size}
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </ModalPanel>
    </ModalOverlay>,
    document.body,
  );
}

/* ── Header / Title ── */
export function DialogHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("mb-4 pr-8", className)}>{children}</div>;
}

export function DialogTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-snug text-[var(--color-foreground)]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function DialogFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
