# UI-REDESIGN-01 — landing, dashboard e editor de playlist

Objectivo: layout responsivo e profissional, com o **Player sempre em evidência**. O runtime do player (`/player`) não foi alterado.

## Alterações
| Área | Alteração |
|---|---|
| Landing (`features/marketing/landing-page.tsx`) | Reescrita em português. Hero escuro com título que explica a essência ("Todos os seus ecrãs. Um só painel de controlo."), CTAs, selos (offline / multi-ecrã / controlo remoto), **player interactivo grande** e faixa Criar → Distribuir → Reproduzir → Controlar. Secções: Produto, Player + controlo remoto, Casos de uso, Fiabilidade, CTA final, rodapé. Menu mobile (`landing-mobile-menu.tsx`). Anchors com scroll suave (respeita `prefers-reduced-motion`) |
| Player demo (`components/landing/interactive-player-demo.tsx`) | Props `tone="dark"` e `playlistLayout="below"`: playlist em miniaturas por baixo do vídeo (2×2 no mobile), faixa "em reprodução / a seguir", textos em português. Corrigido o CSS do shell, que não é `@layer` e anulava as utilities (variante `data-tone="dark"`) |
| Dashboard (`app/admin/page.tsx`) | O ecrã em reprodução passa a abrir a página, em grande, com estado, playlist e último contacto. Removido o falso cronómetro "0:00". Métricas 2×2 e acesso rápido na coluna direita. Corrigido o corte de 17 px a 1024 px |
| Editor de playlist | Pré-visualização com 7/12 colunas, fixa (`sticky`) ao fazer scroll. No mobile vem logo a seguir aos detalhes |
| Navegação | Rótulos das secções em português |
| Metadados | `title`/`description` em português |

## Verificação
- `npm run typecheck` PASS; `npm test` PASS (exit 0, 93 testes em `test:authz-device-02`); `npm run build` PASS.
- Lint: 116 problemas / 6 erros, idêntico à baseline (0 novos). O aviso de hidratação no editor de playlist existe também sem estas alterações (verificado com o ficheiro original).
- Screenshots Playwright a 1920, 1366, 1024, 768 e 390 px: sem scroll horizontal na landing, em `/admin`, `/admin/devices`, `/admin/playlists`, `/admin/media`, `/admin/contents`, `/admin/schedules`, `/admin/settings`, no editor de playlist e em `/player`.
- Sem erros de consola em `/`, `/admin`, `/admin/playlists`, `/admin/devices`.
- Medições feitas contra uma BD SQLite descartável (seed AUTHZ-02), não contra dados reais.
