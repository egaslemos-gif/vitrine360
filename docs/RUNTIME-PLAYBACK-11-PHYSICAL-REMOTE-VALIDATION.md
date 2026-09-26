# RUNTIME-PLAYBACK-11: PHYSICAL REMOTE VALIDATION

## Objective
Validar fisicamente o fluxo completo de Remote Control (SERVER → COMMAND INBOX → HTTP POLLING → HISENSE DEVICE RUNTIME → COMMAND DISPATCHER → PLAYBACK CONTROLLER → PLAYBACK STATE → ACTUAL DISPLAY → ACK → PLAYBACK OBSERVATION).
O objetivo é validar o comportamento real numa Hisense Smart TV (VIDAA, Sraf Open Browser).

## Important Safety Rules
- **VALIDATION ONLY**. No modifications to codebase, transport, polling cadence, or player logic allowed during this phase.
- If a test finds a defect: STOP. Record BUG FOUND. Do not fix silently.
- Chromium PASS + Unit Tests PASS ≠ PHYSICAL PASS.
- Any lack of evidence means the phase cannot be fully validated.

## Environment
Refer to `docs/evidence/runtime-playback-11/PRE-VALIDATION.md` for specific environment details prior to executing tests.

## Sub-Documents
- [PRE-VALIDATION.md](./evidence/runtime-playback-11/PRE-VALIDATION.md)
- [TEST-MATRIX.md](./evidence/runtime-playback-11/TEST-MATRIX.md)
- [COMMAND-EVIDENCE.md](./evidence/runtime-playback-11/COMMAND-EVIDENCE.md)
- [HISENSE-RESULTS.md](./evidence/runtime-playback-11/HISENSE-RESULTS.md)
- [NETWORK-RESULTS.md](./evidence/runtime-playback-11/NETWORK-RESULTS.md)
- [SECURITY-RESULTS.md](./evidence/runtime-playback-11/SECURITY-RESULTS.md)
- [PERFORMANCE-RESULTS.md](./evidence/runtime-playback-11/PERFORMANCE-RESULTS.md)
- [RELEASE-GATE.md](./evidence/runtime-playback-11/RELEASE-GATE.md)
