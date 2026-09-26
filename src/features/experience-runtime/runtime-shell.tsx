"use client";

/**
 * RUNTIME-EXPERIENCE-10 — Experience Runtime Shell.
 *
 * Hosts an ADMITTED Experience in ExperienceSandboxFrame + Controlled Bridge v1.
 * Lifecycle via ExperienceRuntimeController.
 * Wired into Player via EXPERIENCE-11 ExperiencePlaybackSlide (after admission).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExperienceAdmissionGranted } from "@/domain/experience-admission";
import {
  parseExperienceOriginConfig,
  type ExperienceOriginConfig,
} from "@/domain/experience-origin";
import {
  ExperienceRuntimeController,
  planExperienceRuntimeStart,
  type ExperienceRuntimeSnapshot,
} from "@/domain/experience-runtime";
import { ExperienceSandboxFrame } from "@/features/experience-sandbox/sandbox-frame";

export type ExperienceRuntimeShellProps = {
  granted: ExperienceAdmissionGranted;
  experienceOrigin?: ExperienceOriginConfig;
  appOrigin?: string | null;
  className?: string;
  title?: string;
  enableBridge?: boolean;
  loadTimeoutMs?: number;
  /** Auto-start when mounted (default true). */
  autoStart?: boolean;
  onStateChange?: (snapshot: ExperienceRuntimeSnapshot) => void;
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

export function ExperienceRuntimeShell(props: ExperienceRuntimeShellProps) {
  const origin = props.experienceOrigin ?? defaultOriginConfig();
  const appOrigin =
    props.appOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? null;

  const controllerRef = useRef<ExperienceRuntimeController | null>(null);
  const [snapshot, setSnapshot] = useState<ExperienceRuntimeSnapshot | null>(
    null,
  );
  const onStateRef = useRef(props.onStateChange);
  useEffect(() => {
    onStateRef.current = props.onStateChange;
  }, [props.onStateChange]);

  const plan = useMemo(
    () =>
      planExperienceRuntimeStart({
        granted: props.granted,
        experienceOrigin: origin,
        enableBridge: props.enableBridge,
        loadTimeoutMs: props.loadTimeoutMs,
      }),
    // granted fields + origin — avoid unstable object identity churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.granted.tenantId,
      props.granted.deviceId,
      props.granted.experienceId,
      props.granted.version,
      props.granted.packageSha256,
      props.granted.manifest.entrypoint,
      origin.origin,
      props.enableBridge,
      props.loadTimeoutMs,
    ],
  );

  useEffect(() => {
    const ctl = new ExperienceRuntimeController({
      onChange: (s) => {
        setSnapshot(s);
        onStateRef.current?.(s);
      },
    });
    controllerRef.current = ctl;

    if (props.autoStart !== false) {
      ctl.start({
        granted: props.granted,
        experienceOrigin: origin,
        enableBridge: props.enableBridge,
        loadTimeoutMs: props.loadTimeoutMs,
      });
      if (plan.ok) ctl.markInit();
    }

    return () => {
      ctl.stop();
      ctl.dispose();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.granted.tenantId,
    props.granted.experienceId,
    props.granted.version,
    props.granted.packageSha256,
    origin.origin,
    props.autoStart,
  ]);

  const phase = snapshot?.phase ?? "IDLE";
  const mount =
    plan.ok &&
    (phase === "LOADING" ||
      phase === "INIT" ||
      phase === "READY" ||
      phase === "ACTIVE" ||
      phase === "PAUSED");

  return (
    <div
      className={props.className}
      data-experience-runtime="shell"
      data-phase={phase}
      data-error={snapshot?.error?.code ?? (!plan.ok ? plan.code : undefined)}
    >
      {mount && plan.ok ? (
        <ExperienceSandboxFrame
          src={plan.entrypointUrl}
          title={props.title ?? props.granted.manifest.name}
          experienceOrigin={origin}
          appOrigin={appOrigin}
          onRejectSrc={(reason) => {
            controllerRef.current?.markLoadFailed(reason);
          }}
          onLoadSuccess={() => {
            controllerRef.current?.markReady();
          }}
          bridge={
            plan.enableBridge
              ? {
                  tenantId: props.granted.tenantId,
                  experienceId: props.granted.experienceId,
                  version: props.granted.version,
                  expectedOrigin: plan.expectedOrigin,
                  permissions: [...plan.bridgePermissions],
                  capabilities: plan.bridgeCapabilities,
                }
              : undefined
          }
        />
      ) : (
        <div
          role="status"
          data-experience-runtime="fallback"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            minHeight: 120,
            background: "#0b1220",
            color: "rgba(255,255,255,0.55)",
            fontFamily: "system-ui, sans-serif",
            fontSize: 14,
          }}
        >
          {phase === "ERROR" || !plan.ok
            ? `Experience unavailable (${snapshot?.error?.code ?? (!plan.ok ? plan.code : "ERROR")})`
            : phase === "KILLED"
              ? "Experience killed"
              : phase === "STOPPED"
                ? "Experience stopped"
                : "Experience idle"}
        </div>
      )}
    </div>
  );
}
