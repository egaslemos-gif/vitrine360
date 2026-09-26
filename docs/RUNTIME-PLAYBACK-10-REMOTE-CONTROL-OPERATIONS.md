# RUNTIME-PLAYBACK-10-REMOTE-CONTROL-OPERATIONS

## Overview
This document defines the operational foundation for Remote Control operations in the Vitrine360 architecture.

## Core Principle
**COMMAND STATUS ≠ PLAYBACK STATE.**

The separation is rigorous:
1. **Command Domain**: Responsible for intention, delivery, dispatch, and acknowledgement. The authority is the Command Inbox and the Command Dispatcher.
2. **Playback Domain**: Responsible for the actual playback state. The authority is the PlayerSession and PlaybackController.
3. **Observability Domain**: Responsible for correlating a command attempt with an observed state post-command.

## The Timeline
The lifecycle of a remote command follows these observable timestamps:
1. **Created**: The user enqueues the command.
2. **Queued**: The command waits in the Inbox.
3. **Delivered**: The Device polls and claims the command.
4. **Dispatched**: The Device executes the command on the PlaybackController.
5. **Applied**: The Dispatcher applies the command (terminal status).
6. **Observed**: A Playback Observation is captured after the command resolves.

## UI Primitives
Instead of a monolithic control center, remote operations use modular UI primitives:
- `CommandStatusBadge`: Renders states (QUEUED, DELIVERED, APPLIED, REJECTED, EXPIRED, DUPLICATE, STALE_SESSION).
- `CommandTimelineView`: Shows latency and progression.
- `CommandResultSummary`: Pairs the Command Status with the latest `CompactPlaybackObservation`.

## Important Rules
- A command that reaches `APPLIED` **does not guarantee** that the visual playback state changed exactly as requested (e.g. `NEXT` may hit the end of a playlist).
- Therefore, the UI states "Comando aplicado" alongside an independent "Estado observado: [STATUS]".
- We never rewrite the command status based on playback observations.
