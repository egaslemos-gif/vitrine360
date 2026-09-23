"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle, X } from "lucide-react";

export function InfoTooltip({ text, title }: { text: React.ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="ml-1 text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-full transition-colors"
        aria-label="Ajuda sobre este campo"
        aria-expanded={open}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-md border border-[var(--color-border)] bg-white p-4 shadow-lg ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-2">
            {title && (
              <h4 className="mb-2 text-sm font-semibold text-[var(--color-foreground)]">
                {title}
              </h4>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="text-xs text-[var(--color-muted-foreground)] leading-relaxed">
            {text}
          </div>
        </div>
      )}
    </div>
  );
}
