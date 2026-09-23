"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

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
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { open, onOpenChange } = React.useContext(DialogCtx);
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className={cn(
          "w-full max-w-lg rounded-xl bg-background p-6 shadow-xl animate-in fade-in zoom-in-95 relative",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
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
  return (
    <div className={cn("mb-4", className)}>{children}</div>
  );
}

export function DialogTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("text-lg font-semibold", className)}>{children}</h2>
  );
}
