# PRE-IMPLEMENTATION AUDIT

## Objetivo
Analisar a origem e a proveniência da falha no teste `npm run test:security` e determinar se ela foi introduzida pela implementação da `PLAYBACK-CONTRACT-02`.

## Factos Estabelecidos
1. A implementação `PLAYBACK-CONTRACT-02` foi iniciada no baseline/commit `7145adc`.
2. As alterações feitas durante `PLAYBACK-CONTRACT-02` consistiram na modificação do ficheiro `scripts/test-runtime-playback-05.ts` para alinhar as asserções de testes com os estados de erro (PAUSED vs ERROR). Nenhuma alteração foi feita no código de segurança da aplicação.
3. A falha no `npm test` ocorreu durante a execução do ficheiro `scripts/test-security-audit.ts`.

## Teste que Falha
O erro é um `AssertionError [ERR_ASSERTION]: Missing expected rejection.`

No ficheiro `scripts/test-security-audit.ts`, linha 152:
```typescript
  // Reject disguised executable as image
  await assert.rejects(() =>
    uploadMediaAsset({
      fileName: "evil.png",
      mimeType: "image/png",
      data: Buffer.from("MZ-fake-exe"),
      tenantId: tenantA,
    }),
  );
```

## Função em Causa
A função invocada é `uploadMediaAsset` em `src/services/contents.ts`.

A função usa `sniffMime` para inferir o Mime Type do Buffer, passando `params.mimeType` ("image/png") como fallback:
```typescript
  const sniffed = normalizeMediaMime(
    sniffMime(params.data, params.mimeType) || params.mimeType,
  );
```
O método `sniffMime` (em `src/services/media/paths.ts`) verifica a assinatura do ficheiro. Se a assinatura não corresponder a um tipo multimédia conhecido, retorna o `fallback`.

## Comportamento Esperado vs Observado
**Esperado:** O teste espera que a função `uploadMediaAsset` rejeite (throw Error) se for carregado um ficheiro executável disfarçado (sem a assinatura MIME real do tipo especificado e com um Buffer que não corresponda ao tipo MIME especificado).
**Observado:** Como o `sniffMime` não encontra correspondência para "MZ-fake-exe", retorna o fallback `"image/png"`. Como `"image/png"` é permitido em `ALLOWED_MIME`, o ficheiro é aceite e a operação é bem-sucedida, não disparando o erro e falhando o teste `assert.rejects`.
