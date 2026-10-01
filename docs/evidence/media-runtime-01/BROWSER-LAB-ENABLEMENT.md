# MEDIA-RUNTIME-01 — Browser Lab Enablement

Objectivo: tornar `/player/lab` acessível num ambiente de teste (Preview) sem o activar em produção.
Não foram tocados: PlaybackController, Renderer Adapter, Duration Contract, media lifecycle, Player Runtime.

## 1. Auditoria do guard

Mensagem `Playback lab is disabled in production.`

| Estado | Local | Condição |
|---|---|---|
| Commit `HEAD` (o que está em produção) | `src/app/player/lab/page.tsx` | `process.env.NODE_ENV === "production"` → bloqueado. **Sem feature flag.** |
| Working tree (este trabalho) | `src/app/player/lab/layout.tsx` | `!isPlaybackLabEnabled(process.env)` |

- Não existia nenhuma feature flag no `HEAD`. O guard dependia só de `NODE_ENV`.
- Na Vercel, `NODE_ENV=production` em **Production e Preview**. Portanto, sem flag, o Preview também estaria bloqueado.
- O guard do `page.tsx` foi removido, porque passou para o layout. A decisão fica num só ponto, o layout. O guard não foi removido do sistema.

| Ambiente | Comportamento |
|---|---|
| development / test | disponível (inalterado) |
| production (flag ausente / `false` / qualquer valor ≠ `"true"`) | **bloqueado** |
| Preview / staging com `PLAYBACK_LAB_ENABLED=true` | disponível |

## 2. Solução

- Variável server-side `PLAYBACK_LAB_ENABLED`; default seguro = bloqueado.
- Não é `NEXT_PUBLIC_*`, por isso não chega ao browser.
- Só o valor exacto `"true"` activa. `TRUE`, `1` e vazio não activam.
- Lógica pura em `src/lib/playback-lab-guard.ts`, usada por `src/app/player/lab/layout.tsx`.
- `.env.example` documenta a variável (comentada).
- Sem bypass, sem credenciais, sem secrets no client.

**Nota importante:** `/player/lab` é prerenderizado como estático (`○` no output do build). A variável é lida **em build time**.
Alterá-la na Vercel exige **novo deployment**. Redeploy do mesmo build não chega.

## 3. Validação

| Teste | Resultado |
|---|---|
| A. Produção (build sem flag, `next start`) → `/player/lab` | bloqueado ("Playback lab is disabled in production.") |
| B. Build com `PLAYBACK_LAB_ENABLED=true`, `next start` → `/player/lab` | disponível (`data-playback-lab="loading"`) |
| C. `/player` nos dois builds | HTTP 200, inalterado |
| D. `npm run build` | PASS |
| E. `npm run typecheck` | PASS |
| F. `npm run lint` | 116 problemas (6 erros, 110 warnings). Igual à baseline anterior a esta tarefa (preservada em `docs/evidence/release-hygiene-01/POST-CLEANUP.md`). Nenhum ficheiro desta tarefa aparece nos problemas. |
| G. `npm test` | PASS com `src/lib/api.ts` do HEAD (ver abaixo) |
| Novo teste | `npm run test:playback-lab-guard` PASS (adicionado ao fim de `npm test`) |

### Ressalva em G
Com o working tree completo, `test-platform-identity-10g` falha em `PI10G-ERROR` (403 QUOTA_EXCEEDED contract).
Causa: alteração **não commitada e anterior a esta tarefa** em `src/lib/api.ts` (authz-device-02), onde `handleApiError` devolve `error: error.code` em vez de `"ENTITLEMENT_DENIED"`.
Com o `api.ts` do HEAD, `npm test` passa na totalidade (exit 0). O `api.ts` foi restaurado ao estado do working tree. Não foi alterado.
Esse teste ou esse contrato tem de ser reconciliado no trabalho authz-device-02.

## 4. Deploy (Preview) — configuração necessária

Não foi feito deploy: a Vercel CLI não está instalada e o MCP da Vercel não está autenticado nesta sessão. Não foi alterada nenhuma variável de Production.

1. Definir `PLAYBACK_LAB_ENABLED=true` **apenas no ambiente Preview** (Project → Settings → Environment Variables, só "Preview"; idealmente restrito ao branch de teste).
2. Garantir que Production **não** tem a variável (ou tem `false`).
3. Fazer push do branch (com `layout.tsx` + `playback-lab-guard.ts`) → a Vercel gera o Preview com a variável presente no build.
4. URL do Browser E2E: `https://<preview-deployment>.vercel.app/player/lab`.
   O URL exacto só existe após o deployment.
5. O Preview está sob Deployment Protection da Vercel por defeito. Isso é desejável e não foi alterado. O E2E automatizado precisa do bypass token da Vercel.

Se a variável for definida em Production, o lab fica público. É a condição de STOP desta tarefa e **não** foi feito.
