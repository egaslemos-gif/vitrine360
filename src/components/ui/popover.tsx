"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Popover ── */
type PopoverCtx = { open: boolean; toggle: () => void; close: () => void };
const Ctx = React.createContext<PopoverCtx>({
  open: false,
  toggle: () => {},
  close: () => {},
});

export function Popover({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Ctx.Provider
      value={{
        open,
        toggle: () => setOpen((v) => !v),
        close: () => setOpen(false),
      }}
    >
      <div className="relative">{children}</div>
    </Ctx.Provider>
  );
}

export function PopoverTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const { toggle } = React.useContext(Ctx);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      onClick: (e: React.MouseEvent) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (children as React.ReactElement<Record<string, unknown>> & { props: Record<string, any> }).props?.onClick?.(e);
        toggle();
      },
    });
  }
  return (
    <button type="button" onClick={toggle}>
      {children}
    </button>
  );
}

export function PopoverContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { open, close } = React.useContext(Ctx);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      className={cn(
        "absolute right-0 z-50 mt-2 rounded-md border bg-background p-4 shadow-lg animate-in fade-in-0 zoom-in-95",
        className,
      )}
    >
      {children}
    </div>
  );
}
