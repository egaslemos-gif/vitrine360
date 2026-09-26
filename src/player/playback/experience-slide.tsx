"use client";

/**
 * RUNTIME-EXPERIENCE-11 — EXPERIENCE slide host for React DisplayEngine.
 *
 * Flow: pin → device admit API → ExperienceRuntimeShell → cleanup on unmount.
 * Fail closed to safe-fallback. Never passes tokens into the iframe.
 */

import { useEffect, useState, type CSSProperties } from "react";
import type { ExperienceAdmissionDecision } from "@/domain/experience-admission";
import { parseExperienceOriginConfig } from "@/domain/experience-origin";
import { ExperienceRuntimeShell } from "@/features/experience-runtime";
import { getConfig } from "@/player/cache/indexed-db";
import { probeRuntimeCapabilities } from "@/player/runtime/capabilities";
import {
  parsePlaybackExperiencePin,
  playbackStatusFromAdmission,
} from "@/player/runtime/experience-controller";
import type { PlaybackItem } from "@/player/playback/display-engine";

const stageStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

type AdmitState =
  | { status: "loading" }
  | { status: "denied"; code: string; message: string }
  | { status: "admitted"; decision: Extract<ExperienceAdmissionDecision, { outcome: "ADMIT" }> }
  | { status: "blocked"; code: string };

function SafeFallback({
  title,
  code,
  pinLabel,
}: {
  title: string;
  code: string;
  pinLabel?: string;
}) {
  return (
    <div
      style={{
        ...stageStyle,
        flexDirection: "column",
        textAlign: "center",
        padding: "0 8vw",
        background:
          "linear-gradient(160deg,#0b1220 0%,#132033 55%,#1a2740 100%)",
      }}
      data-experience-playback="safe-fallback"
      data-experience-block={code}
    >
      <p className="text-sm tracking-[0.4em] text-white/40">VITRINE360</p>
      <h1
        className="mt-8 max-w-5xl text-4xl font-semibold leading-tight md:text-5xl"
        style={{ fontFamily: "var(--font-fraunces), serif" }}
      >
        {title}
      </h1>
      <p className="mt-6 text-lg text-white/55">{code}</p>
      {pinLabel ? (
        <p className="mt-3 font-mono text-sm text-white/35">{pinLabel}</p>
      ) : null}
    </div>
  );
}

export function ExperiencePlaybackSlide({ item }: { item: PlaybackItem }) {
  const pin = parsePlaybackExperiencePin(item.payload);
  const blocked =
    item.experienceExecutable === false || !pin?.experienceId || !pin?.version;

  const [admit, setAdmit] = useState<AdmitState>(() =>
    blocked
      ? {
          status: "blocked",
          code: item.experienceBlockReason ?? "EXPERIENCE_UNAVAILABLE",
        }
      : { status: "loading" },
  );

  useEffect(() => {
    if (blocked || !pin) return;

    let cancelled = false;

    (async () => {
      try {
        const config = await getConfig();
        const token = config?.deviceToken;
        if (!token) {
          if (!cancelled) {
            setAdmit({
              status: "denied",
              code: "ADMISSION_DEVICE_DISABLED",
              message: "Missing device token",
            });
          }
          return;
        }

        const detected = probeRuntimeCapabilities();
        const res = await fetch("/api/device/experience/admit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            experienceId: pin.experienceId,
            version: pin.version,
            detected,
          }),
        });

        if (!res.ok) {
          if (!cancelled) {
            setAdmit({
              status: "denied",
              code: `HTTP_${res.status}`,
              message: "Admission request failed",
            });
          }
          return;
        }

        const json = (await res.json()) as {
          decision?: ExperienceAdmissionDecision;
        };
        const decision = json.decision;
        if (!decision) {
          if (!cancelled) {
            setAdmit({
              status: "denied",
              code: "ADMISSION_POLICY_DENIED",
              message: "Malformed admission response",
            });
          }
          return;
        }

        const mapped = playbackStatusFromAdmission(decision);
        if (!cancelled) {
          if (mapped.ok) {
            setAdmit({
              status: "admitted",
              decision: { outcome: "ADMIT", granted: mapped.granted },
            });
          } else {
            setAdmit({
              status: "denied",
              code: mapped.code,
              message: mapped.message,
            });
          }
        }
      } catch (e) {
        if (!cancelled) {
          setAdmit({
            status: "denied",
            code: "ADMISSION_POLICY_DENIED",
            message: e instanceof Error ? e.message : "Admission failed",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    blocked,
    pin,
    item.playlistItemId,
    item.contentId,
  ]);

  const pinLabel = pin ? `${pin.experienceId}@${pin.version}` : undefined;

  if (admit.status === "blocked") {
    return (
      <SafeFallback title={item.title} code={admit.code} pinLabel={pinLabel} />
    );
  }

  if (admit.status === "loading") {
    return (
      <SafeFallback
        title={item.title}
        code="EXPERIENCE_ADMITTING"
        pinLabel={pinLabel}
      />
    );
  }

  if (admit.status === "denied") {
    return (
      <SafeFallback
        title={item.title}
        code={admit.code}
        pinLabel={pinLabel}
      />
    );
  }

  const origin = parseExperienceOriginConfig({
    EXPERIENCE_ORIGIN:
      process.env.NEXT_PUBLIC_EXPERIENCE_ORIGIN ?? process.env.EXPERIENCE_ORIGIN,
    EXPERIENCE_ORIGIN_HOSTS:
      process.env.NEXT_PUBLIC_EXPERIENCE_ORIGIN_HOSTS ??
      process.env.EXPERIENCE_ORIGIN_HOSTS,
  });

  return (
    <div
      style={{ ...stageStyle, background: "#0b1220" }}
      data-experience-playback="runtime"
      data-experience-id={admit.decision.granted.experienceId}
      data-experience-version={admit.decision.granted.version}
    >
      <ExperienceRuntimeShell
        granted={admit.decision.granted}
        experienceOrigin={origin}
        className="h-full w-full"
        title={item.title}
        enableBridge
        autoStart
      />
    </div>
  );
}
