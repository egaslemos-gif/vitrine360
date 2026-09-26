# ADR: RUNTIME-PLAYBACK-010

## Title
Strict Separation of Command Status and Playback Observation for Remote Control.

## Context
When controlling a remote digital signage or kiosk device, the network is unreliable, and the device runtime can encounter errors. In previous or naive architectures, a successful API response to a remote command (e.g., `NEXT`) would immediately update the UI to show the next item playing. This creates false causal claims and confusing UX when the device fails to apply the change visually.

## Decision
We establish a strict separation between the **Command Domain** and the **Playback Domain**.
1. **Command Result**: Only indicates whether the command was successfully dispatched and parsed by the device's internal state machine.
2. **Playback Observation**: Is a snapshot of the actual renderer state, taken after the command resolves.
3. **Correlation**: The UI links these via `CommandObservationCorrelation`, displaying them side-by-side without asserting absolute causality (e.g., "Observed after command").

## Consequences
- **Positive**: Accurate telemetry and UX. If a command applies but the player errors out on the next media, the UI shows `APPLIED` + `ERROR`, instead of falsely reporting "Playing".
- **Positive**: Simple, isolated data models. `PlaybackState` does not need to store command histories.
- **Negative**: Increased UI complexity to show both states to operators. We mitigate this by providing reusable UI primitives (`CommandResultSummary`).
