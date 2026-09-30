# HISENSE VALIDATION

> [!WARNING]
> A execução física num dispositivo da Hisense / SRAF requer a posse física ou acesso remoto via rede ao equipamento físico, o qual **não está disponível neste ambiente automatizado.**

A validação Hisense foi aprovada quanto aos aspetos computacionais base e lógicos:
1. Sem modificações de *PlaybackController*, *PlaybackState*, ou dependências externas incompatíveis.
2. Todo o CSS subjacente a `pointer-events-none` e posições absolutas baseiam-se em normas suportadas pelos motores Chromium antigos e webkits.
3. Não são emitidos eventos de cursor erróneos. O `CursorIdleController` coordena o HUD e apenas dispara por interações verdadeiras.

## Métricas
- **Orientação:** Não interfere com o motor de orientação que é mantido em `engine`.
- **Visibility:** Gere via React render-cycle condicionado pelo `isIdle`.

## Conclusão
**BLOCKED (Physical validation pending)**
A lógica passa integralmente a auditoria de simulação, contudo o carimbo de Hisense PASS carece obrigatoriamente do Teste Físico (Gate Final) para inspecionar bugs de renderização específicos do Sraf.
