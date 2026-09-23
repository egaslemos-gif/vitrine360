"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MediaAssetItem } from "@/features/media/media-library";
import { MediaAssetPicker } from "./media-asset-picker";
import { CONTENT_TYPES, CONTENT_STATUSES } from "@/domain/types";
import { Badge } from "@/components/ui/badge";
import {
  GIF_SLIDE_HINT_PT,
  isGifMime,
} from "@/features/contents/gif-support";
import { TemplateRegistry } from "@/domain/content-templates";

export type StudioMode = "create" | "edit";

export type ContentStudioInitial = {
  id?: string;
  type: string;
  title: string;
  description?: string | null;
  durationMs: number;
  status: string;
  payload: Record<string, unknown>;
  mediaAssetId?: string | null;
  media?: {
    id: string;
    fileName: string;
    mimeType: string;
    url: string;
  } | null;
};

function payloadBody(type: string, payload: Record<string, unknown>): string {
  if (type === "NOTICE") return String(payload.message ?? "");
  if (type === "EVENT") return String(payload.description ?? "");
  if (type === "QR_CODE") return String(payload.url ?? "");
  if (type === "NEWS" || type === "TEXT") return String(payload.body ?? "");
  return "";
}

function resolveCreateSeed(
  existingAssets: MediaAssetItem[],
  mediaAssetId: string | null,
  templateId: string | null,
): ContentStudioInitial {
  if (templateId) {
    const seed = TemplateRegistry.createContentSeed(templateId);
    if (seed) {
      return {
        type: seed.type,
        title: seed.title,
        description: seed.description,
        durationMs: seed.durationMs,
        status: seed.status,
        payload: seed.payload,
        mediaAssetId: null,
      };
    }
  }
  const asset = mediaAssetId
    ? existingAssets.find((a) => a.id === mediaAssetId)
    : undefined;
  if (asset) {
    const type = asset.mimeType.startsWith("video/") ? "VIDEO" : "IMAGE";
    return {
      type,
      title: asset.fileName,
      description: "",
      durationMs: type === "VIDEO" ? 0 : 10000,
      status: "ACTIVE",
      payload: {},
      mediaAssetId: asset.id,
    };
  }
  return {
    type: "TEXT",
    title: "",
    description: "",
    durationMs: 10000,
    status: "ACTIVE",
    payload: {},
    mediaAssetId: null,
  };
}

export function ContentStudioForm({
  mode,
  initial,
  existingAssets,
}: {
  mode: StudioMode;
  initial?: ContentStudioInitial;
  existingAssets: MediaAssetItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const seed =
    initial ??
    resolveCreateSeed(
      existingAssets,
      searchParams.get("mediaAssetId"),
      searchParams.get("templateId"),
    );

  const [type, setType] = useState(seed.type);
  const [title, setTitle] = useState(seed.title);
  const [description, setDescription] = useState(seed.description ?? "");
  const [status, setStatus] = useState(seed.status);
  const [durationMs, setDurationMs] = useState(seed.durationMs);
  const [naturalVideo, setNaturalVideo] = useState(
    seed.type === "VIDEO" && seed.durationMs === 0,
  );
  const [body, setBody] = useState(payloadBody(seed.type, seed.payload ?? {}));
  const [newsSource, setNewsSource] = useState(
    String(seed.payload?.source ?? ""),
  );
  const [eventDate, setEventDate] = useState(String(seed.payload?.date ?? ""));
  const [eventTime, setEventTime] = useState(String(seed.payload?.time ?? ""));
  const [eventLocation, setEventLocation] = useState(
    String(seed.payload?.location ?? ""),
  );
  const [qrLabel, setQrLabel] = useState(String(seed.payload?.label ?? ""));
  const [qrSize, setQrSize] = useState(String(seed.payload?.size ?? "md"));
  const [showDate, setShowDate] = useState(seed.payload?.showDate !== false);
  const [showTime, setShowTime] = useState(seed.payload?.showTime !== false);
  const [showSeconds, setShowSeconds] = useState(
    seed.payload?.showSeconds === true,
  );
  const [clockStyle, setClockStyle] = useState(
    String(seed.payload?.style ?? "digital"),
  );
  const [clockFormat, setClockFormat] = useState(
    String(seed.payload?.format ?? "24h"),
  );
  const seedExp =
    seed.payload?.experience && typeof seed.payload.experience === "object"
      ? (seed.payload.experience as {
          experienceId?: string;
          version?: string;
        })
      : null;
  const [experienceId, setExperienceId] = useState(
    String(seedExp?.experienceId ?? seed.payload?.experienceId ?? ""),
  );
  const [experienceVersion, setExperienceVersion] = useState(
    String(seedExp?.version ?? seed.payload?.version ?? ""),
  );

  // Media states
  const [sourceMode, setSourceMode] = useState<"upload" | "library">(
    seed.mediaAssetId || initial?.media ? "library" : "upload",
  );
  const [file, setFile] = useState<File | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(
    initial?.media?.id ?? seed.mediaAssetId ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isMedia = type === "IMAGE" || type === "VIDEO";

  const selectedAsset = useMemo(() => {
    if (file && isGifMime(file.type)) {
      return { mimeType: "image/gif" as const, label: file.name };
    }
    if (selectedAssetId) {
      const fromLib = existingAssets.find((a) => a.id === selectedAssetId);
      if (fromLib) return { mimeType: fromLib.mimeType, label: fromLib.fileName };
    }
    if (initial?.media) {
      return {
        mimeType: initial.media.mimeType,
        label: initial.media.fileName,
      };
    }
    return null;
  }, [file, selectedAssetId, existingAssets, initial?.media?.mimeType, initial?.media?.fileName]);

  const isGifImage =
    type === "IMAGE" &&
    !!selectedAsset &&
    isGifMime(selectedAsset.mimeType);

  const effectiveDuration = useMemo(() => {
    if (type === "VIDEO" && naturalVideo) return 0;
    return durationMs;
  }, [type, naturalVideo, durationMs]);

  function buildPayload(): Record<string, unknown> {
    const audit =
      typeof seed.payload?.createdFromTemplateId === "string"
        ? {
            createdFromTemplateId: seed.payload.createdFromTemplateId,
            createdFromTemplateVersion:
              seed.payload.createdFromTemplateVersion,
          }
        : {};

    if (type === "TEXT") {
      return {
        body,
        align: String(seed.payload?.align ?? "center"),
        fontSize: String(seed.payload?.fontSize ?? "large"),
        ...(typeof seed.payload?.emphasis === "string"
          ? { emphasis: seed.payload.emphasis }
          : {}),
        ...audit,
      };
    }
    if (type === "NOTICE") {
      return {
        message: body,
        ...(typeof seed.payload?.level === "string"
          ? { level: seed.payload.level }
          : {}),
        ...(typeof seed.payload?.layout === "string"
          ? { layout: seed.payload.layout }
          : {}),
        ...audit,
      };
    }
    if (type === "EVENT") {
      return {
        description: body,
        date: eventDate,
        time: eventTime,
        location: eventLocation,
        ...audit,
      };
    }
    if (type === "NEWS") return { body, source: newsSource, ...audit };
    if (type === "QR_CODE") {
      return {
        url: body,
        label: qrLabel || title,
        size: qrSize,
        ...(typeof seed.payload?.align === "string"
          ? { align: seed.payload.align }
          : {}),
        ...audit,
      };
    }
    if (type === "CLOCK") {
      return {
        showDate,
        showTime,
        showSeconds,
        format: clockFormat,
        style: clockStyle === "analog" ? "analog" : "digital",
        ...(typeof seed.payload?.theme === "string"
          ? { theme: seed.payload.theme }
          : {}),
        ...(typeof seed.payload?.align === "string"
          ? { align: seed.payload.align }
          : {}),
        ...audit,
      };
    }
    if (type === "EXPERIENCE") {
      return {
        experience: {
          experienceId: experienceId.trim(),
          version: experienceVersion.trim(),
        },
      };
    }
    return { ...audit };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (!title.trim()) {
        setError("Título obrigatório");
        return;
      }
      if (type !== "VIDEO" && effectiveDuration <= 0) {
        setError("A duração deve ser maior que 0");
        return;
      }

      if (mode === "create") {
        if (isMedia) {
          if (sourceMode === "upload") {
            if (!file) {
              setError("Seleccione um ficheiro");
              return;
            }
            const form = new FormData();
            form.set("file", file);
            form.set("type", type);
            form.set("title", title.trim());
            form.set("status", status);
            if (description) form.set("description", description);
            form.set("durationMs", String(effectiveDuration));
            const res = await fetch("/api/admin/contents", {
              method: "POST",
              body: form,
            });
            const data = (await res.json()) as { id?: string; error?: string };
            if (!res.ok) {
              setError(data.error ?? "Erro no upload");
              return;
            }
            router.push(`/admin/contents/${data.id}`);
            router.refresh();
            return;
          }
          if (!selectedAssetId) {
            setError("Seleccione um ficheiro da biblioteca");
            return;
          }
          const res = await fetch("/api/admin/contents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type,
              title: title.trim(),
              description: description || undefined,
              durationMs: effectiveDuration,
              status,
              mediaAssetId: selectedAssetId,
              payload: {},
            }),
          });
          const data = (await res.json()) as { id?: string; error?: string };
          if (!res.ok) {
            setError(data.error ?? "Erro ao criar conteúdo");
            return;
          }
          router.push(`/admin/contents/${data.id}`);
          router.refresh();
          return;
        }

        const res = await fetch("/api/admin/contents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            title: title.trim(),
            description: description || undefined,
            durationMs: effectiveDuration,
            status,
            payload: buildPayload(),
          }),
        });
        const data = (await res.json()) as { id?: string; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Erro ao criar conteúdo");
          return;
        }
        router.push(`/admin/contents/${data.id}`);
        router.refresh();
        return;
      }

      // edit
      if (!initial?.id) {
        setError("Content id em falta");
        return;
      }

      if (isMedia && sourceMode === "upload" && file) {
        const up = new FormData();
        up.set("file", file);
        const upRes = await fetch("/api/admin/media", {
          method: "POST",
          body: up,
        });
        const upData = (await upRes.json()) as { id?: string; error?: string };
        if (!upRes.ok || !upData.id) {
          setError(upData.error ?? "Erro no upload do media");
          return;
        }
        setSelectedAssetId(upData.id);
        const res = await fetch(`/api/admin/contents/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description || null,
            durationMs: effectiveDuration,
            status,
            payload: {},
            mediaAssetId: upData.id,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Erro ao guardar");
          return;
        }
        router.refresh();
        return;
      }

      const patch: Record<string, unknown> = {
        title: title.trim(),
        description: description || null,
        durationMs: effectiveDuration,
        status,
        payload: isMedia ? {} : buildPayload(),
      };
      if (isMedia && selectedAssetId) {
        patch.mediaAssetId = selectedAssetId;
      }

      const res = await fetch(`/api/admin/contents/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erro ao guardar");
        return;
      }
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
        <CardTitle>
          {mode === "create" ? "Novo conteúdo" : "Content Studio"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="content-type">Tipo</Label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="content-type"
                className="h-9 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-white px-2 text-sm disabled:opacity-60"
                value={type}
                disabled={mode === "edit"}
                onChange={(e) => {
                  const next = e.target.value;
                  setType(next);
                  setSelectedAssetId(null);
                  setFile(null);
                  if (next === "VIDEO") {
                    setNaturalVideo(true);
                    setDurationMs(0);
                  } else if (durationMs === 0) {
                    setDurationMs(10000);
                    setNaturalVideo(false);
                  }
                }}
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {isGifImage ? (
                <Badge variant="muted" className="shrink-0 uppercase tracking-wide">
                  GIF
                </Badge>
              ) : null}
            </div>
            {isGifImage ? (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Variante IMAGE · {selectedAsset?.mimeType}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-status">Estado</Label>
            <select
              id="content-status"
              className="block h-9 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {CONTENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="content-title">Título</Label>
            <Input
              id="content-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="content-description">Descrição</Label>
            <Input
              id="content-description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Duração</Label>
            {type === "VIDEO" ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={naturalVideo}
                    onChange={(e) => {
                      setNaturalVideo(e.target.checked);
                      if (e.target.checked) setDurationMs(0);
                      else if (durationMs <= 0) setDurationMs(10000);
                    }}
                  />
                  Duração natural do vídeo (durationMs = 0)
                </label>
                {!naturalVideo ? (
                  <Input
                    type="number"
                    min={1}
                    value={durationMs}
                    onChange={(e) => setDurationMs(Number(e.target.value))}
                    disabled={busy}
                  />
                ) : (
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    O Runtime avança quando o vídeo terminar.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  type="number"
                  min={1}
                  value={durationMs}
                  onChange={(e) => setDurationMs(Number(e.target.value))}
                  disabled={busy}
                  required
                />
                {isGifImage ? (
                  <p
                    className="text-xs text-[var(--color-muted-foreground)]"
                    role="note"
                  >
                    {GIF_SLIDE_HINT_PT}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {isMedia ? (
            <div className="space-y-4 sm:col-span-2">
              {initial?.media ? (
                <div className="rounded-md border border-[var(--color-border)] p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">Media actual</p>
                    {isGifMime(initial.media.mimeType) ? (
                      <Badge variant="muted" className="text-[10px] uppercase">
                        GIF
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-[var(--color-muted-foreground)]">
                    {initial.media.fileName} · {initial.media.mimeType}
                  </p>
                </div>
              ) : null}
              <div className="flex gap-2 border-b border-[var(--color-border)] pb-2">
                <button
                  type="button"
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                    sourceMode === "upload"
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-secondary)]"
                  }`}
                  onClick={() => setSourceMode("upload")}
                >
                  Carregar ficheiro
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                    sourceMode === "library"
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-secondary)]"
                  }`}
                  onClick={() => setSourceMode("library")}
                >
                  Media Library
                </button>
              </div>
              {sourceMode === "upload" ? (
                <div className="space-y-2">
                  <Label>Ficheiro</Label>
                  <input
                    type="file"
                    accept={type === "IMAGE" ? "image/*" : "video/*"}
                    className="block w-full cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              ) : (
                <MediaAssetPicker
                  assets={existingAssets}
                  contentType={type as "IMAGE" | "VIDEO"}
                  selectedId={selectedAssetId}
                  onSelect={setSelectedAssetId}
                />
              )}
            </div>
          ) : type === "CLOCK" ? (
            <div className="space-y-3 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showDate}
                  onChange={(e) => setShowDate(e.target.checked)}
                />
                Mostrar data
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showTime}
                  onChange={(e) => setShowTime(e.target.checked)}
                />
                Mostrar hora
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showSeconds}
                  onChange={(e) => setShowSeconds(e.target.checked)}
                />
                Mostrar segundos
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Estilo</Label>
                  <select
                    className="block h-9 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 text-sm"
                    value={clockStyle}
                    onChange={(e) => setClockStyle(e.target.value)}
                  >
                    <option value="digital">Digital</option>
                    <option value="analog">Analógico</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Formato</Label>
                  <select
                    className="block h-9 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 text-sm"
                    value={clockFormat}
                    onChange={(e) => setClockFormat(e.target.value)}
                  >
                    <option value="24h">24h</option>
                    <option value="12h">12h</option>
                  </select>
                </div>
              </div>
            </div>
          ) : type === "EXPERIENCE" ? (
            <div className="space-y-4 sm:col-span-2">
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Referência versionada (sem latest/current). A Experience deve
                existir no Registry/store do tenant.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="exp-id">experienceId</Label>
                  <Input
                    id="exp-id"
                    value={experienceId}
                    onChange={(e) => setExperienceId(e.target.value)}
                    placeholder="exp-weather-dashboard"
                    required
                    disabled={busy}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-ver">version (semver)</Label>
                  <Input
                    id="exp-ver"
                    value={experienceVersion}
                    onChange={(e) => setExperienceVersion(e.target.value)}
                    placeholder="1.2.0"
                    required
                    disabled={busy}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 sm:col-span-2">
              <div className="space-y-2">
                <Label>
                  {type === "QR_CODE"
                    ? "URL"
                    : type === "NOTICE"
                      ? "Mensagem"
                      : type === "EVENT"
                        ? "Descrição"
                        : "Texto"}
                </Label>
                <textarea
                  className="min-h-24 w-full rounded-md border border-[var(--color-border)] bg-white p-2 text-sm"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
              {type === "NEWS" ? (
                <div className="space-y-2">
                  <Label>Fonte</Label>
                  <Input
                    value={newsSource}
                    onChange={(e) => setNewsSource(e.target.value)}
                  />
                </div>
              ) : null}
              {type === "EVENT" ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora</Label>
                    <Input
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Local</Label>
                    <Input
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
              {type === "QR_CODE" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={qrLabel}
                      onChange={(e) => setQrLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tamanho</Label>
                    <select
                      className="block h-9 w-full min-w-0 rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
                      value={qrSize}
                      onChange={(e) => setQrSize(e.target.value)}
                    >
                      <option value="sm">sm</option>
                      <option value="md">md</option>
                      <option value="lg">lg</option>
                    </select>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {error ? (
            <p className="sm:col-span-2 text-sm text-[var(--color-destructive)]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 border-t border-[var(--color-border)] pt-4 sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? "A guardar…" : mode === "create" ? "Criar" : "Guardar"}
            </Button>
            <Link href="/admin/contents">
              <Button type="button" variant="outline" disabled={busy}>
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
