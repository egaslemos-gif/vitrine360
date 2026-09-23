# Android Physical Runtime Validation

Consolidation date: 2026-09-21.  
This document records evidence already on file plus the operator statement from that consolidation. It does not add a new test run.

## Objective

Validar o Vitrine360 em hardware Android físico (telemóvel), separado de Android TV Box e de HDMI.

## Environment

| Campo | Valor |
|---|---|
| Dispositivo | Telemóvel físico Samsung **SM-A566B**, série `RZGYC0CLGKE` |
| Características | `ro.build.characteristics=phone`, 1080×2340, registado em `docs/OBJECTIVE-STATUS.md` e `docs/HARDWARE-VALIDATION-REPORT.md` (recheck 2026-09-21 17:45) |
| Versão do Android | **NOT DOCUMENTED** |
| Browser | Chrome em `/player`. Versão do Chrome: **NOT DOCUMENTED** |
| Runtime | Android Physical Runtime. Não é Android TV Box |

## Production URL

`https://vitrine360-psi.vercel.app`

O USB E2E histórico usou túnel HTTPS de laboratório (`trycloudflare`) e `adb reverse` para `/player`. Esse túnel não substitui a URL de produção. A URL de produção acima está documentada em `docs/VERCEL-DEPLOYMENT-REPORT.md`.

## Tests

### Player

**PASS.** O telemóvel físico executou `/player`. O USB E2E V3 (`USB-E2E-V3`, código `303238`) chegou a sync e a actualização de playlist (`E2E UPDATE V3` / `PLAYLIST UPDATE OK - USB E2E V3`), com presença ONLINE e `manifestVersion` 3. Fonte: `docs/OBJECTIVE-STATUS.md`.

Os ficheiros `usb-e2e-v3-*.png` são citados nesse relatório. `docs/HARDWARE-VALIDATION-REPORT.md` regista que esses PNG não estão na árvore de trabalho. Não são tratados aqui como ficheiros presentes.

### Pairing

**PASS.** O mesmo USB E2E documenta pair → claim no telemóvel. Código de activação citado: `303238`.

### Playback

**PASS.** O fluxo documentado mostrou conteúdo após o sync (`HW Text Banner`, depois actualização de playlist). Em 2026-09-21 o operador confirmou que a renderização no Android físico não apresentava os defeitos vistos na Hisense.

### Offline Playback

**PASS**, por declaração do operador na consolidação de 2026-09-21: o telemóvel continuou a reproduzir com a rede desligada.

Log, duração e screenshot dessa sessão: **NOT DOCUMENTED**.

Isto não é o offline do emulador registado em `docs/HARDWARE-VALIDATION-REPORT.md`. Esse resultado continua a ser software / emulador.

### Offline Reload

**NOT TESTED** no telemóvel físico. Não há registo de recarregar a página sem rede.

### Offline Reboot

**NOT TESTED.** Não há registo de reinício físico do telemóvel sem rede. Playback offline não prova reboot.

### Recovery

**NOT TESTED** como recuperação depois de rede desligada. A actualização de playlist do USB E2E ocorreu com rede disponível.

## Evidence

- `docs/OBJECTIVE-STATUS.md` — SM-A566B, USB E2E V3, recheck ADB 2026-09-21.
- `docs/HARDWARE-VALIDATION-REPORT.md` — o telemóvel é proxy de software, explicitamente diferente da Box; PNGs citados ausentes da árvore.
- `docs/ACCEPTANCE.md` — `PHONE-HTTPS-V2` / `USB-E2E-V2`, classificados como software e diferentes do DoD HDMI.
- Declaração do operador, 2026-09-21 — playback físico correcto e offline playback no Android físico.

## Limitations

Android Physical Runtime não certifica Android TV Box + HDMI.

Não certifica display externo, boot de Box, kiosk no aparelho de sinalética, nem offline reboot.

## Conclusion

**ANDROID PHYSICAL RUNTIME — VALIDATED**

O veredito cobre player, pairing e playback no telemóvel SM-A566B, mais offline playback declarado pelo operador.

Não cobre offline reload, offline reboot, Android TV Box, HDMI, nem release.
