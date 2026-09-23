"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TemplateRegistry,
  type TemplateCategory,
  type TemplateDefinition,
} from "@/domain/content-templates";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { PreviewViewport } from "@/components/ui/preview-viewport";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { TypeBadge } from "@/components/ui/type-badge";
import { ContentVisual } from "@/features/contents/content-visual";
import type { ContentPreviewModel } from "@/features/contents/content-preview-types";

const CATEGORY_TABS: { id: TemplateCategory | "ALL"; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "TEXT", label: "Texto" },
  { id: "CLOCK", label: "Relógio" },
  { id: "NOTICE", label: "Avisos" },
  { id: "EVENT", label: "Eventos" },
  { id: "QR_CODE", label: "QR" },
];

function templatePreviewModel(tpl: TemplateDefinition): ContentPreviewModel {
  return {
    id: `tpl-${tpl.id}`,
    type: tpl.type,
    title: tpl.defaults.title,
    status: "ACTIVE",
    durationMs: tpl.defaults.durationMs,
    payload: tpl.defaults.payload,
    mediaUrl: null,
    mimeType: null,
    validFrom: null,
    validTo: null,
  };
}

function TemplateCard({
  template,
  onUse,
}: {
  template: TemplateDefinition;
  onUse: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden border border-[var(--color-border)] shadow-[var(--shadow-subtle)]">
      <div className="relative">
        <PreviewViewport aspectRatio="16/9">
          <ContentVisual content={templatePreviewModel(template)} />
        </PreviewViewport>
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
          <TypeBadge contentType={template.type} />
          <Badge variant="muted" className="text-[10px] uppercase">
            Template
          </Badge>
        </div>
      </div>
      <CardHeader className="space-y-1 pb-2 pt-3">
        <CardTitle className="text-base">{template.name}</CardTitle>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {template.description}
        </p>
      </CardHeader>
      <CardFooter className="border-t border-[var(--color-border)] bg-[var(--color-muted)]/20 py-3">
        <Button type="button" size="sm" onClick={() => onUse(template.id)}>
          Usar template
        </Button>
      </CardFooter>
    </Card>
  );
}

export function TemplatePicker({
  onBack,
}: {
  onBack?: () => void;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<TemplateCategory | "ALL">("ALL");

  const templates = useMemo(
    () => TemplateRegistry.getByCategory(category),
    [category],
  );

  function useTemplate(id: string) {
    router.push(`/admin/contents/new?templateId=${encodeURIComponent(id)}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usar template"
        description="Escolha um modelo para preencher o Content Builder"
        actions={
          onBack ? (
            <Button type="button" variant="outline" onClick={onBack}>
              Voltar
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/contents/new?from=blank")}
            >
              Começar do zero
            </Button>
          )
        }
      />

      <FilterBar>
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Categorias de template"
        >
          {CATEGORY_TABS.map((tab) => {
            const active = category === tab.id;
            const count =
              tab.id === "ALL"
                ? TemplateRegistry.getAll().length
                : TemplateRegistry.getByCategory(tab.id).length;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(tab.id)}
                className={
                  active
                    ? "rounded-lg bg-[var(--color-tab-active)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
                    : "rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2 text-sm font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                }
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>
      </FilterBar>

      {templates.length === 0 ? (
        <EmptyState
          title="Nenhum template nesta categoria"
          description="Escolha outra categoria ou comece do zero."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} onUse={useTemplate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ContentCreateChooser() {
  const router = useRouter();
  const [picking, setPicking] = useState(false);

  if (picking) {
    return <TemplatePicker onBack={() => setPicking(false)} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="Novo conteúdo"
        description="Como deseja começar?"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border border-[var(--color-border)] shadow-[var(--shadow-subtle)]">
          <CardHeader>
            <CardTitle className="text-lg">Começar do zero</CardTitle>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Formulário vazio — escolha o tipo e preencha os campos.
            </p>
          </CardHeader>
          <CardFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/contents/new?from=blank")}
            >
              Começar do zero
            </Button>
          </CardFooter>
        </Card>
        <Card className="border border-[var(--color-border)] shadow-[var(--shadow-subtle)]">
          <CardHeader>
            <CardTitle className="text-lg">Usar template</CardTitle>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Defaults prontos — edite e guarde um Content independente.
            </p>
          </CardHeader>
          <CardFooter>
            <Button type="button" onClick={() => setPicking(true)}>
              Usar template
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
