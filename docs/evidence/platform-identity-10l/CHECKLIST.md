# PI-10L CHECKLIST

- [x] signed upload size constraint implementada
- [x] completeMediaUpload continua validando actual size (HEAD)
- [x] expectedBytes validado (>0, integer, ≤ MAX)
- [x] actual < reserved correctamente reconciliado
- [x] actual > reserved bloqueado
- [x] signed URL tenant-safe
- [x] signed URL key-safe
- [x] signed URL expiration validada
- [x] unique tenant+checksum confirmado no DB (PRAGMA)
- [x] duplicate detection executada
- [x] checksum race test PASS
- [x] dedupe quota-safe
- [x] failure cleanup PASS
- [x] reservation semantics preservadas
- [x] documentação criada
- [x] regressions / tooling (gate run)
