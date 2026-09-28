# TEST INTEGRITY AUDIT

## 1. `scripts/test-gif-support-3c.ts` e `scripts/test-media-library-3a.ts`
* **OLD ASSERTION:** `assert.equal(sniffMime(GIF, ""), "image/gif")` e `assert.equal(sniffMime(MP4, ""), "video/mp4")`
* **NEW ASSERTION:** `assert.equal(sniffMime(GIF), "image/gif")` e `assert.equal(sniffMime(MP4), "video/mp4")`
* **REASON:** A assinatura de produção mudou globalmente e a função `sniffMime` foi extraída para analisar estritamente apenas a amostra binária de Buffer de media recebido para reforço da segurança, portanto os testes atualizaram suas chamadas que antes inseriam fallback arguments.
* **PRODUCTION EVIDENCE:** `src/services/media/paths.ts` em `sniffMime(data: Buffer)` e chamadas sem segundo argumento pela stack em `uploadMediaAsset`.
* **COVERAGE IMPACT:** **Mantido**. A avaliação principal (verificar a correspondência da decodificação GIF/MP4) mantém-se rigorosamente idêntica na validação estrita.

## 2. `scripts/test-runtime-experience-09.ts`
* **OLD ASSERTION:** O teste inspecionava se `src/player/playback/display-engine.tsx` usava `item.type === "EXPERIENCE"`.
* **NEW ASSERTION:** Inspeciona exatamente as mesmas asserções, mas direcionado ao arquivo de produção adaptado: `src/player/playback/playback-renderer-adapter.tsx`.
* **REASON:** Houve uma migração arquitetural que delegou e extraiu o loop de renderização para o `playback-renderer-adapter.tsx`. O assertion continuava correto, no entanto as asserções de segregação precisavam apontar para o novo location da renderização EXPERIENCE.
* **PRODUCTION EVIDENCE:** `src/player/playback/playback-renderer-adapter.tsx` contém a renderização e submissão aos componentes delegados Experience sem interagir com runtime perigoso/shell (validação mantida isolada).
* **COVERAGE IMPACT:** **Mantido**. Garantias da experiência e segregação continuam auditadas corretamente.

## 3. `scripts/test-clock-legacy-parity.ts`
* **OLD ASSERTION:** Validava a injeção do cache-bust no formato hash exato: `tv.js?v=055` lendo diretamente do `public/tv.html`.
* **NEW ASSERTION:** Verifica `tv.js?v=057` e `tv-sw.js` com o mesmo `v057`.
* **REASON:** Anteriormente no lifecycle normal, os recursos the produção estáticos do player e Service Worker HTML sofreram bump real para a versão de deploy 057, desatualizando a versão fixada no teste. O teste foi reatualizado para bater certo com a baseline do software.
* **PRODUCTION EVIDENCE:** O conteúdo final submetido à CDN de `public/tv.html` inclui o node real `<script src="/tv.js?v=057"></script>`. 
* **COVERAGE IMPACT:** **Mantido**. Assegura robustamente que a interface shell TV da Vitrine suporta cache busts ativados na submissão ao invés de ignorá-los.
