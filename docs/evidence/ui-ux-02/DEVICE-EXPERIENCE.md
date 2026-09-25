# UI/UX-02 — Device Experience

## Device detail (`/admin/devices/[id]`)

- Live / Current state preview + presence / playback status from observability  
- Device information grid  
- Runtime & diagnostics (`DeviceObservabilityPanel`)  
- Actions (list / configure stub / diagnóstico)

## Device Control concept

`src/features/devices/device-control-concept.tsx`

- Disabled transport controls  
- Coming soon badge  
- Non-operational progress / volume  
- Explicit copy: RUNTIME-PLAYBACK-01 owns remote commands  

**Device Control visual ≠ Remote Command implementation.**
