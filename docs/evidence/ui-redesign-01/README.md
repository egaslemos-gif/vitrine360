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

## UI-REDESIGN-02 — direcção visual clara (inspirada em referência EduSphere)
Pedido: app de multimédia leve e agradável, **sem tema escuro**; player, cards, botões, listas, cores e efeitos inspirados na referência.

| Elemento | Alteração |
|---|---|
| Tokens (`globals.css`) | Fundo lavanda com brilhos suaves (lilás/azul/rosa), primária `#7057dc`, bordas e sombras com tom violeta, raios maiores (cards 24 px, painéis 30 px), paineis `workspace`/`sidebar` translúcidos |
| Card | Vidro branco translúcido, borda branca, sombra violeta suave |
| Button | Pílula (`rounded-full`), sombra colorida na primária, outline branco; tamanhos 40/48 px |
| Campos | `rounded-2xl`, fundo branco, 40 px |
| Shell admin | Painel principal em vidro (`backdrop-blur`), cabeçalho sticky na mesma tonalidade (sem faixa) |
| Sidebar | Item activo em pílula violeta sólida com sombra; hover lavanda |
| Landing | Totalmente clara: header em vidro, hero lavanda, player em cartão branco de 32 px, selos e passos em pílulas/cartões com tiles pastel, secção do player em painel de vidro com controlo remoto em lavanda, casos de uso com ícones pastel, CTA em gradiente violeta suave |
| Player demo | Canvas `rounded-2xl` com sombra suave; barra de controlos em vidro; playlist em miniaturas |
| Dashboard | Palco do ecrã em destaque em lavanda/azul claro (já não preto) |
| Editor de playlist | Itens em cartões arredondados; item seleccionado com a cor da marca (antes azul) |

O `/player` dos dispositivos (runtime) mantém fundo escuro: é o ecrã de sinalização/TV, onde o preto evita reflexos e é o padrão do sector. Não foi alterado.

Verificação: typecheck PASS; `npm test` exit 0; `test:ui-ux-01` PASS; build PASS; lint 116/6 (baseline, 0 novos). Sem scroll horizontal em 5 larguras (1920, 1366, 1024, 768, 390) × 9 páginas (landing, dashboard, ecrãs, playlists, editor, media, conteúdos, agendamentos, definições).
