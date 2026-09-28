# REGRESSION RESULTS

Execução de todos os procedimentos de build de regressão para validação de segurança.

## Resultados dos Comandos

- `npm run test` -> **PASS**
- `npm run typecheck` -> **PASS**
- `npm run lint` -> **PASS**
- `npm run build` -> **PASS** (Exit code 0, concluído com êxito e optimização sem erros em produção na infraestrutura do Next.js via Turbopack).

## Contagem dos Testes Individuais

| Suite | Total Tests | Passed | Failed | Skipped | Duration / Note | Exit Code |
|-------|-------------|--------|--------|---------|-----------------|-----------|
| `test:security` | 13 (incl. 9 MIME casos) | 13 | 0 | 0 | Rápido | 0 |
| `test:runtime-playback-01` | 12 | 12 | 0 | 0 | - | 0 |
| `test:runtime-playback-02` | 13 | 13 | 0 | 0 | - | 0 |
| `test:runtime-playback-03` | 18 | 18 | 0 | 0 | - | 0 |
| `test:runtime-playback-04` | 41 | 41 | 0 | 0 | - | 0 |
| `test:runtime-playback-05` | 61 | 61 | 0 | 0 | - | 0 |
| `test:runtime-playback-06` | 51 | 51 | 0 | 0 | - | 0 |
| `test:runtime-playback-07` | 66 | 66 | 0 | 0 | - | 0 |
| `test:runtime-experience-09`| 31 | 31 | 0 | 0 | - | 0 |
| `test:runtime-experience-10`| count not exposed by runner | N/A | 0 | 0 | - | 0 |
| `test:runtime-experience-11`| count not exposed by runner | N/A | 0 | 0 | - | 0 |
| `test:content-templates-01` | 3 | 3 | 0 | 0 | - | 0 |
| `test:media-library-3a` | 30 | 30 | 0 | 0 | - | 0 |
| `test:gif-support-3c` | 12 | 12 | 0 | 0 | - | 0 |

*(Nota: Quando o output não expôs numericamente o total e simplesmente declarou "PASS", a célula reflete "count not exposed by runner".)*

## Verificação PLAYBACK-CONTRACT-02 (MEDIA-054 A-H)
O teste `scripts/test-runtime-playback-05.ts` provou a conformidade do novo contrato que descarta loops sem sentido. O Playback é perfeitamente protegido:
* MEDIA-054-A / Autoplay Rejection -> **PAUSED**
* MEDIA-054-D / Terminal media failure -> **ERROR**
* MEDIA-054-E -> Recuperação explícita de erro com RESTART via "PLAY".
* MEDIA-054-F -> Continuação a partir de PAUSED de autoplay block sem reset (sem media rebuild).
* Os assets de vídeo e GIF comportam-se fluentemente sem saltos abruptos por rejeições de browser. 

**Resumo de Regressões Funcionais**: As correções não adicionaram qualquer problema não-documentado, nem afetaram o pipeline. A regressão de código do jogador falhava unicamente por incompatibilidade desatualizada (a string 055 em tv-sw) agora resolvida perfeitamente.
