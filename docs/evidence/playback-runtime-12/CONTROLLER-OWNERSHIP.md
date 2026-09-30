# CONTROLLER OWNERSHIP

**React Player**:
- O controller é instanciado em `display-engine.tsx`:
  ```ts
  const controllerRef = useRef<PlaybackController | null>(null);
  if (controllerRef.current == null) {
    controllerRef.current = new PlaybackController();
  }
  ```
- Esta instância é mantida na ref. Em React StrictMode (dev), as Refs sobrevivem ao remount, logo, há **uma única instância activa**.
- Múltiplas subscrições (`usePlaybackState(controller)`) ligam-se a este single source of truth.

**Legacy Player**:
- `playState` object (Singleton no scope do IIFE em `tv.js`).

**CONCLUSÃO**: Apenas uma instância de Controller por janela. ONE ACTIVE PLAYBACK SESSION, ONE ACTIVE CONTROLLER, ONE ACTIVE MEDIA OWNER.
