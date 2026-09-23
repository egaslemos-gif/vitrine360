# Vitrine360 — E2E Validation Checklist

**Documento:** `E2E-VALIDATION-CHECKLIST.md`  
**Produto:** Vitrine360  
**Finalidade:** checklist mestre para validar o fluxo completo desde a criação de um novo Device/Ecrã até sincronização, playback e deploy na Vercel.

**Execução local actual:** [E2E-VALIDATION-REPORT.md](./E2E-VALIDATION-REPORT.md)  
**Validação Vercel actual:** [PRODUCTION-E2E-REPORT.md](./PRODUCTION-E2E-REPORT.md)  
**Harness de serviços:** `npm run test:e2e-checklist` (usar uma SQLite isolada conforme o relatório)

---

## 0. Identificação da execução

| Campo | Valor |
|---|---|
| Execução | E2E-________ |
| Versão/Commit | |
| Ambiente | LOCAL / STAGING / PRODUCTION |
| Data | |
| Responsável | |
| Tenant | |
| Device | |
| Device ID | |
| Browser/Runtime | |
| Hardware | |
| Vercel Deployment | |

### Estados permitidos

- `PASS` — evidência suficiente e comportamento esperado confirmado.
- `FAIL` — comportamento esperado não confirmado.
- `BLOCKED` — não pode ser executado por dependência externa.
- `NOT TESTED` — ainda não executado.
- `N/A` — não aplicável, com justificativa obrigatória.

---

# GATE 0 — Ambiente e qualidade

## E2E-001 — Ambiente

- [ ] Branch/repositório correcto
- [ ] Ambiente correcto
- [ ] Variáveis de ambiente configuradas
- [ ] Turso/SQLite acessível
- [ ] R2 acessível
- [ ] Authentication funcional
- [ ] URL pública correcta

**Resultado:** `________`

## E2E-002 — Quality Gate

```bash
npm run typecheck
npm run lint
npm run build
```

- [ ] Typecheck — PASS
- [ ] Lint — PASS
- [ ] Build — PASS

**Evidência:** ______________________

**Resultado:** `________`

---

# GATE 1 — Criação do Device/Ecrã

## E2E-003 — Criar novo Device

- [ ] Criar Device a partir da administração
- [ ] Nome correcto
- [ ] Hardware type correcto
- [ ] Tenant correcto
- [ ] Location, se aplicável
- [ ] Zone, se aplicável
- [ ] Device Group, se aplicável
- [ ] Playlist padrão, se aplicável
- [ ] Device aparece na listagem
- [ ] ID único
- [ ] Estado inicial correcto

**Resultado:** `________`

## E2E-004 — Tenant Isolation

- [ ] Device visível apenas no tenant correcto
- [ ] APIs rejeitam acesso cross-tenant
- [ ] Device não aparece para outro tenant

**Resultado:** `________`

---

# GATE 2 — Pairing e Bootstrap

## E2E-005 — Pairing

- [ ] Abrir `/player`
- [ ] Fallback legacy funciona quando aplicável
- [ ] Pairing code apresentado
- [ ] Expiração apresentada
- [ ] Código válido aceite
- [ ] Device reclamado
- [ ] Identity/token persistido
- [ ] Bootstrap concluído

**Resultado:** `________`

## E2E-006 — Pairing Security

- [ ] Código inválido rejeitado
- [ ] Código expirado rejeitado
- [ ] Tenant incorrecto rejeitado
- [ ] Token não exposto na UI administrativa

**Resultado:** `________`

---

# GATE 3 — Media Library e Content

## E2E-007 — Upload de MediaAsset

- [ ] Upload de imagem
- [ ] Upload de vídeo
- [ ] SHA-256 calculado
- [ ] MediaAsset criado
- [ ] Objecto criado no storage
- [ ] URL funcional
- [ ] Download funcional

**Resultado:** `________`

## E2E-008 — Media Deduplication

Enviar exactamente o mesmo ficheiro novamente.

- [ ] Mesmo checksum
- [ ] MediaAsset físico não duplicado
- [ ] Asset existente reutilizado
- [ ] Storage não duplicado
- [ ] Usage count correcto

**Resultado:** `________`

## E2E-009 — Content Creation

- [ ] Criar Content por upload
- [ ] Criar Content usando Media Library
- [ ] ContentAsset criado
- [ ] MediaAsset reutilizado
- [ ] Conteúdo aparece correctamente

**Resultado:** `________`

## E2E-010 — Content/Asset Delete Safety

- [ ] Asset usado por Content não pode ser eliminado indevidamente
- [ ] Content usado por Playlist é protegido
- [ ] Tenant isolation mantida

**Resultado:** `________`

---

# GATE 4 — Playlist

## E2E-011 — Playlist CRUD

- [ ] Criar Playlist
- [ ] Editar nome
- [ ] Adicionar Content
- [ ] Remover Content
- [ ] Guardar
- [ ] Reabrir
- [ ] Dados persistem

**Resultado:** `________`

## E2E-012 — Reorder

- [ ] Drag & Drop
- [ ] Move Up
- [ ] Move Down
- [ ] Ordem persistida
- [ ] Ordem preservada após reload

**Resultado:** `________`

## E2E-013 — Duration

- [ ] Content duration
- [ ] `durationOverrideMs`
- [ ] Vídeo com override > 0
- [ ] Vídeo com `durationOverrideMs = 0`
- [ ] Imagem com duração fixa

**Resultado:** `________`

## E2E-014 — Natural Video Duration

- [ ] Vídeo não é cortado pelo timer quando duration = 0
- [ ] `onended` avança
- [ ] `onerror` avança
- [ ] Sem timers concorrentes
- [ ] Offline cached video mantém comportamento

**Resultado:** `________`

## E2E-015 — Duplicate Playlist

- [ ] Playlist duplicada
- [ ] Items copiados
- [ ] Content reutilizado
- [ ] MediaAsset reutilizado
- [ ] Schedule não duplicado indevidamente
- [ ] Device association não duplicada indevidamente

**Resultado:** `________`

## E2E-016 — Playlist Delete Safety

- [ ] Playlist sem dependências pode ser eliminada
- [ ] Playlist com dependências é protegida
- [ ] currentPlaylistId respeitado
- [ ] Schedule dependency respeitada

**Resultado:** `________`

---

# GATE 5 — Distribution / Schedule

## E2E-017 — Default Playlist

- [ ] `currentPlaylistId` configurado
- [ ] Resolver utiliza fallback
- [ ] Device reproduz playlist padrão

**Resultado:** `________`

## E2E-018 — Schedule por Device

- [ ] Criar Schedule
- [ ] Target DEVICE
- [ ] Playlist correcta
- [ ] Schedule activo
- [ ] Device recebe playlist programada

**Resultado:** `________`

## E2E-019 — Schedule por Group

- [ ] Criar Schedule
- [ ] Target GROUP
- [ ] Device membro recebe schedule
- [ ] Device fora do grupo não recebe

**Resultado:** `________`

## E2E-020 — Schedule ALL

- [ ] Target ALL
- [ ] Aplicação ao tenant correcto
- [ ] Outro tenant não afectado

**Resultado:** `________`

## E2E-021 — Priority

Testar:

```text
NORMAL
HIGH
EMERGENCY
```

- [ ] Prioridade correcta
- [ ] Tie-break determinístico
- [ ] Emergency targeted respeita target
- [ ] Fallback após término

**Resultado:** `________`

## E2E-022 — Timezone

- [ ] Device timezone
- [ ] Tenant timezone
- [ ] UTC fallback
- [ ] Boundary de início
- [ ] Boundary de fim

**Resultado:** `________`

---

# GATE 6 — Manifest

## E2E-023 — Effective Playback → Manifest

- [ ] Resolver determina playlist correcta
- [ ] Manifest corresponde ao resolver
- [ ] Content correcto
- [ ] Assets correctos
- [ ] Ordem correcta
- [ ] Duration correcta
- [ ] Natural duration preservada

**Resultado:** `________`

## E2E-024 — Manifest Version

Alterar playlist:

```text
Playlist A
    ↓
Playlist A'
```

- [ ] Version incrementada
- [ ] Device detecta divergence
- [ ] Manifest actualizado

**Resultado:** `________`

## E2E-025 — Tenant Isolation

- [ ] Manifest só contém dados do tenant correcto
- [ ] Assets só do tenant correcto
- [ ] Device não consegue obter manifest de outro tenant

**Resultado:** `________`

---

# GATE 7 — Sync e Atomic Activation

## E2E-026 — Normal Sync

```text
Server
 ↓
Manifest
 ↓
Device Sync
 ↓
Download
 ↓
Validate
 ↓
Activate
```

- [ ] Sync inicia
- [ ] Assets descarregados
- [ ] SHA-256 validado
- [ ] Manifest preparado
- [ ] Activação atómica
- [ ] Playback actualizado

**Resultado:** `________`

## E2E-027 — Failed Asset / No Partial Activation

Provocar falha em pelo menos um asset.

Esperado:

```text
Asset failure
      ↓
NO ACTIVATION
      ↓
Previous valid manifest remains active
```

- [ ] Activação abortada
- [ ] Playlist anterior continua activa
- [ ] Manifest anterior intacto
- [ ] GC não remove assets necessários
- [ ] Retry posterior funciona

**Resultado:** `________`

## E2E-028 — Recovery Sync

- [ ] Falha inicial
- [ ] Retry
- [ ] Asset recuperado
- [ ] Manifest completo
- [ ] Activação concluída
- [ ] Playback actualizado

**Resultado:** `________`

---

# GATE 8 — Runtime / Playback

## E2E-029 — Image Playback

- [ ] Imagem aparece
- [ ] Duration correcta
- [ ] Avanço correcto

**Resultado:** `________`

## E2E-030 — Video Playback

- [ ] Vídeo reproduz
- [ ] Natural duration
- [ ] Override duration
- [ ] Erro tratado
- [ ] Próximo item reproduz

**Resultado:** `________`

## E2E-031 — Cursor Idle

- [ ] Cursor inicia oculto
- [ ] Pointer/mouse input mostra cursor
- [ ] Keyboard input mostra cursor quando disponível
- [ ] Touch input mostra cursor quando aplicável
- [ ] ~3s idle oculta cursor
- [ ] Sem interferência no playback

**Resultado:** `________`

## E2E-032 — Presence

- [ ] Heartbeat
- [ ] ONLINE
- [ ] AWAY/INSTÁVEL
- [ ] OFFLINE
- [ ] Recuperação

**Resultado:** `________`

---

# GATE 9 — Offline / Recovery

## E2E-033 — Offline Playback

```text
ONLINE
 ↓
SYNC COMPLETE
 ↓
NETWORK OFF
 ↓
PLAYBACK
```

- [ ] Último manifest válido permanece activo
- [ ] Assets locais reproduzem
- [ ] Playback não depende de servidor

**Resultado (2026-09-21, por plataforma):**

| Plataforma | Resultado | Fundamento |
|---|---|---|
| Android físico — playback com rede desligada | `PASS` | Declaração do operador nesta consolidação. Log, duração e screenshot: `NOT DOCUMENTED` |
| Emulador | `PASS (software)` | Já registado em `HARDWARE-VALIDATION-REPORT.md`. Não conta como telemóvel nem como Box |
| Hisense / Sraf | `NOT TESTED` | O player v0.1.16 não guarda os ficheiros no aparelho. Ver nota de plataforma |
| Android TV Box | `NOT TESTED — HARDWARE NOT AVAILABLE` | Sem Box |

## E2E-034 — Offline Reload

- [ ] Rede desligada
- [ ] Reload
- [ ] Player inicia
- [ ] Conteúdo reproduz

**Resultado (2026-09-21, por plataforma):**

| Plataforma | Resultado | Fundamento |
|---|---|---|
| Android físico | `NOT TESTED` | Não há registo de reload da página sem rede no telemóvel |
| Emulador / CDP | `PASS (software)` | Reload offline do emulador em `HARDWARE-VALIDATION-REPORT.md`. Não fecha este item no hardware |
| Hisense / Sraf | `NOT TESTED` | Limitação conhecida do browser integrado |
| Android TV Box | `NOT TESTED — HARDWARE NOT AVAILABLE` | Sem Box |

## E2E-035 — Offline Reboot

- [ ] Rede desligada
- [ ] Reboot
- [ ] Cold start
- [ ] Player inicia
- [ ] Conteúdo reproduz

**Resultado:** `NOT TESTED`

O cold start do emulador em `HARDWARE-VALIDATION-REPORT.md` não é um reboot físico sem rede. Playback offline no telemóvel não prova este item. Hisense e Android TV Box também ficam `NOT TESTED`. Na Box, a razão é `NOT TESTED — HARDWARE NOT AVAILABLE`.

## E2E-036 — Recovery

- [ ] Rede restaurada
- [ ] Heartbeat recupera
- [ ] Device ONLINE
- [ ] Nova versão detectada
- [ ] Sync executado
- [ ] Manifest actualizado

**Resultado:** `________`

### Nota de plataforma

Hisense/VIDAA:

> `KNOWN PLATFORM LIMITATION` para offline após reload/reboot quando o browser integrado não fornece suporte suficientemente confiável.

Android TV Box + Chrome é o ambiente de referência para fechar este DoD físico.

---

# GATE 10 — Physical Hardware / HDMI

## E2E-037 — Android TV Box

Pré-condições:

- [ ] Android TV Box físico disponível
- [ ] HDMI ligado
- [ ] Display ligado
- [ ] ADB detectado
- [ ] Chrome disponível

Comando:

```bash
adb devices -l
```

- [ ] Device aparece
- [ ] Evidência arquivada

**Resultado:** `NOT TESTED — HARDWARE NOT AVAILABLE`

O telemóvel SM-A566B e a Hisense não preenchem este item.

## E2E-038 — Full Physical Flow

- [ ] Player
- [ ] Pairing
- [ ] Sync
- [ ] Playback
- [ ] Network OFF
- [ ] Offline playback
- [ ] Reboot
- [ ] Cold start
- [ ] Offline playback
- [ ] Network ON
- [ ] Heartbeat
- [ ] Sync
- [ ] Recovery

**Evidências:** `docs/evidence/hw-pending/` — 0 ficheiros de média.

**Resultado:** `NOT TESTED — HARDWARE NOT AVAILABLE`

## E2E-039 — Hardware Evidence Gate

Executar:

```bash
npm run hardware:evidence
```

- [ ] Exit 0
- [ ] Artefactos existentes
- [ ] Artefactos correspondem ao teste executado
- [ ] Não existem resultados físicos históricos não comprovados

**Resultado:** `NOT TESTED — HARDWARE NOT AVAILABLE` (`hardware:evidence` exit 2 enquanto `hw-pending/` não tiver média HDMI)

---

# GATE 11 — Vercel Deployment

## E2E-040 — Production Configuration

- [ ] Production environment correcto
- [ ] Turso production correcto
- [ ] R2 production correcto
- [ ] Secrets configurados
- [ ] `NEXT_PUBLIC_APP_URL` correcto
- [ ] Storage provider correcto
- [ ] Auth configurada

**Resultado:** `________`

## E2E-041 — Production Build

```bash
npm run typecheck
npm run lint
npm run build
```

- [ ] Typecheck PASS
- [ ] Lint PASS
- [ ] Build PASS

**Resultado:** `________`

## E2E-042 — Vercel Deployment

- [ ] Deployment criado
- [ ] Build Vercel PASS
- [ ] HTTPS activo
- [ ] Domain correcto
- [ ] `/player` acessível
- [ ] `/admin` acessível

**Resultado:** `________`

## E2E-043 — Production API Smoke Test

- [ ] Authentication
- [ ] Device API
- [ ] Pairing
- [ ] Bootstrap
- [ ] Sync
- [ ] Heartbeat
- [ ] Manifest
- [ ] Storage

**Resultado:** `________`

---

# GATE 12 — Production E2E Smoke

Criar um Device de teste na produção.

Executar:

```text
Vercel
 ↓
Admin
 ↓
Create Device
 ↓
Pair
 ↓
Create/Select Content
 ↓
Create Playlist
 ↓
Configure Distribution
 ↓
Manifest
 ↓
Sync
 ↓
Playback
```

- [ ] Device criado
- [ ] Pairing
- [ ] Content
- [ ] Playlist
- [ ] Distribution
- [ ] Manifest
- [ ] Sync
- [ ] Playback
- [ ] Heartbeat

**Resultado:** `________`

---

# GATE FINAL — Release Readiness

## E2E-044 — Final Gate

Todos os seguintes devem estar `PASS`:

| Gate | Resultado |
|---|---|
| Environment | |
| Device Creation | |
| Pairing | |
| Content / Media | |
| Playlist | |
| Distribution | |
| Manifest | |
| Sync | |
| Runtime | |
| Offline | |
| Physical Hardware | |
| Vercel | |
| Production Smoke | |

### Critério

```text
PASS
=
todos os gates obrigatórios PASS
+
evidência suficiente
+
nenhum FAIL aberto
+
nenhum BLOCKED crítico
```

Se existir um `BLOCKED`:

> O release não deve ser classificado como completamente validado.

Se existir `NOT TESTED`:

> O requisito permanece aberto.

---

# Release Decision

```text
[ ] RELEASE READY
[ ] RELEASE BLOCKED
[ ] NEEDS FURTHER VALIDATION
```

**Justificação:**

____________________________________________________

____________________________________________________

**Build/Commit:**

____________________________________________________

**Data:**

____________________________________________________

**Responsável:**

____________________________________________________

---

# Evidências

Todas as evidências físicas devem ser armazenadas em:

```text
docs/evidence/hw-pending/
```

Evidências esperadas podem incluir:

- screenshots;
- logs;
- ADB output;
- vídeos/fotos do HDMI quando necessários;
- resultados dos comandos;
- manifest/version;
- estado do Device;
- heartbeat;
- timestamps;
- resultado do `hardware:evidence`.

---

# Regra de certificação

Uma funcionalidade pode estar:

```text
IMPLEMENTED
```

sem estar:

```text
VALIDATED
```

Uma funcionalidade pode estar:

```text
SOFTWARE VALIDATED
```

sem estar:

```text
PHYSICAL VALIDATED
```

E:

```text
PHYSICAL VALIDATED
```

não implica automaticamente:

```text
PRODUCTION VALIDATED
```

A certificação E2E só ocorre quando cada fronteira crítica possuir evidência correspondente.
