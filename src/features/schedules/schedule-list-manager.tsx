"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsClient } from "@/lib/use-is-client";

export type ScheduleListItem = {
  id: string;
  name: string;
  playlistId: string | null;
  contentId: string | null;
  startTime: string | null;
  endTime: string | null;
  daysOfWeek: string;
  priority: string;
  active: boolean;
  /** Derived via resolveEffectivePlayback — not persisted. */
  effectiveNow: boolean;
  targets: {
    id: string;
    targetType: string;
    targetId: string | null;
  }[];
};

const WEEKDAY_MAP: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
  0: "Dom",
};

const WEEKDAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

function formatClock(value: string | null): string {
  if (!value) return "—";
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return value;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function formatDays(daysArrayStr: string) {
  try {
    const arr = JSON.parse(daysArrayStr) as number[];
    if (!Array.isArray(arr) || arr.length === 0) return "Nenhum dia";
    if (arr.length === 7) return "Todos os dias";
    const sorted = [...arr].sort((a, b) => {
      const aVal = a === 0 ? 7 : a;
      const bVal = b === 0 ? 7 : b;
      return aVal - bVal;
    });
    return sorted.map((d) => WEEKDAY_MAP[d] ?? "?").join(", ");
  } catch {
    return daysArrayStr;
  }
}

function parseDays(daysArrayStr: string): number[] {
  try {
    const arr = JSON.parse(daysArrayStr) as number[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function toTimeInput(value: string | null): string {
  if (!value) return "08:00";
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return "08:00";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export function ScheduleListManager({
  schedules,
  playlists,
  devices,
  groups,
  tenantTimezone,
}: {
  schedules: ScheduleListItem[];
  playlists: { id: string; name: string }[];
  devices: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  tenantTimezone: string;
}) {
  const router = useRouter();
  const mounted = useIsClient();
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<ScheduleListItem | null>(null);
  const [editItem, setEditItem] = useState<ScheduleListItem | null>(null);

  const playlistName = useMemo(() => {
    const m = new Map(playlists.map((p) => [p.id, p.name]));
    return (id: string | null) => {
      if (!id) return "—";
      return m.get(id) ?? "Playlist removida";
    };
  }, [playlists]);

  const targetLabel = useMemo(() => {
    const dMap = new Map(devices.map((d) => [d.id, d.name]));
    const gMap = new Map(groups.map((g) => [g.id, g.name]));
    return (t: ScheduleListItem["targets"][0]) => {
      if (t.targetType === "ALL") return "Todos os ecrãs";
      if (t.targetType === "GROUP") {
        const name = t.targetId ? gMap.get(t.targetId) : undefined;
        return name ? `Grupo ${name}` : "Grupo (removido)";
      }
      if (t.targetType === "DEVICE") {
        const name = t.targetId ? dMap.get(t.targetId) : undefined;
        return name ? `Ecrã ${name}` : "Ecrã (removido)";
      }
      return t.targetType;
    };
  }, [devices, groups]);

  function targetsSummary(s: ScheduleListItem): string {
    if (!s.targets.length) return "—";
    return s.targets.map(targetLabel).join(", ");
  }

  async function toggleActive(s: ScheduleListItem) {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/schedules/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !s.active }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao alterar estado");
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteItem) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/schedules/${deleteItem.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao eliminar");
      setDeleteItem(null);
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Agendamentos</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-[var(--color-border)]">
          {errorMsg && !deleteItem && !editItem ? (
            <p className="py-2 text-sm text-[var(--color-destructive)]" role="alert">
              {errorMsg}
            </p>
          ) : null}
          {schedules.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-base font-semibold text-[var(--color-foreground)]">
                  {s.name}
                </p>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  <span className="font-medium text-[var(--color-foreground)]">
                    {formatClock(s.startTime)} → {formatClock(s.endTime)}
                  </span>
                  {" · "}
                  {formatDays(s.daysOfWeek)}
                </p>
                <dl className="mt-2 grid gap-1 text-sm text-[var(--color-muted-foreground)] sm:grid-cols-2">
                  <div>
                    <span className="text-[var(--color-foreground)]">Playlist:</span>{" "}
                    {playlistName(s.playlistId)}
                  </div>
                  <div>
                    <span className="text-[var(--color-foreground)]">Prioridade:</span>{" "}
                    {s.priority}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[var(--color-foreground)]">Target:</span>{" "}
                    {targetsSummary(s)}
                  </div>
                  <div>
                    <span className="text-[var(--color-foreground)]">Estado:</span>{" "}
                    {s.active ? (
                      <Badge variant="success" className="align-middle text-[10px]">
                        ACTIVE
                      </Badge>
                    ) : (
                      <Badge variant="muted" className="align-middle text-[10px]">
                        INACTIVE
                      </Badge>
                    )}
                  </div>
                  <div>
                    <span className="text-[var(--color-foreground)]">
                      Effective now:
                    </span>{" "}
                    {s.effectiveNow ? (
                      <Badge variant="success" className="align-middle text-[10px]">
                        YES
                      </Badge>
                    ) : (
                      <Badge variant="muted" className="align-middle text-[10px]">
                        NO
                      </Badge>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[var(--color-foreground)]">
                      Timezone:
                    </span>{" "}
                    Device → Tenant ({tenantTimezone}) → UTC
                  </div>
                </dl>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setErrorMsg(null);
                    setEditItem(s);
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => toggleActive(s)}
                >
                  {s.active ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    setErrorMsg(null);
                    setDeleteItem(s);
                  }}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
          {schedules.length === 0 ? (
            <p className="py-4 text-sm text-[var(--color-muted-foreground)]">
              Sem agendamentos.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {mounted && editItem
        ? createPortal(
            <ScheduleEditDialog
              schedule={editItem}
              playlists={playlists}
              devices={devices}
              groups={groups}
              busy={busy}
              errorMsg={errorMsg}
              onClose={() => {
                setEditItem(null);
                setErrorMsg(null);
              }}
              onBusy={setBusy}
              onError={setErrorMsg}
              onSaved={() => {
                setEditItem(null);
                setErrorMsg(null);
                router.refresh();
              }}
            />,
            document.body,
          )
        : null}

      {mounted && deleteItem
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            >
              <div className="relative w-full max-w-md rounded-xl bg-white p-6 text-center shadow-xl">
                <h2 className="mb-2 text-xl font-bold">Eliminar agendamento?</h2>
                <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">
                  Remover <strong>{deleteItem.name}</strong>? Os ecrãs alvo
                  serão invalidados para Sync.
                </p>
                {errorMsg ? (
                  <p
                    className="mb-4 text-sm text-[var(--color-destructive)]"
                    role="alert"
                  >
                    {errorMsg}
                  </p>
                ) : null}
                <div className="flex justify-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setDeleteItem(null);
                      setErrorMsg(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy}
                    onClick={handleDelete}
                  >
                    {busy ? "A eliminar…" : "Eliminar"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ScheduleEditDialog({
  schedule,
  playlists,
  devices,
  groups,
  busy,
  errorMsg,
  onClose,
  onBusy,
  onError,
  onSaved,
}: {
  schedule: ScheduleListItem;
  playlists: { id: string; name: string }[];
  devices: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  busy: boolean;
  errorMsg: string | null;
  onClose: () => void;
  onBusy: (v: boolean) => void;
  onError: (v: string | null) => void;
  onSaved: () => void;
}) {
  const primary = schedule.targets[0];
  const [name, setName] = useState(schedule.name);
  const [playlistId, setPlaylistId] = useState(
    schedule.playlistId ?? playlists[0]?.id ?? "",
  );
  const [startTime, setStartTime] = useState(toTimeInput(schedule.startTime));
  const [endTime, setEndTime] = useState(toTimeInput(schedule.endTime));
  const [priority, setPriority] = useState(
    schedule.priority === "HIGH"
      ? "HIGH"
      : schedule.priority === "EMERGENCY"
        ? "EMERGENCY"
        : "NORMAL",
  );
  const [daysOfWeek, setDaysOfWeek] = useState(parseDays(schedule.daysOfWeek));
  const [targetType, setTargetType] = useState<"ALL" | "GROUP" | "DEVICE">(
    (primary?.targetType as "ALL" | "GROUP" | "DEVICE") || "ALL",
  );
  const [targetId, setTargetId] = useState(primary?.targetId ?? "");
  const [confirmAll, setConfirmAll] = useState(
    primary?.targetType === "ALL",
  );
  const [active, setActive] = useState(schedule.active);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    onBusy(true);
    try {
      const res = await fetch(`/api/admin/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          playlistId: playlistId || undefined,
          contentId: schedule.contentId || undefined,
          startTime,
          endTime,
          daysOfWeek,
          priority,
          active,
          targets: [
            {
              targetType,
              targetId: targetType === "ALL" ? null : targetId,
            },
          ],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(data.error ?? "Erro ao guardar");
        return;
      }
      onSaved();
    } catch {
      onError("Ocorreu um erro inesperado");
    } finally {
      onBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold">Editar agendamento</h2>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <Label>Playlist</Label>
            <select
              className="flex h-9 w-full rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
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
          <div className="space-y-1">
            <Label>Prioridade</Label>
            {schedule.priority === "EMERGENCY" ? (
              <p className="flex h-9 items-center text-sm font-medium">EMERGENCY</p>
            ) : (
              <select
                className="flex h-9 w-full rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={busy}
              >
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
              </select>
            )}
          </div>
          <div className="space-y-1">
            <Label>Hora início</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <Label>Hora fim</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Target</Label>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={targetType === "ALL"}
                  onChange={() => setTargetType("ALL")}
                />
                Todos
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={targetType === "GROUP"}
                  onChange={() => {
                    setTargetType("GROUP");
                    setTargetId(groups[0]?.id ?? "");
                  }}
                />
                Grupo
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={targetType === "DEVICE"}
                  onChange={() => {
                    setTargetType("DEVICE");
                    setTargetId(devices[0]?.id ?? "");
                  }}
                />
                Ecrã
              </label>
            </div>
            {targetType === "ALL" ? (
              <label className="mt-2 flex items-center gap-2 text-xs text-red-700">
                <input
                  type="checkbox"
                  checked={confirmAll}
                  onChange={(e) => setConfirmAll(e.target.checked)}
                />
                Confirmo aplicar a todos os ecrãs
              </label>
            ) : null}
            {targetType === "GROUP" ? (
              <select
                className="mt-2 flex h-9 w-full rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            ) : null}
            {targetType === "DEVICE" ? (
              <select
                className="mt-2 flex h-9 w-full rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Dias</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const isActive = daysOfWeek.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        setDaysOfWeek(
                          daysOfWeek.filter((d) => d !== day.value),
                        );
                      } else {
                        setDaysOfWeek([...daysOfWeek, day.value].sort());
                      }
                    }}
                    className={`rounded-md border px-2 py-1 text-xs font-medium ${
                      isActive
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-[var(--color-border)] bg-white"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Activo
          </label>
          {errorMsg ? (
            <p
              className="sm:col-span-2 text-sm text-[var(--color-destructive)]"
              role="alert"
            >
              {errorMsg}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4 sm:col-span-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                busy ||
                daysOfWeek.length === 0 ||
                !playlistId ||
                (targetType === "ALL" && !confirmAll) ||
                (targetType !== "ALL" && !targetId)
              }
            >
              {busy ? "A guardar…" : "Guardar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
