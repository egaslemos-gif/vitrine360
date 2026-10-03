/**
 * V360 Logo — Official standardized brand mark for Vitrine360.
 *
 * Includes:
 * 1. Digital signage screen / display element (ecrã / tela) with stand
 * 2. Dark glass screen reflection
 * 3. Illuminated "V" mark centered on the display
 * 4. 360° broadcast orbit arc with satellite beacon
 * 5. Live broadcast status LED (active player)
 * 6. Standardized typographic wordmark ("V360" or "Vitrine360")
 */

export type LogoSize = "sm" | "md" | "lg" | "xl";
export type LogoWordmark = "short" | "full" | "none";

const SIZE_MAP: Record<
  LogoSize,
  { icon: number; text: string; numText: string; gap: string }
> = {
  sm: { icon: 24, text: "text-[0.85rem]", numText: "text-[0.75rem]", gap: "gap-1.5" },
  md: { icon: 30, text: "text-[1.05rem]", numText: "text-[0.9rem]", gap: "gap-2" },
  lg: { icon: 38, text: "text-[1.4rem]", numText: "text-[1.15rem]", gap: "gap-2.5" },
  xl: { icon: 46, text: "text-[1.85rem]", numText: "text-[1.55rem]", gap: "gap-3" },
};

export function V360Logo({
  size = "md",
  collapsed = false,
  wordmark = "short",
  className = "",
}: {
  size?: LogoSize;
  collapsed?: boolean;
  wordmark?: LogoWordmark;
  className?: string;
}) {
  const s = SIZE_MAP[size];
  const showText = !collapsed && wordmark !== "none";

  return (
    <div
      className={`inline-flex items-center ${s.gap} select-none ${className}`}
      title="Vitrine360"
    >
      {/* SVG Screen/Display Icon Mark */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_1px_3px_rgba(88,64,180,0.18)]"
        aria-hidden
      >
        <defs>
          {/* Bezel and stand gradient */}
          <linearGradient
            id="v360-bezel-grad"
            x1="2"
            y1="2"
            x2="30"
            y2="28"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#5b21b6" />
          </linearGradient>

          {/* Screen interior glass gradient (dark illuminated display) */}
          <linearGradient
            id="v360-glass-grad"
            x1="4"
            y1="4"
            x2="28"
            y2="21"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#2e1065" />
          </linearGradient>

          {/* Neon "V" letterform on display */}
          <linearGradient
            id="v360-v-grad"
            x1="10"
            y1="7"
            x2="22"
            y2="17"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#e0e7ff" />
            <stop offset="45%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>

          {/* 360 Orbit Arc gradient */}
          <linearGradient
            id="v360-orbit-grad"
            x1="0"
            y1="0"
            x2="32"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#7057dc" />
          </linearGradient>
        </defs>

        {/* 360° Broadcast Orbit Arc — sweeps over the digital screen */}
        <path
          d="M 28 8.5 A 14 14 0 0 0 5.5 3.5"
          stroke="url(#v360-orbit-grad)"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.45"
        />
        <circle cx="28" cy="8.5" r="1.4" fill="url(#v360-bezel-grad)" />

        {/* Display Screen Body (A Tela / O Ecrã) */}
        <rect
          x="3.5"
          y="4"
          width="25"
          height="16.5"
          rx="3"
          fill="url(#v360-glass-grad)"
          stroke="url(#v360-bezel-grad)"
          strokeWidth="1.75"
        />

        {/* Screen Glass Reflection Sheen */}
        <path
          d="M 4.5 5.2 L 27.5 5.2 C 27.5 5.2 20 8.5 4.5 8 Z"
          fill="white"
          opacity="0.12"
        />

        {/* The "V" (Vitrine) glowing content on the screen */}
        <path
          d="M 10 8.2 L 16 16 L 22 8.2"
          stroke="url(#v360-v-grad)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Live Broadcast Status LED on Screen (Active Player / Live Signage) */}
        <circle cx="25" cy="7" r="1" fill="#22c55e" />

        {/* Screen Stand — Neck and Base (Universal Display Silhouette) */}
        <path
          d="M 16 20.5 V 24.5"
          stroke="url(#v360-bezel-grad)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M 11 24.5 H 21"
          stroke="url(#v360-bezel-grad)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      {/* Brand Text */}
      {showText && (
        <span className="flex items-baseline gap-px leading-none tracking-tight">
          <span className={`${s.text} font-black text-[var(--color-primary)]`}>
            {wordmark === "full" ? "Vitrine" : "V"}
          </span>
          <span
            className={`${s.numText} font-bold text-[var(--color-foreground)]`}
          >
            360
          </span>
        </span>
      )}
    </div>
  );
}
