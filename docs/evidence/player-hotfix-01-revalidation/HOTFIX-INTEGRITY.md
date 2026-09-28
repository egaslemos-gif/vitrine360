# HOTFIX INTEGRITY

O escopo do `PLAYER-HOTFIX-01` introduzido em `src/player/playback/playback-renderer-adapter.tsx` (reconstrução do Blob MIME para GIF) e `public/tv.js` (inicialização *muted* para TVs Smart Legacy Hisense) exigia garantia total de isolamento.

## Resolução da Auditoria
- **A. GIF:** O condicional que determina `if (item.mimeType === "image/gif")` e reconstrói o MIME subjacente do Blob manteve-se **inalterado** em `playback-renderer-adapter.tsx`. Nenhuma rotina de reprodução de media ou segurança suprimiu ou anulou esse hotfix.
- **B. Legacy Hisense:** O ficheiro `public/tv.js` continua intacto, forçando explicitamente a media root para reprodução *muted* no arranque, protegendo as limitações do browser legado do Hisense sem desrespeitar os testes centrais do app (as falhas decorrentes do *mute-retry* degradaram para `PAUSED` suave, invés de falhar de forma terminal de volta ao fallback vazio).

Todas as modificações do HOTFIX original estão em produção sem qualquer alteração na ramificação corrente.
