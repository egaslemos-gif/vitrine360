# REGRESSION — AUTHZ-DEVICE-02

## Testes de Regressão Executados

### 1. Testes Unitários Existentes
```
npx tsx --test src/domain/types.test.ts
# tests 10 — pass 10 — fail 0
```

### 2. Novos Testes RBAC
```
npx tsx --test src/domain/device-authz.test.ts
# tests 63 — pass 63 — fail 0
```

### 3. Novos Testes Error Mapping
```
npx tsx --test src/lib/api-error-mapping.test.ts
# tests 13 — pass 13 — fail 0
```

### 4. TypeScript Typecheck
```
npx tsc --noEmit
# exit code 0 — sem erros
```

### 5. Next.js Build
```
npx next build
# exit code 0 — build concluído
# todas as rotas compiladas
```

## AUTHZ-DEVICE-02B — revalidação (working tree final)

| Verificação | Resultado |
|---|---|
| `npm run test:authz-device-02` | 93 testes, 0 falhas |
| `npm test` (completo) | **PASS**, exit 0 |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run lint` | 116 problemas / **6 erros** pré-existentes (ver FINAL-VALIDATION.md); 0 nos ficheiros desta tarefa |
| Browser E2E | 71/71 |

### Correcção da conclusão anterior
A secção "Análise de Compatibilidade" original concluía "Nenhuma regressão". Estava errada:
- `npm test` completo **não tinha sido executado**; falhavam `PI10G-ERROR` e `PI10J-ERROR` (contrato antigo `error:"ENTITLEMENT_DENIED"` para quota).
- `direct-upload.ts` (`/direct upload not supported/i` sobre `data.error`) deixaria de fazer fallback multipart, porque `error` passou a ser `VALIDATION_ERROR`.
- Vários formulários perderiam mensagens legíveis (membership, Zod, not found).
Tudo corrigido em 02B. Detalhe e tabela por consumidor: `API-CONSUMER-COMPATIBILITY.md`.
