"use client";

/**
 * RUNTIME-EXPERIENCE-06/07 — Sandboxed Experience iframe host + optional bridge.
 *
 * Bridge (EXPERIENCE-07) is opt-in via `bridge` prop. No tokens/cookies.
 * Not wired into Player playback / CONTENT_TYPES.
 */

import { useEffect, useMemo, useRef } from "react";
import {
  assertSafeExperienceIframeSrc,
  buildExperienceSandboxPolicy,
} from "@/domain/experience-sandbox";
import {
  parseExperienceOriginConfig,
  type ExperienceOriginConfig,
} from "@/domain/experience-origin";
import type { BridgePermission } from "@/domain/experience-bridge";
import {
  ExperienceBridgeHost,
  createReadOnlyBridgeServices,
} from "@/features/experience-sandbox/bridge-host";

export type ExperienceSandboxBridgeConfig = {
  tenantId: string;
  experienceId: string;
  version: string;
  /** Exact Experience origin for postMessage targetOrigin + event.origin checks. */
  expectedOrigin: string;
  permissions: BridgePermission[];
  capabilities?: string[];
};

export type ExperienceSandboxFrameProps = {
  /** Absolute or /x/... package entry URL. */
  src: string;
  title?: string;
  className?: string;
  experienceOrigin?: ExperienceOriginConfig;
  appOrigin?: string | null;
  onRejectSrc?: (reason: string) => void;
  /** Fired after iframe load (and bridge attach when configured). */
  onLoadSuccess?: () => void;
  /** When set, attaches Controlled Bridge v1 to this iframe. */
  bridge?: ExperienceSandboxBridgeConfig;
};

function defaultOriginConfig(): ExperienceOriginConfig {
  return parseExperienceOriginConfig({
    EXPERIENCE_ORIGIN:
      process.env.NEXT_PUBLIC_EXPERIENCE_ORIGIN ?? process.env.EXPERIENCE_ORIGIN,
    EXPERIENCE_ORIGIN_HOSTS:
      process.env.NEXT_PUBLIC_EXPERIENCE_ORIGIN_HOSTS ??
      process.env.EXPERIENCE_ORIGIN_HOSTS,
  });
}

export function ExperienceSandboxFrame(props: ExperienceSandboxFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<ExperienceBridgeHost | null>(null);

  const experienceOrigin = props.experienceOrigin ?? defaultOriginConfig();
  const appOrigin =
    props.appOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? null;

  const policy = useMemo(
    () =>
      buildExperienceSandboxPolicy({
        experienceOrigin,
        appOrigin,
      }),
    [experienceOrigin, appOrigin],
  );

  const safe = useMemo(
    () => assertSafeExperienceIframeSrc(props.src, experienceOrigin),
    [props.src, experienceOrigin],
  );

  useEffect(() => {
    return () => {
      bridgeRef.current?.stop();
      bridgeRef.current = null;
    };
  }, []);

  useEffect(() => {
    // Rebuild bridge when config identity changes
    bridgeRef.current?.stop();
    bridgeRef.current = null;
  }, [
    props.bridge?.tenantId,
    props.bridge?.experienceId,
    props.bridge?.version,
    props.bridge?.expectedOrigin,
    props.src,
  ]);

  function attachBridge(): void {
    if (!props.bridge || !safe.ok) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    bridgeRef.current?.stop();
    const host = new ExperienceBridgeHost({
      tenantId: props.bridge.tenantId,
      experienceId: props.bridge.experienceId,
      version: props.bridge.version,
      expectedOrigin: props.bridge.expectedOrigin,
      iframeWindow: win,
      permissions: props.bridge.permissions,
      capabilities: props.bridge.capabilities,
      services: createReadOnlyBridgeServices({
        experienceOrigin: props.bridge.expectedOrigin,
        experienceId: props.bridge.experienceId,
        version: props.bridge.version,
      }),
    });
    host.activate();
    bridgeRef.current = host;
  }

  if (!safe.ok) {
    props.onRejectSrc?.(safe.reason);
    return (
      <div
        role="alert"
        className={props.className}
        data-experience-sandbox="rejected"
        data-reason={safe.reason}
      >
        Experience frame rejected
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title={props.title ?? "Experience"}
      src={props.src}
      className={props.className}
      sandbox={policy.sandbox}
      allow={policy.allow}
      referrerPolicy={policy.referrerPolicy}
      loading={policy.loading}
      data-experience-sandbox="active"
      data-experience-bridge={props.bridge ? "v1" : "off"}
      data-dedicated-origin-required={
        policy.dedicatedOriginRequired ? "true" : "false"
      }
      onLoad={() => {
        attachBridge();
        props.onLoadSuccess?.();
      }}
      style={{ border: 0, width: "100%", height: "100%" }}
    />
  );
}
