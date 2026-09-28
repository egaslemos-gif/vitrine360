# BASELINE RESULT

## Execução
O teste de segurança foi executado no commit de baseline imediatamente anterior (e subjacente) ao `PLAYBACK-CONTRACT-02`:
Commit `7145adc` (utilizando `git stash` para omitir as alterações locais de teste).

```bash
> vitrine360@0.1.0 test:security
> tsx scripts/test-security-audit.ts

1. Path traversal / upload helpers
2. Password hashing + JWT
3. Cross-tenant isolation + IDOR
AssertionError [ERR_ASSERTION]: Missing expected rejection.
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async main (E:\PROJECTOS IA\UNILICUNGO\PROJECTOS FCT2026\Vitrine360\scripts\test-security-audit.ts:152:3) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: undefined,
  expected: undefined,
  operator: 'rejects'
}
```

## Conclusão do Baseline
O mesmo erro foi observado no commit de baseline puro, confirmando que a falha já existia independentemente das implementações recentes.
