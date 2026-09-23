# CONTENT-TEMPLATES-01 — Template System & Content Creation

## 1. Objectivo

Acelerar a criação de conteúdos frequentes com **presets estáticos** do sistema, sem novos Content Types e sem dependência runtime Template→Content.

## 2. Template vs Content

| | Template | Content |
|--|----------|---------|
| Papel | Defaults de criação | Artefacto persistido |
| Persistência | Código (registry) | DB `contents` |
| Runtime | Não | Sim (playlist/manifest) |
| Mutação | Só no catálogo | Independente após save |

## 3. Template Registry

SSoT: `src/domain/content-templates.ts` → `TemplateRegistry`

- `getAll()` / `getById()` / `getByType()` / `getByCategory()` / `exists()`
- `createContentSeed(id)` — deep clone defaults + metadata de auditoria opcional

## 4. Template Categories

`TEXT` · `CLOCK` · `NOTICE` · `EVENT` · `QR_CODE`

## 5. Initial Catalog (9)

| ID | Type | Nome |
|----|------|------|
| text-information | TEXT | Informação |
| text-alert | TEXT | Aviso |
| text-emergency | TEXT | Emergência |
| clock-digital | CLOCK | Relógio Digital |
| clock-analog | CLOCK | Relógio Analógico |
| notice-standard | NOTICE | Aviso Simples |
| notice-urgent | NOTICE | Aviso Urgente |
| event-institutional | EVENT | Evento Institucional |
| qr-instruction | QR_CODE | QR + Instrução |

## 6. Template Definition

`{ id, type, name, description, category, icon, version, defaults }`

`defaults`: `{ title, description?, durationMs, payload }`

## 7. Defaults

Declarativos JSON. Sem scripts. Placeholders neutros.

## 8. Template → Content

`/admin/contents/new` → escolher blank ou template → `?templateId=` → Content Studio → save → Content autónomo.

## 9. Versioning

`template.version` (ex. `"1.0"`) ≠ Content.version / Manifest / Experience.

## 10. Independence

Deep clone em `createContentSeed`. Alterar Content não altera o Registry. Metadata `createdFromTemplateId` / `createdFromTemplateVersion` no payload é só auditoria.

## 11. Security

Sem eval / Function / HTML arbitrário / URLs como código. Templates = dados confiáveis do sistema.

## 12. UX

Chooser + TemplatePicker (Design System: PageHeader, Card, FilterBar, PreviewViewport, Badge, Button, EmptyState).

## 13. CLOCK live

CLOCK é dinâmico nos dois runtimes:

| Estilo | React Player | Legacy `tv.js` |
|--------|--------------|----------------|
| Digital | LIVE (`useLiveClock`) | LIVE (`renderDigitalClockFace`) |
| Analog | LIVE (ponteiros) | LIVE (`renderAnalogClockFace` + DOM/CSS) |

Fonte temporal = `Date` local do dispositivo. Sem rede. Timer limpo em `advanceSlide` / unmount. Cadência: 1s com segundos, ~30s sem segundos.

## 14. Future Extensions

Workspace templates / marketplace / upload — **não** nesta fase.

## 15. Tests

`npm run test:content-templates-01` (inclui CLOCK-LEGACY-001…012)

## 16. Known Limitations

- Catálogo estático (9 templates)
- Sem CRUD admin de templates
- Sem EXPERIENCE templates
- Provenance só em payload JSON
- Hisense physical Analog Clock validation: **pending** (Legacy Chromium validated via source contracts + React Chromium)

## 17. CLOCK RUNTIME PARITY

Verdict target: **CONTENT-TEMPLATES-01 — CLOCK RUNTIME PARITY VALIDATED** when CLOCK-LEGACY suite + React regression pass. Hisense physical retest remains separate evidence.
