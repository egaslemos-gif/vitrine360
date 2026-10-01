# BROWSER-VALIDATION — AUTHZ-DEVICE-02B

Chromium (Playwright) contra `next start` (build de produção da working tree final), `ENTITLEMENTS_ENABLED=true`, BD SQLite descartável.
Script: `scripts/authz02-e2e-browser.ts` — **71/71 PASS** (`e2e-results.json`). Screenshots em `screenshots/`.

| Perfil | Fluxo | Resultado |
|---|---|---|
| ADMIN (tenant normal) | Ecrãs → formulário → sucesso real; activation inválido real; já registado real; casos A–E + interno + legado (mock HTTP) | PASS; mensagens PT, sem códigos técnicos |
| OPERATOR | sucesso real; permissão revogada com o form aberto → "Permissão insuficiente" | PASS |
| EDITOR | `/admin/devices` → "Acesso negado", sem formulário; API directa 403 `PERMISSION_DENIED` | PASS |
| VIEWER | idem | PASS |
| ADMIN (devices.enabled=false) | "Funcionalidade indisponível" | PASS |
| ADMIN (quota cheia) | "Limite de Ecrãs atingido" | PASS |

## DevTools
- `pageerror` (excepções não tratadas): **0** em todos os perfis.
- Erros React: **0**. O único `console.error` são os logs nativos do browser "Failed to load resource … 4xx", que correspondem às respostas de erro esperadas.
- Pedidos duplicados: 1 POST por submissão (3 cliques + 3 `requestSubmit` → 1 pedido).
- Respostas de erro: sem stack trace nem mensagem interna (500 devolve `Internal server error`). `grep` do log do servidor por `stack|secret|token`: sem ocorrências.
- Não foi feita inspecção manual de cabeçalhos/cookies. Nenhum token/secret foi observado nos corpos de erro.

## Regressão visual
| Verificação | Resultado |
|---|---|
| Layout do formulário inalterado | PASS (`admin-form.png`) |
| Caixa de erro dentro do card | PASS |
| Texto longo (400 caracteres sem espaços + 60 palavras), mobile 390px e desktop 1280px | PASS após correcção |
| Botão em loading ("A associar Ecrã…") | PASS |
| Estado de sucesso | PASS (`admin-success.png`) |
| Mobile utilizável (botão visível/activo, sem scroll horizontal) | PASS (`long-error-mobile.png`) |

**Defeito encontrado e corrigido nesta validação:** a 1.ª execução falhou 2 verificações. Uma mensagem longa sem espaços (ex.: erros Zod vindos do servidor) excedia a caixa em 2972 px (desktop) e o formulário em 3554 px (mobile). Correcção em `pair-device-form.tsx`: `min-w-0` nos contentores e `[overflow-wrap:anywhere]` nos textos. Reexecução: 0 overflow.

## Limitações
- Apenas Chromium. Mobile = viewport 390px, não dispositivo real.
- Contas sintéticas numa BD descartável. Não foi feito E2E contra Produção/Preview.
