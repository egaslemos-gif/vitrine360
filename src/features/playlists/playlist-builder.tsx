"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Settings2, Plus, ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentPicker } from "@/features/contents/content-picker";
import {
  updatePlaylistDetailsAction,
  addPlaylistItemAction,
  removePlaylistItemAction,
  reorderPlaylistItemsAction,
  updatePlaylistItemAction,
} from "@/app/admin/playlists/actions";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlaylistTimedPreview } from "./playlist-timed-preview";
import { PlaylistItemThumb } from "./playlist-item-thumb";
import { TRANSITIONS, type Transition } from "@/domain/types";
import { useEffect, useRef } from "react";
import { TypeBadge } from "@/components/ui/type-badge";
import { resolveEffectiveDuration } from "@/domain/playback-state";

type PlaylistItem = {
  id: string;
  contentId: string;
  position: number;
  durationOverrideMs: number | null;
  transition: Transition | string;
  fitMode: string;
  active: boolean;
  content: {
    title: string;
    type: string;
    durationMs: number;
    payload: Record<string, unknown>;
    mediaUrl: string | null;
  };
};

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  items: PlaylistItem[];
};

type ContentPreview = {
  id: string;
  title: string;
  type: string;
  durationMs: number;
  payload: Record<string, unknown>;
  mediaUrl: string | null;
};

function SortableItem({
  item,
  selected,
  onSelect,
  onRemove,
  onUpdateDuration,
  onUpdatePresentation,
  onUpdateActive,
}: {
  item: PlaylistItem;
  selected: boolean;
  onSelect: () => void;
  onRemove: (id: string) => void;
  onUpdateDuration: (id: string, duration: number | null) => Promise<void>;
  onUpdatePresentation: (id: string, transition: string, fitMode: string) => Promise<void>;
  onUpdateActive: (id: string, active: boolean) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const effective = resolveEffectiveDuration({
    mediaType: item.content.type,
    contentDurationMs: item.content.durationMs,
    playlistOverrideMs: item.durationOverrideMs,
  });
  
  const isNatural = effective.mode === "NATURAL";
  const durationMs = effective.durationMs ?? 0;
  const [durationSeconds, setDurationSeconds] = useState(
    item.durationOverrideMs !== null ? String(item.durationOverrideMs / 1000) : "",
  );
  const [isSavingDuration, setIsSavingDuration] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState(item.transition || "fade");
  const [selectedFitMode, setSelectedFitMode] = useState(item.fitMode || "black");
  const [isSavingPresentation, setIsSavingPresentation] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  function formatDur(ms: number) {
    const total = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={
        (selected
          ? "group mb-2 flex cursor-pointer items-center gap-3 rounded-md border border-[var(--color-type-image)]/40 bg-[var(--color-type-image)]/10 p-3 shadow-sm"
          : "group mb-2 flex cursor-pointer items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-sm") +
        (!item.active ? " opacity-50 grayscale-[50%]" : "")
      }
    >
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <PlaylistItemThumb
        content={{
          title: item.content.title,
          type: item.content.type,
          payload: item.content.payload,
          mediaUrl: item.content.mediaUrl,
        }}
      />
      <div className={`min-w-0 flex-1 transition-opacity ${item.active === false ? "opacity-50 grayscale" : ""}`}>
        <p className={`truncate text-sm font-medium ${item.active === false ? "line-through" : ""}`}>{item.content.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
          <TypeBadge contentType={item.content.type} />
          <span className="tabular-nums">
            {isNatural
              ? "Natural"
              : formatDur(durationMs)}
          </span>
        </p>
      </div>

      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 ${item.active === false ? "text-destructive hover:text-destructive/80" : "text-muted-foreground hover:text-foreground"}`}
        disabled={isTogglingActive}
        onClick={async () => {
          setIsTogglingActive(true);
          try {
            await onUpdateActive(item.id, item.active === false ? true : false);
          } finally {
            setIsTogglingActive(false);
          }
        }}
        title={item.active === false ? "Mostrar na apresentação" : "Ocultar da apresentação"}
      >
        {item.active === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      <div className="w-px h-4 bg-border mx-1" />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Configuração do Item</h4>
            <div className="space-y-2">
              <Label className="text-xs">Duração Override (segundos)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder="Deixar em branco para fallback"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Defina a duração em segundos. 0 = duração natural (vídeo).
              </p>
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={isSavingDuration}
                onClick={async () => {
                  const seconds = Number(durationSeconds);
                  if (
                    durationSeconds !== "" &&
                    (!Number.isFinite(seconds) || seconds < 0)
                  ) {
                    return;
                  }
                  setIsSavingDuration(true);
                  try {
                    await onUpdateDuration(
                      item.id,
                      durationSeconds === "" ? null : seconds * 1000,
                    );
                  } finally {
                    setIsSavingDuration(false);
                  }
                }}
              >
                {isSavingDuration ? "A aplicar..." : "Aplicar duração"}
              </Button>
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs">Transição</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedTransition}
                  onChange={(e) => setSelectedTransition(e.target.value)}
                >
                  {TRANSITIONS.map((value) => (
                    <option key={value} value={value}>
                      {value === "fade"
                        ? "Fade suave"
                        : value === "slide-left"
                          ? "Deslizar para a esquerda"
                          : value === "zoom"
                            ? "Zoom suave"
                            : "Corte imediato"}
                    </option>
                  ))}
                </select>
                <Label className="text-xs">Ajuste do conteúdo</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedFitMode}
                  onChange={(e) => setSelectedFitMode(e.target.value)}
                >
                  <option value="black">Slide inteiro, fundo preto</option>
                  <option value="adaptive">Slide inteiro, fundo preto</option>
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={isSavingPresentation}
                  onClick={async () => {
                    setIsSavingPresentation(true);
                    try {
                      await onUpdatePresentation(item.id, selectedTransition, selectedFitMode);
                    } finally {
                      setIsSavingPresentation(false);
                    }
                  }}
                >
                  {isSavingPresentation ? "A aplicar..." : "Aplicar apresentação"}
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:bg-destructive/10"
        onClick={() => onRemove(item.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      </div>
    </div>
  );
}

export function PlaylistBuilder({
  playlist,
  contents,
}: {
  playlist: Playlist;
  contents: ContentPreview[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<PlaylistItem[]>(
    [...playlist.items].sort((a, b) => a.position - b.position)
  );
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const justSavedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (justSavedTimer.current) window.clearTimeout(justSavedTimer.current);
    };
  }, []);

  function flashSaved() {
    if (justSavedTimer.current) window.clearTimeout(justSavedTimer.current);
    setSaveMessage(null);
    setJustSaved(true);
    justSavedTimer.current = window.setTimeout(() => setJustSaved(false), 2800);
  }

  // Sync state when props change (after a server action router.refresh())
  useEffect(() => {
    if (isSaving || hasUnsavedChanges) return;
    const id = window.setTimeout(() => {
      setItems([...playlist.items].sort((a, b) => a.position - b.position));
      setName(playlist.name);
      setDescription(playlist.description ?? "");
    }, 0);
    return () => window.clearTimeout(id);
  }, [playlist, isSaving, hasUnsavedChanges]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setHasUnsavedChanges(true);
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  async function handleSave() {
    try {
      setIsSaving(true);
      setSaveMessage(null);
      await updatePlaylistDetailsAction(playlist.id, { name, description });
      const orderedIds = items.map((i) => i.id);
      await reorderPlaylistItemsAction(playlist.id, orderedIds);
      setHasUnsavedChanges(false);
      flashSaved();
      router.refresh();
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Não foi possível guardar a playlist.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddContent(contentId: string) {
    try {
      await addPlaylistItemAction(playlist.id, contentId);
      flashSaved();
      router.refresh();
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Não foi possível adicionar o conteúdo.",
      });
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (confirm("Remover este item?")) {
      try {
        await removePlaylistItemAction(playlist.id, itemId);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        flashSaved();
      } catch (err) {
        setSaveMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Não foi possível remover o conteúdo.",
        });
      }
    }
  }

  async function handleUpdateDuration(itemId: string, durationOverrideMs: number | null) {
    try {
      await updatePlaylistItemAction(playlist.id, itemId, { durationOverrideMs });
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, durationOverrideMs } : i))
      );
      flashSaved();
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Não foi possível guardar a duração.",
      });
    }
  }

  async function handleUpdatePresentation(
    itemId: string,
    transition: string,
    fitMode: string,
  ) {
    try {
      await updatePlaylistItemAction(playlist.id, itemId, { transition, fitMode });
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, transition, fitMode } : i)),
      );
      flashSaved();
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Não foi possível guardar a apresentação.",
      });
    }
  }

  async function handleUpdateActive(
    itemId: string,
    active: boolean,
  ) {
    try {
      await updatePlaylistItemAction(playlist.id, itemId, { active });
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, active } : i)),
      );
      flashSaved();
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Não foi possível atualizar o estado do item.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <header className="admin-page-header flex flex-col gap-3 pb-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link href="/admin/playlists" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-transparent transition-colors hover:bg-[var(--color-muted)]">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="min-w-0 text-xl font-bold tracking-tight sm:text-3xl">Editor de Playlist</h1>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {hasUnsavedChanges && (
            <span className="text-sm font-medium text-amber-500">
              Alterações não guardadas
            </span>
          )}
          {saveMessage?.type === "error" ? (
            <span role="alert" className="text-sm font-medium break-words text-destructive">
              {saveMessage.text}
            </span>
          ) : null}
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className={
              justSaved
                ? "w-full bg-[var(--color-success)] text-white hover:bg-[var(--color-success)] sm:w-auto"
                : "w-full sm:w-auto"
            }
          >
            {isSaving ? (
              "A Guardar..."
            ) : justSaved ? (
              <>
                <Check className="h-4 w-4" />
                Guardado!
              </>
            ) : (
              "Guardar Alterações"
            )}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:grid-rows-[auto_1fr]">
        <Card className="order-1 h-fit border border-[var(--color-border)] shadow-[var(--shadow-subtle)] xl:col-span-5 xl:col-start-1 xl:order-none">
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Playlist</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setHasUnsavedChanges(true);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="order-3 border border-[var(--color-border)] shadow-[var(--shadow-subtle)] xl:self-start xl:col-span-5 xl:col-start-1 xl:order-none">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle>Itens da Playlist</CardTitle>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {items.length} item{items.length === 1 ? "" : "s"}
              {items.length > 0
                ? ` · Duração total: ${(() => {
                    const hasNatural = items.some(i => resolveEffectiveDuration({
                      mediaType: i.content.type,
                      contentDurationMs: i.content.durationMs,
                      playlistOverrideMs: i.durationOverrideMs,
                    }).mode === "NATURAL");
                    const totalMs = items.reduce((acc, i) => {
                      const effective = resolveEffectiveDuration({
                        mediaType: i.content.type,
                        contentDurationMs: i.content.durationMs,
                        playlistOverrideMs: i.durationOverrideMs,
                      });
                      return acc + Math.max(0, effective.durationMs ?? 0);
                    }, 0);
                    const total = Math.round(totalMs / 1000);
                    const m = Math.floor(total / 60);
                    const s = total % 60;
                    const formatted = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
                    return hasNatural && total === 0 ? "Natural" : hasNatural ? `${formatted} + Natural` : formatted;
                  })()}`
                : ""}
            </p>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed py-12 text-center">
                <p className="mb-2 text-[var(--color-muted-foreground)]">
                  Playlist vazia
                </p>
                <p className="mb-4 text-sm text-[var(--color-muted-foreground)]">
                  Adicione conteúdos para começar a construir esta playlist.
                </p>
                <Button variant="outline" onClick={() => setIsPickerOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Conteúdo
                </Button>
              </div>
            ) : (
              <>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={items} strategy={verticalListSortingStrategy}>
                    {items.map((item, idx) => (
                      <SortableItem
                        key={item.id}
                        item={item}
                        selected={previewIndex === idx}
                        onSelect={() => setPreviewIndex(idx)}
                        onRemove={handleRemoveItem}
                        onUpdateDuration={handleUpdateDuration}
                        onUpdatePresentation={handleUpdatePresentation}
                        onUpdateActive={handleUpdateActive}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => setIsPickerOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Conteúdo
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="order-2 min-w-0 border border-[var(--color-border)] shadow-[var(--shadow-card)] xl:sticky xl:top-2 xl:order-none xl:col-span-7 xl:col-start-6 xl:row-span-2 xl:row-start-1 xl:self-start">
          <CardHeader>
            <CardTitle>Pré-visualização</CardTitle>
          </CardHeader>
          <CardContent>
            <PlaylistTimedPreview
              items={items.map((i) => {
                const effective = resolveEffectiveDuration({
                  mediaType: i.content.type,
                  contentDurationMs: i.content.durationMs,
                  playlistOverrideMs: i.durationOverrideMs,
                });
                return {
                  id: i.id,
                  title: i.content.title,
                  type: i.content.type,
                  durationMs: effective.durationMs ?? 0,
                  transition: i.transition,
                  fitMode: i.fitMode,
                  payload: i.content.payload,
                  mediaUrl: i.content.mediaUrl,
                };
              })}
              selectedIndex={previewIndex}
              onIndexChange={setPreviewIndex}
            />
          </CardContent>
        </Card>
      </div>

      <ContentPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        contents={contents}
        onSelect={handleAddContent}
      />
    </div>
  );
}
