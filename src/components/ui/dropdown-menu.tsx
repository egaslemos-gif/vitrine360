"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── DropdownMenu ── */
type DropdownCtx = { open: boolean; toggle: () => void; close: () => void };
const Ctx = React.createContext<DropdownCtx>({
  open: false,
  toggle: () => {},
  close: () => {},
});

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Ctx.Provider
      value={{
        open,
        toggle: () => setOpen((v) => !v),
        close: () => setOpen(false),
      }}
    >
      <div className="relative inline-block">{children}</div>
    </Ctx.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const { toggle } = React.useContext(Ctx);
  if (asChild && React.isValidElement(children)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (children as any).props?.onClick?.(e);
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

export function DropdownMenuContent({
  children,
  className,
  align = "end",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
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
        "absolute z-50 mt-1 min-w-[160px] rounded-md border bg-background py-1 shadow-lg animate-in fade-in-0 zoom-in-95",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  className,
  asChild,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  asChild?: boolean;
}) {
  const { close } = React.useContext(Ctx);

  if (asChild && React.isValidElement(children)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return React.cloneElement(children as React.ReactElement<any>, {
      className: cn(
        "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted cursor-pointer",
        className,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (children as any).props?.className,
      ),
      onClick: (e: React.MouseEvent) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (children as any).props?.onClick?.(e);
        close();
      },
    });
  }

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted cursor-pointer text-left",
        className,
      )}
      onClick={() => {
        onClick?.();
        close();
      }}
    >
      {children}
    </button>
  );
}
