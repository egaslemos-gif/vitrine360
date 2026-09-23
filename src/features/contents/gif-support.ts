/** GIF = IMAGE + image/gif (Phase 3C). No Content type GIF. */
export { isGifMime } from "@/features/media/media-library-filters";

/** Operator-facing slide duration policy for GIF-backed IMAGE. */
export const GIF_SLIDE_HINT_PT =
  "GIF é IMAGE animado (MIME image/gif). A duração do slide (timer) controla o avanço — a animação pode repetir ou cortar a meio. Não existe duração natural como em VIDEO.";
