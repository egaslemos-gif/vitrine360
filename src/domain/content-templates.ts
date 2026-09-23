/**
 * CONTENT-TEMPLATES-01 — System template definitions (static catalog).
 * Templates are creation presets only — never a runtime dependency of Content.
 */

import type { ContentType } from "@/domain/types";
import { CONTENT_TYPES } from "@/domain/types";

export const TEMPLATE_CATEGORIES = [
  "TEXT",
  "CLOCK",
  "NOTICE",
  "EVENT",
  "QR_CODE",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export type TemplateDefinition = {
  id: string;
  type: ContentType;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  /** Stable catalog version of this definition (not Content.version). */
  version: string;
  defaults: {
    title: string;
    description?: string;
    durationMs: number;
    payload: Record<string, unknown>;
  };
};

const CATALOG: readonly TemplateDefinition[] = [
  {
    id: "text-information",
    type: "TEXT",
    name: "Informação",
    description: "Comunicação informativa geral",
    category: "TEXT",
    icon: "info",
    version: "1.0",
    defaults: {
      title: "Informação",
      durationMs: 10000,
      payload: {
        body: "Escreva aqui a mensagem informativa.",
        align: "center",
        fontSize: "large",
        emphasis: "normal",
      },
    },
  },
  {
    id: "text-alert",
    type: "TEXT",
    name: "Aviso",
    description: "Mensagem que requer atenção",
    category: "TEXT",
    icon: "alert",
    version: "1.0",
    defaults: {
      title: "Aviso",
      durationMs: 12000,
      payload: {
        body: "Escreva aqui o aviso.",
        align: "center",
        fontSize: "large",
        emphasis: "high",
      },
    },
  },
  {
    id: "text-emergency",
    type: "TEXT",
    name: "Emergência",
    description: "Mensagem crítica (layout apenas — sem prioridade de schedule)",
    category: "TEXT",
    icon: "emergency",
    version: "1.0",
    defaults: {
      title: "Emergência",
      durationMs: 15000,
      payload: {
        body: "Escreva aqui a mensagem crítica.",
        align: "center",
        fontSize: "xlarge",
        emphasis: "critical",
      },
    },
  },
  {
    id: "clock-digital",
    type: "CLOCK",
    name: "Relógio Digital",
    description: "Hora digital dinâmica com segundos",
    category: "CLOCK",
    icon: "clock-digital",
    version: "1.0",
    defaults: {
      title: "Relógio Digital",
      durationMs: 15000,
      payload: {
        style: "digital",
        format: "24h",
        showSeconds: true,
        showDate: true,
        showTime: true,
        align: "center",
        theme: "dark",
      },
    },
  },
  {
    id: "clock-analog",
    type: "CLOCK",
    name: "Relógio Analógico",
    description: "Mostrador com ponteiros em tempo real",
    category: "CLOCK",
    icon: "clock-analog",
    version: "1.0",
    defaults: {
      title: "Relógio Analógico",
      durationMs: 15000,
      payload: {
        style: "analog",
        format: "24h",
        showSeconds: true,
        showDate: true,
        showTime: true,
        align: "center",
        theme: "dark",
      },
    },
  },
  {
    id: "notice-standard",
    type: "NOTICE",
    name: "Aviso Simples",
    description: "Aviso institucional padrão",
    category: "NOTICE",
    icon: "notice",
    version: "1.0",
    defaults: {
      title: "Aviso",
      durationMs: 10000,
      payload: {
        message: "Escreva aqui o aviso.",
        level: "standard",
        layout: "centered",
      },
    },
  },
  {
    id: "notice-urgent",
    type: "NOTICE",
    name: "Aviso Urgente",
    description: "Destaque visual elevado (sem alterar prioridades de schedule)",
    category: "NOTICE",
    icon: "notice-urgent",
    version: "1.0",
    defaults: {
      title: "Aviso Urgente",
      durationMs: 12000,
      payload: {
        message: "Escreva aqui o aviso urgente.",
        level: "urgent",
        layout: "centered",
      },
    },
  },
  {
    id: "event-institutional",
    type: "EVENT",
    name: "Evento Institucional",
    description: "Título, data, hora, local e descrição",
    category: "EVENT",
    icon: "event",
    version: "1.0",
    defaults: {
      title: "Evento",
      durationMs: 12000,
      payload: {
        description: "Descrição do evento.",
        date: "",
        time: "",
        location: "",
      },
    },
  },
  {
    id: "qr-instruction",
    type: "QR_CODE",
    name: "QR + Instrução",
    description: "Código QR com texto de instrução",
    category: "QR_CODE",
    icon: "qr",
    version: "1.0",
    defaults: {
      title: "Digitalize o código",
      durationMs: 15000,
      payload: {
        url: "https://example.com",
        label: "Aponte a câmara para o código",
        size: "md",
        align: "center",
      },
    },
  },
];

const BY_ID = new Map(CATALOG.map((t) => [t.id, t]));

function assertValidCatalog(): void {
  const ids = new Set<string>();
  for (const t of CATALOG) {
    if (ids.has(t.id)) throw new Error(`Duplicate template id: ${t.id}`);
    ids.add(t.id);
    if (!(CONTENT_TYPES as readonly string[]).includes(t.type)) {
      throw new Error(`Invalid content type on template ${t.id}: ${t.type}`);
    }
    if (t.type === "EXPERIENCE") {
      throw new Error(`EXPERIENCE templates are not allowed: ${t.id}`);
    }
    if (!t.name.trim() || !t.description.trim() || !t.version.trim()) {
      throw new Error(`Invalid metadata on template ${t.id}`);
    }
  }
}

assertValidCatalog();

export type ContentSeedFromTemplate = {
  type: ContentType;
  title: string;
  description: string;
  durationMs: number;
  status: "ACTIVE";
  payload: Record<string, unknown>;
  templateId: string;
  templateVersion: string;
};

/** Deep-clone JSON-serializable values (templates are plain data). */
export function deepCloneDefaults<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const TemplateRegistry = {
  getAll(): readonly TemplateDefinition[] {
    return CATALOG;
  },

  getById(id: string): TemplateDefinition | null {
    return BY_ID.get(id) ?? null;
  },

  getByType(type: ContentType): TemplateDefinition[] {
    return CATALOG.filter((t) => t.type === type);
  },

  getByCategory(category: TemplateCategory | "ALL"): TemplateDefinition[] {
    if (category === "ALL") return [...CATALOG];
    return CATALOG.filter((t) => t.category === category);
  },

  exists(id: string): boolean {
    return BY_ID.has(id);
  },

  /**
   * Clone template defaults into an independent Content seed.
   * Optional audit keys are copied into payload only (no runtime dependency).
   */
  createContentSeed(templateId: string): ContentSeedFromTemplate | null {
    const tpl = BY_ID.get(templateId);
    if (!tpl) return null;
    const defaults = deepCloneDefaults(tpl.defaults);
    const payload = {
      ...defaults.payload,
      createdFromTemplateId: tpl.id,
      createdFromTemplateVersion: tpl.version,
    };
    return {
      type: tpl.type,
      title: defaults.title,
      description: defaults.description ?? "",
      durationMs: defaults.durationMs,
      status: "ACTIVE",
      payload,
      templateId: tpl.id,
      templateVersion: tpl.version,
    };
  },
};

export const REQUIRED_TEMPLATE_IDS = [
  "text-information",
  "text-alert",
  "text-emergency",
  "clock-digital",
  "clock-analog",
  "notice-standard",
  "notice-urgent",
  "event-institutional",
  "qr-instruction",
] as const;
