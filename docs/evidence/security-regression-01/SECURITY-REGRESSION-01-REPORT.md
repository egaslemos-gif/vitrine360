# SECURITY-REGRESSION-01

## 1. Teste que falha
`test-security-audit.ts` ("Cross-tenant isolation + IDOR") - no bloco de validação de ficheiros executáveis disfarçados.

## 2. Assertion exacto
Ficheiro `scripts/test-security-audit.ts`, linha 152:
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
O erro disparado é:
`AssertionError [ERR_ASSERTION]: Missing expected rejection.`

## 3. Comportamento esperado
O teste espera que o upload de um executável (indicado pelo conteúdo `MZ-fake-exe`), mesmo que disfarçado sob o Mime Type `image/png`, seja rejeitado (throw Error) por causa da falta de validação adequada do header/magic numbers do Buffer.

## 4. Comportamento observado
A promessa de upload não é rejeitada. A função `uploadMediaAsset` permite a conclusão do upload porque a sua validação subjacente depende de `sniffMime`. 
A função `sniffMime` não reconhecendo a assinatura de "MZ-fake-exe", devolve silenciosamente a string "fallback" (`params.mimeType`, que é `image/png`). Como `image/png` pertence ao conjunto `ALLOWED_MIME`, o ficheiro é aceite.

## 5. Baseline
No commit base `7145adc`, isolado num ambiente seguro (usando o `git stash` para garantir que as alterações uncommitted relativas ao contrato de playback não inferissem), a execução de `npm run test:security` lança **exactamente a mesma falha**:
`AssertionError [ERR_ASSERTION]: Missing expected rejection.` na linha 152.

## 6. Current HEAD
Na árvore atual contendo as nossas verificações do playback contract, o teste de segurança lança exatamente a mesma falha vista no baseline.

## 7. Git diff relevante
As modificações locais consistem exclusivamente em:
- Ficheiros documentais na pasta `docs/`.
- Ficheiro `scripts/test-runtime-playback-05.ts`.
Nenhum código relacionado com a função `uploadMediaAsset`, nem os seus auxiliares (`sniffMime`), nem lógica de segurança, autorização ou tenant isolation foi sujeito a qualquer alteração.

## 8. Proveniência
PRE-EXISTING

## 9. Impacto sobre PLAYBACK-CONTRACT-02
Nenhum. A arquitetura de PlaybackContract opera de forma inteiramente separada do sistema de Asset Upload and Processing e Tenant Isolation.

## 10. Correcção recomendada
Modificar `sniffMime` no ficheiro `src/services/media/paths.ts` para ser estritamente descritivo e rigoroso: se um ficheiro não for compatível com as assinaturas verificadas, o método não deve retornar silenciosamente a variável fallback, mas deve, pelo menos, informar a falta de validação para permitir que `uploadMediaAsset` ou outro chamador possa rejeitar formalmente o buffer.
Alternativamente, em `uploadMediaAsset`, forçar que se o valor retornado de `sniffMime` for estritamente igual ao `fallback`, seja realizada uma validação adicional que garanta a identidade real do ficheiro antes de persistir, ou rejeitar o upload caso não coincida com os magic numbers permitidos.
