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
import { GripVertical, Trash2, Settings2, Plus, ArrowLeft, Check } from "lucide-react";
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
import { TRANSITIONS, type Transition } from "@/domain/types";
import { useEffect, useRef } from "react";
import { TypeBadge } from "@/components/ui/type-badge";

type PlaylistItem = {
  id: string;
  contentId: string;
  position: number;
  durationOverrideMs: number | null;
  transition: Transition | string;
  fitMode: string;
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
  onRemove,
  onUpdateDuration,
  onUpdatePresentation,
}: {
  item: PlaylistItem;
  onRemove: (id: string) => void;
  onUpdateDuration: (id: string, duration: number | null) => Promise<void>;
  onUpdatePresentation: (id: string, transition: string, fitMode: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isNatural = item.durationOverrideMs === 0;
  const isFallback = item.durationOverrideMs === null;
  const [durationSeconds, setDurationSeconds] = useState(
    item.durationOverrideMs !== null ? String(item.durationOverrideMs / 1000) : "",
  );
  const [isSavingDuration, setIsSavingDuration] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState(item.transition || "fade");
  const [selectedFitMode, setSelectedFitMode] = useState(item.fitMode || "black");
  const [isSavingPresentation, setIsSavingPresentation] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 mb-2 bg-card border rounded-md shadow-sm group"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab hover:text-primary text-muted-foreground"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">{item.content.title}</p>
        <p className="text-xs text-muted-foreground uppercase flex items-center gap-2">
          <TypeBadge contentType={item.content.type} />
          <span>
            {isNatural
              ? "Natural"
              : isFallback
              ? `${item.content.durationMs / 1000}s (Content)`
              : `${item.durationOverrideMs! / 1000}s (Override)`}
          </span>
        </p>
      </div>

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
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        setHasUnsavedChanges(true);
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

  return (
    <div className="space-y-6">
      <header className="admin-page-header flex items-center justify-between pb-4 pt-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/playlists" className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-muted)] transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Editor de Playlist</h1>
        </div>
        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className="text-sm text-amber-500 font-medium">
              Alterações não guardadas
            </span>
          )}
          {saveMessage?.type === "error" ? (
            <span role="alert" className="text-sm font-medium text-destructive">
              {saveMessage.text}
            </span>
          ) : null}
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className={
              justSaved
                ? "bg-green-600 text-white hover:bg-green-600"
                : undefined
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="h-fit border border-[var(--color-border)] shadow-[var(--shadow-subtle)] xl:col-span-3">
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

        <Card className="border border-[var(--color-border)] shadow-[var(--shadow-subtle)] xl:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Itens da Playlist</CardTitle>
            <Button size="sm" onClick={() => setIsPickerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
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
                <Button variant="secondary" onClick={() => setIsPickerOpen(true)}>
                  Adicionar conteúdo
                </Button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={items} strategy={verticalListSortingStrategy}>
                  {items.map((item) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      onRemove={handleRemoveItem}
                      onUpdateDuration={handleUpdateDuration}
                      onUpdatePresentation={handleUpdatePresentation}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>

        <Card className="border border-[var(--color-border)] shadow-[var(--shadow-subtle)] xl:col-span-5">
          <CardHeader>
            <CardTitle>Pré-visualização</CardTitle>
          </CardHeader>
          <CardContent>
            <PlaylistTimedPreview
              items={items.map((i) => ({
                id: i.id,
                title: i.content.title,
                type: i.content.type,
                durationMs: i.durationOverrideMs ?? i.content.durationMs,
                transition: i.transition,
                fitMode: i.fitMode,
                payload: i.content.payload,
                mediaUrl: i.content.mediaUrl,
              }))}
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
