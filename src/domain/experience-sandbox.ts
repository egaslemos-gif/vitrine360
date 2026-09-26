/**
 * RUNTIME-EXPERIENCE-06 — Sandbox host policy builders (pure domain).
 *
 * Builds iframe sandbox / allow / referrer attributes and related CSP fragments.
 * Does NOT implement postMessage bridge or Player playback integration.
 */

import type { ExperienceOriginConfig } from "@/domain/experience-origin";
import { isDedicatedOriginConfigured } from "@/domain/experience-origin";

/** Sandbox tokens we may ever enable — deny-by-default. */
export const SANDBOX_TOKENS = [
  "allow-scripts",
  "allow-same-origin",
  "allow-forms",
  "allow-popups",
  "allow-modals",
  "allow-downloads",
  "allow-top-navigation",
  "allow-top-navigation-by-user-activation",
  "allow-pointer-lock",
  "allow-presentation",
] as const;
export type SandboxToken = (typeof SANDBOX_TOKENS)[number];

export type ExperienceSandboxPolicy = {
  /** Space-separated sandbox attribute value. */
  sandbox: string;
  /** iframe `allow` Permissions-Policy fragment. */
  allow: string;
  referrerPolicy: "no-referrer";
  /** Extra attrs for defence in depth. */
  loading: "eager" | "lazy";
  /**
   * When true, parent must not treat this as privileged same-origin content.
   * Dedicated origin is required for allow-same-origin.
   */
  dedicatedOriginRequired: boolean;
};

export type BuildSandboxPolicyInput = {
  experienceOrigin: ExperienceOriginConfig;
  appOrigin?: string | null;
  /**
   * Storage / same-origin features inside the Experience origin.
   * Only granted when dedicated origin is configured (never on privileged app origin).
   */
  allowSameOriginOnDedicatedOrigin?: boolean;
};

/**
 * Deny-by-default sandbox.
 *
 * - Always: allow-scripts (interactive HTML needs it when admitted).
 * - allow-same-origin: ONLY when Experience is on a dedicated origin distinct from app.
 * - Never default: popups, top-navigation, downloads, forms, pointer-lock, presentation.
 */
export function buildExperienceSandboxPolicy(
  input: BuildSandboxPolicyInput,
): ExperienceSandboxPolicy {
  const dedicated = isDedicatedOriginConfigured(
    input.experienceOrigin,
    input.appOrigin,
  );
  const tokens: SandboxToken[] = ["allow-scripts"];
  const wantSame =
    input.allowSameOriginOnDedicatedOrigin !== false && dedicated;
  if (wantSame) {
    tokens.push("allow-same-origin");
  }

  // Permissions-Policy via iframe allow= — all powerful features disabled by default.
  // Fullscreen/orientation mediated later via bridge (EXPERIENCE-07), not free iframe allow.
  const allow = [
    "camera 'none'",
    "microphone 'none'",
    "geolocation 'none'",
    "payment 'none'",
    "usb 'none'",
    "accelerometer 'none'",
    "gyroscope 'none'",
    "magnetometer 'none'",
    "clipboard-read 'none'",
    "clipboard-write 'none'",
    "display-capture 'none'",
    "fullscreen 'none'",
  ].join("; ");

  return {
    sandbox: tokens.join(" "),
    allow,
    referrerPolicy: "no-referrer",
    loading: "eager",
    dedicatedOriginRequired: !dedicated,
  };
}

/**
 * Host (parent) CSP fragment recommendations for pages that embed Experiences.
 * Not applied automatically to /player in this phase (no Player wire).
 */
export function buildHostEmbedCspFragment(experienceOrigin: string | null): string {
  const frameSrc = experienceOrigin
    ? `frame-src ${experienceOrigin}`
    : "frame-src 'self'";
  return [
    "object-src 'none'",
    frameSrc,
    "base-uri 'self'",
  ].join("; ");
}

/**
 * frame-ancestors for package responses so the app origin may embed them.
 * Prefer CSP over X-Frame-Options when embedding cross-origin.
 */
export function buildServeFrameAncestors(opts: {
  appOrigin: string | null;
  /** Also allow framing by the experience origin itself. */
  includeSelf?: boolean;
}): string {
  const parts: string[] = [];
  if (opts.includeSelf !== false) parts.push("'self'");
  if (opts.appOrigin) {
    try {
      parts.push(new URL(opts.appOrigin).origin);
    } catch {
      /* ignore */
    }
  }
  return parts.join(" ") || "'none'";
}

export type ExperienceSandboxSrcInput = {
  tenantId: string;
  experienceId: string;
  version: string;
  /** Absolute or path serve URL already built. */
  src: string;
};

export function assertSafeExperienceIframeSrc(
  src: string,
  experienceOrigin: ExperienceOriginConfig,
): { ok: true } | { ok: false; reason: string } {
  if (!src || typeof src !== "string") {
    return { ok: false, reason: "empty src" };
  }
  if (src.startsWith("javascript:") || src.startsWith("data:") || src.startsWith("blob:")) {
    return { ok: false, reason: "forbidden src scheme" };
  }
  if (src.startsWith("/x/")) {
    return { ok: true };
  }
  try {
    const u = new URL(src);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return { ok: false, reason: "unsupported protocol" };
    }
    if (experienceOrigin.hosts.length > 0) {
      if (!experienceOrigin.hosts.includes(u.hostname.toLowerCase())) {
        return { ok: false, reason: "src host not in EXPERIENCE_ORIGIN hosts" };
      }
    }
    if (!u.pathname.startsWith("/x/")) {
      return { ok: false, reason: "src path must be under /x/" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "invalid URL" };
  }
}
