import React from "react";
import type { CommandResultStatus } from "@/domain/device-command";
import type { CommandObservationCorrelation } from "@/domain/command-observation";

type CommandStatus = CommandResultStatus | "QUEUED" | "DELIVERED";

export function CommandStatusBadge({ status }: { status: CommandStatus }) {
  let label = "Desconhecido";
  let color = "text-gray-500 bg-gray-100";

  switch (status) {
    case "QUEUED":
      label = "A aguardar dispositivo";
      color = "text-yellow-700 bg-yellow-100";
      break;
    case "DELIVERED":
      label = "Entregue ao dispositivo";
      color = "text-blue-700 bg-blue-100";
      break;
    case "APPLIED":
      label = "Comando aplicado";
      color = "text-green-700 bg-green-100";
      break;
    case "EXPIRED":
      label = "Comando expirado";
      color = "text-red-700 bg-red-100";
      break;
    case "STALE_SESSION":
      label = "Recusado: sessão mudou";
      color = "text-red-700 bg-red-100";
      break;
    case "DUPLICATE":
      label = "Comando já processado";
      color = "text-purple-700 bg-purple-100";
      break;
    case "REJECTED":
      label = "Comando recusado";
      color = "text-red-700 bg-red-100";
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}

export function CommandTimelineView({
  correlation,
}: {
  correlation: CommandObservationCorrelation;
}) {
  const t = correlation.timeline;

  const formatTime = (ms: number | undefined) => {
    if (!ms) return "-";
    return new Date(ms).toLocaleTimeString();
  };

  return (
    <div className="space-y-2 text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded-md border">
      <div className="font-bold border-b pb-2 mb-2">Timeline ({correlation.commandId})</div>
      <div>Created: {formatTime(t.createdAt)}</div>
      <div>Queued: {formatTime(t.queuedAt)}</div>
      <div className={t.deliveredAt ? "text-blue-600" : "text-gray-400"}>
        Delivered: {formatTime(t.deliveredAt)}
      </div>
      <div className={t.appliedAt ? "text-green-600" : "text-gray-400"}>
        Applied: {formatTime(t.appliedAt)}
      </div>
      <div className={t.observedAt ? "text-purple-600 font-bold" : "text-gray-400"}>
        Observed: {formatTime(t.observedAt)}
      </div>
      <div className="mt-2 pt-2 border-t text-xs text-gray-500">
        <div>Queue Latency: {correlation.latency.queueLatencyMs ?? "-"} ms</div>
        <div>ACK Latency: {correlation.latency.ackLatencyMs ?? "-"} ms</div>
        <div>Obs Latency: {correlation.latency.observationLatencyMs ?? "-"} ms</div>
      </div>
    </div>
  );
}

export function CommandResultSummary({
  correlation,
}: {
  correlation: CommandObservationCorrelation;
}) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-lg font-semibold">{correlation.type}</h4>
          <p className="text-xs text-gray-500">{correlation.commandId}</p>
        </div>
        <CommandStatusBadge status={correlation.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CommandTimelineView correlation={correlation} />
        
        <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
          <h5 className="font-bold text-blue-900 mb-2">Playback Observation</h5>
          {correlation.observation ? (
            <div className="text-sm space-y-1">
              <div>Status: <strong>{correlation.observation.status}</strong></div>
              <div>Content: {correlation.observation.contentId ?? "None"}</div>
              <div>Position: {correlation.observation.positionMs} ms</div>
              <div className="text-xs text-gray-500 mt-2">
                * Observed after command (No strict causality claimed)
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic">
              A aguardar observação...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
