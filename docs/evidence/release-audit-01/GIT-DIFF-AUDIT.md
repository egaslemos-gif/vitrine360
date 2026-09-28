# GIT DIFF AUDIT

## Alterações de Código de Produção
| Arquivo | Descrição | Justificação | Risco |
|---------|-----------|--------------|-------|
| `src/services/contents.ts` | Refatoração da função `uploadMediaAsset` para validar MIME types usando estritamente o retorno de `sniffMime(params.data)`. Mapeamento explícito de tipos de vídeo para áudio se requisitado (WebM/MP4), caso contrário rejeita o upload se a assinatura do arquivo não for válida. | Eliminar a vulnerabilidade que permitia uploads bypassando validação através de fallbacks arbitrários no MIME type. | Baixo (já mitigado por testes extensivos) |
| `src/services/media/paths.ts` | Remoção do argumento de `fallback` na função `sniffMime`. A função agora retorna `string \| null` dependendo estritamente do conteúdo binário (magic numbers). | Centralização da segurança, retirando o controle do MIME type declarado pelo cliente da validação estrita (magic numbers). | Baixo |

## Alterações de Código de Teste
| Arquivo | Descrição da Alteração | Justificação e Implicações na Cobertura |
|---------|------------------------|-----------------------------------------|
| `scripts/test-security-audit.ts` | Modificação de asserções originais que validavam o retorno de falbacks (ex: `sniffMime(Buffer.from("MZ-fake-exe"), "") === ""`) para validarem `null`. Adição de sub-testes (A a I) para verificação rigorosa de uploads e mismatch de MIME vs conteúdo. | **Necessária**: A asserção antiga testava um comportamento vulnerável. O código foi corrigido, e os testes agora verificam o bloqueio bem-sucedido de arquivos forjados (ex: `MZ-fake-exe`). **Cobertura**: Aumentou significativamente com os casos adicionais (A a I). |
| `scripts/test-gif-support-3c.ts` | Chamadas para `sniffMime(GIF, "...")` foram atualizadas para `sniffMime(GIF)`. | **Necessária**: Para refletir a nova assinatura (sem argumento fallback) do método. **Cobertura**: Mantida. |
| `scripts/test-media-library-3a.ts`| Chamadas para `sniffMime(MP4, "...")` foram atualizadas para `sniffMime(MP4)`. | **Necessária**: Mesma razão que o script acima. **Cobertura**: Mantida. |
| `scripts/test-runtime-experience-09.ts` | Teste de `display-engine.tsx` migrado para `playback-renderer-adapter.tsx` (asserção de `item.type === "EXPERIENCE"`). | **Necessária**: Refatoração arquitetural anterior delegou o tratamento do renderizador EXPERIENCE para o adapter, tornando a asserção no engine desatualizada. **Cobertura**: Mantida. |
| `scripts/test-clock-legacy-parity.ts` | Expectativa do hash `v=055` em `tv.html` e `tv-sw.js` atualizada para `v=057`. | **Necessária**: O HTML e SW foram atualizados na produção em iterações anteriores, provocando falha no teste desatualizado. **Cobertura**: Mantida. |
| `scripts/test-runtime-playback-05.ts` | O subteste MEDIA-054 foi ramificado para asserções A-H verificando a resposta a terminal failures vs recovered failures. | **Necessária**: O teste desatualizado presumia sempre estado LOADING / PLAYING durante MEDIA_ERROR o que contrariava a especificação oficial de PLAYBACK-CONTRACT-02. **Cobertura**: Aumentou significativamente com verificações separadas para cada subtipo de erro e recovery. |
