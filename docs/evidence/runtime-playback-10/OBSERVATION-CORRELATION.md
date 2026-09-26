# OBSERVATION-CORRELATION

This document proves that Command Status and Playback Observation remain decoupled.

## 1. Domain Separation
- **CommandStatus**: Maintained in `device_command_inbox`. Sent by `CommandPoller`.
- **PlaybackObservation**: Maintained in `PlayerSessionStore` (derived from `PlaybackController`).

## 2. Correlation
We establish correlation through `CommandObservationCorrelation`, combining:
- The `CommandTimeline` (Queued, Delivered, Applied).
- A `CompactPlaybackObservation` taken *after* the command resolves.

## 3. No False Causal Claims
The UI is strictly designed to render:
- **Left Panel**: Command Applied (with timeline).
- **Right Panel**: Playback Observation (e.g., Status: PAUSED, Content: X).
- **Caveat**: "Observed after command (No strict causality claimed)".

This explicitly prevents the system from lying to the operator if an applied command causes an unexpected downstream error on the player.
