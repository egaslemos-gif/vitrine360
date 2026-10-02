# PLAYER-PRO-01 — Relatório final da auditoria

**Fase:** auditoria (sem alterações funcionais). **Commit auditado:** `32a10ca`. **Deploy / Production:** não tocados. **Implementação:** aguarda autorização.

## Veredicto
**AUDITORIA CONCLUÍDA — correcções por autorizar.** Foram encontrados **2 defeitos CONFIRMED reproduzidos em Chrome real**, 1 mecanismo **LIKELY** reproduzido em simulação de política, e vários defeitos confirmados por leitura de código. Nada do que foi pedido na secção "Restrições" foi violado.

## Resumo dos sintomas observados
| # | Sintoma | Conclusão | Causa |
|---|---|---|---|
| 1 | Controlos parecem não funcionar | **CONFIRMED (parcial)** | RC-01 (Stop/seek-em-pausa retomam sozinhos), RC-02 (2.º seek igual ignorado), RC-03/14 (UI `PLAYING` com elemento parado) |
| 2 | Vídeo arranca mas por vezes sem áudio | **LIKELY** + **PLATFORM LIMITATION** | RC-03 (mecanismo reproduzido em simulação), RC-11 (política do browser). Não reproduzível em Chrome automatizado |
| 3 | Playlist pára no fim do último vídeo | **UNCONFIRMED** (não reproduzido; contrato conforme) | RC-12: RC-03/RC-07/RC-05 |
| 4 | Repetição activa por padrão | **CONFIRMED conforme** | `repeatMode: "PLAYLIST"`; ≥ 4 ciclos |
| 5 | Compatibilidade IMAGE/GIF/VIDEO/AUDIO/TEXT/CLOCK/NOTICE/EVENT/QR/EXPERIENCE | Sem regressão (RP-01..07, EXPERIENCE-09/10/11, Content Templates verdes). GIF = IMAGE `image/gif`; EXPERIENCE com controlo enganador (RC-06) | |
| 6 | Computador × SRAF Hisense | **UNCONFIRMED** (sem hardware; Chromium ≠ Smart TV) | RC-13 |
| 7 | UI diz sucesso só porque o botão foi premido | **CONFIRMED** | RC-04, RC-14 |

## Defeitos reproduzidos nesta fase (Chrome real, `probe-results.json`)
- **C2** — seek enquanto `PAUSED`: o vídeo retoma (`status=PAUSED`, `paused=false`).
- **C3** — Stop: ≈ 1,8 s depois o vídeo toca com `status=STOPPED`.
- **E1** — Home duas vezes: o 2.º é ignorado (3,35 s → 4,26 s).
- Simulação de política (`probe-sim-results.json`): S2/S3 defeitos; S4 (Pause→Play) é a única recuperação.
- Conformes: arranque, Pause, Play após Stop, Mute/Unmute, volume, repetição padrão/ciclo, matriz VIDEO→IMAGE→AUDIO→VIDEO, volta ao 1.º item (11/14 checks OK; os 3 em falta são os defeitos acima).

## Limites honestos
- A simulação de política de autoplay é um **modelo** do comportamento documentado do Chromium; não substitui Chrome sem automação nem a TV.
- Os checks A2/B1 da sonda não detectam o caso "elemento mudo + UI 'Mute'" em Chrome automatizado (não há bloqueio); o caso está coberto pela simulação e por leitura de código.
- A matriz de transições tem **GAPs** de teste de browser (IMAGE→GIF, GIF→VIDEO, VIDEO→AUDIO, AUDIO→IMAGE/AUDIO, NEXT/STOP durante LOADING, soak de horas).
- **Nenhuma validação física de Smart TV** foi feita.

## Validação final (sem alterações funcionais)
| Verificação | Resultado |
|---|---|
| `npm test` (baseline antes da sonda) | **exit 0** |
| `tsc --noEmit` | **exit 0** |
| `eslint .` | baseline mantida: 6 erros / 110 avisos pré-existentes; ficheiros novos limpos |
| `next build` | **exit 0** |
| Working tree | apenas `docs/evidence/player-pro-01/` e `scripts/player-pro-01-probe.ts` (novos, não commitados); 18 docs com carimbos repostos por ficheiro |

## Ficheiros desta fase
`PRE-AUDIT.md` · `PLAYER-CONTROL-MATRIX.md` · `REPEAT-MODE-AUDIT.md` · `AUDIO-VIDEO-DIAGNOSTICS.md` · `MEDIA-TRANSITION-MATRIX.md` · `PLAYER-UX-AUDIT.md` · `ROOT-CAUSES.md` · `IMPLEMENTATION-PLAN.md` · `FINAL-REPORT.md` · `instrument.js` (instrumentação externa) · `probe-results.json`, `probe-events.json`, `probe-sim-results.json`, `probe-sim-events.json`, `probe-final.png` · `scripts/player-pro-01-probe.ts`.

## Reprodução
```
DATABASE_URL=file:./data/authz02-e2e.db MEDIA_STORAGE_PROVIDER=local MEDIA_LOCAL_DIR=./data/authz02-media npx next start -p 3150
BASE_URL=http://localhost:3150 npx tsx scripts/player-pro-01-probe.ts
SIM_POLICY=1 BASE_URL=http://localhost:3150 npx tsx scripts/player-pro-01-probe.ts
```
(BD e armazenamento descartáveis.)

## Proposta (por risco e dependências) — ver `IMPLEMENTATION-PLAN.md`
1. RC-02 seek · 2. RC-01 `ensureMediaPlayback` condicionado ao estado · 3. EXPERIENCE/repetição visível e em PT · 4. erros por `MediaError.code` + buffering · 5. reconciliação físico→lógico e "som bloqueado" · 6. `ensureMediaPlayback` sem desmutar sem gesto · 7. recuperação limitada de `PAUSED`/`PLAYING` parado · 8. testes · 9. validação física.
