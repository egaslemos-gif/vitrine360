"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ScheduleForm({
  playlists,
  devices,
  groups,
}: {
  playlists: { id: string; name: string }[];
  devices: { id: string; name: string }[];
  groups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [playlistId, setPlaylistId] = useState(playlists[0]?.id ?? "");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [priority, setPriority] = useState("NORMAL");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);

  const [targetType, setTargetType] = useState<"ALL" | "GROUP" | "DEVICE">(
    "ALL",
  );
  const [targetId, setTargetId] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const WEEKDAYS = [
    { value: 1, label: "Seg" },
    { value: 2, label: "Ter" },
    { value: 3, label: "Qua" },
    { value: 4, label: "Qui" },
    { value: 5, label: "Sex" },
    { value: 6, label: "Sáb" },
    { value: 0, label: "Dom" },
  ];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          playlistId: playlistId || undefined,
          startTime,
          endTime,
          daysOfWeek,
          priority,
          targets: [
            {
              targetType,
              targetId: targetType === "ALL" ? null : targetId,
            },
          ],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar agendamento");
        return;
      }
      setName("");
      setTargetType("ALL");
      setConfirmAll(false);
      setDaysOfWeek([1, 2, 3, 4, 5]);
      router.refresh();
    } catch {
      setError("Ocorreu um erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo agendamento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label>Playlist</Label>
            <select
              className="block h-9 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
              value={playlistId}
              onChange={(e) => setPlaylistId(e.target.value)}
              disabled={busy}
            >
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <select
              className="block h-9 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={busy}
            >
              <option value="NORMAL">NORMAL</option>
              <option value="HIGH">HIGH</option>
            </select>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              EMERGENCY (conteúdo interrupt) disponível via API com contentId.
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Para Quem (Target)</Label>
            <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)]/10 p-3">
              <div className="flex flex-wrap gap-4 items-center">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    checked={targetType === "ALL"}
                    onChange={() => setTargetType("ALL")}
                  />
                  Todos os Ecrãs
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    checked={targetType === "GROUP"}
                    onChange={() => {
                      setTargetType("GROUP");
                      setTargetId(groups[0]?.id ?? "");
                    }}
                  />
                  Grupo
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    checked={targetType === "DEVICE"}
                    onChange={() => {
                      setTargetType("DEVICE");
                      setTargetId(devices[0]?.id ?? "");
                    }}
                  />
                  Ecrã Específico
                </label>
              </div>

              {targetType === "ALL" && (
                <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                  <input
                    type="checkbox"
                    checked={confirmAll}
                    onChange={(e) => setConfirmAll(e.target.checked)}
                    id="confirmAll"
                  />
                  <label htmlFor="confirmAll">
                    Confirmo que este agendamento será aplicado a TODOS os
                    ecrãs.
                  </label>
                </div>
              )}

              {targetType === "GROUP" && (
                <select
                  className="block h-9 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Selecione um grupo
                  </option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}

              {targetType === "DEVICE" && (
                <select
                  className="block h-9 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Selecione um ecrã
                  </option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Hora início (diária)</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label>Hora fim (diária)</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <p className="sm:col-span-2 text-xs text-[var(--color-muted-foreground)]">
            Janela no fuso do dispositivo/workspace. O Player actualiza na
            próxima sincronização (~60s) quando a janela começa ou termina —
            não altera a playlist “atribuída” no ecrã Devices.
          </p>

          <div className="space-y-3 sm:col-span-2 pt-2">
            <Label>Dias da Semana</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const isActive = daysOfWeek.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        setDaysOfWeek(daysOfWeek.filter((d) => d !== day.value));
                      } else {
                        setDaysOfWeek([...daysOfWeek, day.value].sort());
                      }
                    }}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-[var(--color-border)] bg-white text-[var(--color-muted-foreground)] hover:bg-[var(--color-secondary)]/30"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            {daysOfWeek.length === 0 && (
              <p className="text-xs text-red-500">
                Selecione pelo menos um dia da semana.
              </p>
            )}
          </div>

          {error ? (
            <p
              className="sm:col-span-2 text-sm text-[var(--color-destructive)]"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="sm:col-span-2 pt-4">
            <Button
              type="submit"
              disabled={
                busy ||
                daysOfWeek.length === 0 ||
                (targetType === "ALL" && !confirmAll) ||
                (targetType !== "ALL" && !targetId) ||
                !playlistId
              }
            >
              {busy ? "A criar…" : "Criar Agendamento"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
