"use client";

import type { DeviceRuntimeObservability } from "@/domain/device-observability";
import { formatStaleAge } from "@/domain/device-observability";
import { Badge } from "@/components/ui/badge";

function Fact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </dt>
      <dd className="text-sm text-[var(--color-foreground)] break-words">
        {value}
      </dd>
    </div>
  );
}

function severityVariant(
  s: string,
): "danger" | "warning" | "muted" | "success" {
  if (s === "ERROR") return "danger";
  if (s === "WARNING") return "warning";
  return "muted";
}

export function DeviceObservabilityPanel({
  obs,
  compact = false,
}: {
  obs: DeviceRuntimeObservability;
  compact?: boolean;
}) {
  const age = formatStaleAge(obs.staleAgeMs);
  const runtimeLabel = obs.runtime.isLastReported
    ? "Último estado reportado"
    : "Estado observado";

  if (compact) {
    return (
      <div
        className="max-w-[240px] space-y-1 rounded border border-[var(--color-border)] bg-[var(--color-secondary)]/40 px-2 py-1.5 text-[10px] leading-snug text-[var(--color-muted-foreground)]"
        aria-label="Observabilidade do runtime"
      >
        <div className="flex flex-wrap items-center gap-1">
          <Badge
            variant={
              obs.presence.status === "ONLINE"
                ? "success"
                : obs.presence.status === "AWAY"
                  ? "warning"
                  : "muted"
            }
            className="text-[9px]"
            aria-label={`Presença ${obs.presence.label}`}
          >
            {obs.presence.label}
          </Badge>
          <span aria-label={`Runtime ${obs.runtime.isPlaying ? "a reproduzir" : "idle"}`}>
            {obs.playback.observedStatus ??
              (obs.runtime.isPlaying ? "PLAYING" : "IDLE")}
          </span>
          {obs.runtime.syncState ? (
            <span>· Sync {obs.runtime.syncState}</span>
          ) : null}
        </div>
        <div>
          {runtimeLabel}
          {age ? ` · ${age}` : ""}
          {obs.stale ? " · desactualizado" : ""}
        </div>
        <div>
          Manifest v{obs.runtime.currentManifestVersion ?? "—"}
          {obs.content.id
            ? ` · ${obs.content.available ? obs.content.title ?? obs.content.id.slice(0, 8) : "Content unavailable"}`
            : ""}
        </div>
        <div>
          Policy: {obs.policy.policySource ?? "—"} · Net:{" "}
          {obs.runtime.networkState ?? "—"} (browser)
        </div>
        {(obs.diagnosticCounts.warnings > 0 ||
          obs.diagnosticCounts.info > 0 ||
          obs.diagnosticCounts.errors > 0) && (
          <div>
            Diag E{obs.diagnosticCounts.errors} W
            {obs.diagnosticCounts.warnings} I{obs.diagnosticCounts.info}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="obs-presence">
        <h3
          id="obs-presence"
          className="text-sm font-semibold text-[var(--color-primary)]"
        >
          Presença
        </h3>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Fact label="Estado" value={obs.presence.label} />
          <Fact
            label="Último contacto"
            value={
              obs.presence.lastSeenAt
                ? new Date(obs.presence.lastSeenAt).toLocaleString()
                : "—"
            }
          />
          <Fact
            label="Heartbeat (backend)"
            value={
              obs.presence.backendHeartbeat === "CONNECTED"
                ? "CONNECTED"
                : "NOT RECENT"
            }
          />
        </dl>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Presença ≠ reprodução. ONLINE não implica PLAYING.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="obs-runtime">
        <h3
          id="obs-runtime"
          className="text-sm font-semibold text-[var(--color-primary)]"
        >
          Runtime
        </h3>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {runtimeLabel}
          {age ? ` · ${age}` : ""}
          {obs.stale ? " · telemetria desactualizada" : ""}
        </p>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact
            label="Reprodução"
            value={obs.runtime.isPlaying ? "PLAYING" : "IDLE"}
          />
          <Fact
            label="Status observado"
            value={obs.playback.observedStatus ?? "—"}
          />
          <Fact
            label="Conteúdo actual"
            value={
              obs.content.id
                ? obs.content.available
                  ? `${obs.content.title ?? "—"} (${obs.content.type ?? "?"})`
                  : `Content unavailable · ${obs.content.id.slice(0, 12)}…`
                : "—"
            }
          />
          <Fact
            label="Manifest"
            value={`v${obs.runtime.currentManifestVersion ?? "—"}`}
          />
          <Fact
            label="Sessão"
            value={
              obs.playback.sessionId
                ? `${obs.playback.sessionId.slice(0, 14)}…`
                : "—"
            }
          />
          <Fact
            label="Posição observada"
            value={
              obs.playback.positionMs != null
                ? `${Math.round(obs.playback.positionMs / 1000)}s` +
                  (obs.playback.durationMs != null
                    ? ` / ${Math.round(obs.playback.durationMs / 1000)}s`
                    : "")
                : "—"
            }
          />
          <Fact
            label="Geração"
            value={
              obs.playback.generation != null
                ? String(obs.playback.generation)
                : "—"
            }
          />
          <Fact
            label="Erro observado"
            value={obs.playback.errorCode ?? "none"}
          />
          <Fact
            label="Sincronização"
            value={obs.runtime.syncState ?? "—"}
          />
          <Fact
            label="Rede (browser)"
            value={obs.runtime.networkState ?? "UNKNOWN"}
          />
          <Fact
            label="Último input"
            value={
              obs.runtime.lastInputClass
                ? `${obs.runtime.lastInputClass}${
                    obs.runtime.lastInputAt
                      ? ` · ${new Date(obs.runtime.lastInputAt).toLocaleTimeString()}`
                      : ""
                  }`
                : "—"
            }
          />
        </dl>
      </section>

      <section className="space-y-3" aria-labelledby="obs-policy">
        <h3
          id="obs-policy"
          className="text-sm font-semibold text-[var(--color-primary)]"
        >
          Policy
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Fonte" value={obs.policy.policySource ?? "—"} />
          <Fact
            label="Pedido → Resolvido (presentation)"
            value={`${obs.policy.requested?.presentation ?? "—"} → ${obs.policy.resolved?.presentation ?? "—"}`}
          />
          <Fact
            label="Pedido → Resolvido (orientation)"
            value={`${obs.policy.requested?.orientation ?? "—"} → ${obs.policy.resolved?.orientation ?? "—"}`}
          />
          <Fact
            label="Cursor / Interaction"
            value={`${obs.policy.resolved?.cursor ?? "—"} / ${obs.policy.resolved?.interaction ?? "—"}`}
          />
        </dl>
      </section>

      <section className="space-y-3" aria-labelledby="obs-actual">
        <h3
          id="obs-actual"
          className="text-sm font-semibold text-[var(--color-primary)]"
        >
          Estado observado (Actual)
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact
            label="Fullscreen — pedido"
            value={obs.policy.requested?.presentation ?? "—"}
          />
          <Fact
            label="Fullscreen — resolvido"
            value={obs.policy.resolved?.presentation ?? "—"}
          />
          <Fact
            label="Fullscreen — capability"
            value={
              obs.runtime.fullscreenStatus === "UNAVAILABLE" ||
              obs.runtime.fullscreenDiagnosticCode === "FULLSCREEN_UNAVAILABLE"
                ? "UNSUPPORTED"
                : obs.runtime.fullscreenControl === "UNAVAILABLE"
                  ? "UNSUPPORTED"
                  : obs.policy.resolved?.presentation
                    ? "SUPPORTED / DETECTED"
                    : "—"
            }
          />
          <Fact
            label="Fullscreen — controlo"
            value={obs.runtime.fullscreenControl ?? "—"}
          />
          <Fact
            label="Fullscreen — actual"
            value={
              obs.actual.fullscreenActive == null
                ? "—"
                : obs.actual.fullscreenActive
                  ? "ACTIVE"
                  : "WINDOWED"
            }
          />
          <Fact
            label="Último evento fullscreen"
            value={
              obs.runtime.fullscreenDiagnosticCode
                ? `${obs.runtime.fullscreenStatus ?? "—"} · ${obs.runtime.fullscreenDiagnosticCode}`
                : obs.runtime.fullscreenStatus ?? "—"
            }
          />
          <Fact
            label="Orientação — pedido"
            value={obs.policy.requested?.orientation ?? "—"}
          />
          <Fact
            label="Orientação — resolvido"
            value={obs.policy.resolved?.orientation ?? "—"}
          />
          <Fact
            label="Orientação — capability"
            value={obs.runtime.orientationCapability ?? "—"}
          />
          <Fact
            label="Orientação — controlo"
            value={obs.runtime.orientationControl ?? "—"}
          />
          <Fact
            label="Orientação — actual"
            value={obs.actual.orientationActual ?? "UNKNOWN"}
          />
          <Fact
            label="Orientação — lock"
            value={
              obs.runtime.orientationDiagnosticCode
                ? `${obs.runtime.orientationStatus ?? "—"} · ${obs.runtime.orientationDiagnosticCode}`
                : obs.runtime.orientationStatus ?? "—"
            }
          />
          <Fact
            label="Cursor"
            value={
              obs.actual.cursorVisible == null
                ? "—"
                : obs.actual.cursorVisible
                  ? "VISIBLE"
                  : "HIDDEN"
            }
          />
          <Fact
            label="Playing"
            value={
              obs.actual.isPlaying == null
                ? "—"
                : obs.actual.isPlaying
                  ? "Yes"
                  : "No"
            }
          />
        </dl>
      </section>

      <section className="space-y-3" aria-labelledby="obs-diag">
        <h3
          id="obs-diag"
          className="text-sm font-semibold text-[var(--color-primary)]"
        >
          Diagnósticos
        </h3>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Errors: {obs.diagnosticCounts.errors} · Warnings:{" "}
          {obs.diagnosticCounts.warnings} · Info: {obs.diagnosticCounts.info}
        </p>
        {obs.diagnostics.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Sem diagnósticos reportados.
          </p>
        ) : (
          <ul className="space-y-2">
            {obs.diagnostics.map((d) => (
              <li
                key={d.code}
                className="flex flex-wrap items-start gap-2 rounded border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                <Badge
                  variant={severityVariant(d.severity)}
                  aria-label={`Severidade ${d.severity}`}
                >
                  {d.severity}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{d.code}</div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {d.message}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
