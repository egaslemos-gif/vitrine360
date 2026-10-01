"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export type LandingNavItem = { href: string; label: string };

/** Compact navigation for < md screens (landing header). */
export function LandingMobileMenu({
  items,
  signInHref,
  signInLabel,
}: {
  items: LandingNavItem[];
  signInHref: string;
  signInLabel: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="landing-mobile-nav"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)]"
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </button>

      {open ? (
        <nav
          id="landing-mobile-nav"
          aria-label="Navegação"
          className="absolute inset-x-0 top-full border-b border-white/10 bg-[#0a0a12]/95 px-4 pb-5 pt-2 shadow-2xl backdrop-blur-xl"
        >
          <ul className="mx-auto max-w-7xl divide-y divide-white/10">
            {items.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-[15px] font-medium text-white/85 hover:text-white"
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <Link
                href={signInHref}
                className="block py-3 text-[15px] font-medium text-white/85 hover:text-white"
              >
                {signInLabel}
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
