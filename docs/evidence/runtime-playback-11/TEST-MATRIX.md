# TEST MATRIX

| ID | Test | Expected | Actual | Evidence | Classification | Result |
|----|------|----------|--------|----------|----------------|--------|
| RP11-001 | PLAY | Command DELIVERED -> APPLIED. Physical playback plays. | | | PHYSICAL | [PENDING] |
| RP11-002 | PAUSE | Command DELIVERED -> APPLIED. Physical playback pauses. | | | PHYSICAL | [PENDING] |
| RP11-003 | NEXT | Command APPLIED. Next item shown. | | | PHYSICAL | [PENDING] |
| RP11-004 | PREVIOUS | Command APPLIED. Previous item shown. No duplicate transition. | | | PHYSICAL | [PENDING] |
| RP11-005 | STOP | PlaybackState STOPPED. Media stops. | | | PHYSICAL | [PENDING] |
| RP11-006 | RESTART | Current item restarts physically. | | | PHYSICAL | [PENDING] |
| RP11-007 | SEEK | Media position changes if supported. | | | PHYSICAL | [PENDING] |
| RP11-008 | VOLUME | Volume changes if observable/supported. | | | PHYSICAL | [PENDING] |
| RP11-009 | MUTE | Audio muted. Second command unmutes. | | | PHYSICAL | [PENDING] |
| RP11-010 | REPEAT | Repeat mode updates without semantic breakage. | | | PHYSICAL | [PENDING] |
| RP11-011 | DUPLICATE | Resent command yields DUPLICATE. Playback doesn't advance twice. | | | PHYSICAL/SERVER | [PENDING] |
| RP11-012 | EXPIRED | Wait past TTL. Status EXPIRED. No physical change. | | | PHYSICAL/SERVER | [PENDING] |
| RP11-013 | STALE_SESSION | Reload player (new session). Resend bound command. STALE_SESSION. | | | PHYSICAL/SERVER | [PENDING] |
| RP11-014 | OFFLINE_QUEUE | Disconnect network. Command QUEUED. Reconnect. Executed. | | | PHYSICAL/NETWORK | [PENDING] |
| RP11-015 | OFFLINE_EXPIRY| Disconnect network. Wait past TTL. Reconnect. EXPIRED. | | | PHYSICAL/NETWORK | [PENDING] |
| RP11-016 | ACK_LOSS | Block ACK. Redelivery yields DUPLICATE. Executed once. | | | PHYSICAL/SERVER | [PENDING] |
| RP11-017 | RELOAD | Reload player. New session. Old bound commands -> STALE_SESSION. | | | PHYSICAL/SERVER | [PENDING] |
| RP11-018 | REOPEN | Reopen Sraf browser. Player loads, heartbeat resumes, polling resumes. | | | PHYSICAL | [PENDING] |
| RP11-019 | NETWORK_INTERRUPTION | Brief offline. Presence handles it without assuming playback stopped. | | | PHYSICAL/NETWORK | [PENDING] |
| RP11-020 | PLAYBACK_RACE | Command during video play. No race conditions. | | | PHYSICAL | [PENDING] |
| RP11-021 | RAPID_NEXT | NEXT x3 sent rapidly. Verify execution order and final state. | | | PHYSICAL | [PENDING] |
| RP11-022 | RAPID_PLAY_PAUSE | PLAY, PAUSE, PLAY. Final state matches applied order. | | | PHYSICAL | [PENDING] |
| RP11-023 | COMMAND_OBSERVATION | UI claims "Observed after command", not strict causality. | | | BROWSER | [PENDING] |
| RP11-024 | PRESENCE_SEPARATION | ONLINE presence != command delivered. OFFLINE != dead queue. | | | SERVER | [PENDING] |
| RP11-025 | TENANT_ISOLATION | Cross-tenant commands DENIED. | | | SERVER | [PENDING] |
| RP11-026 | WRONG_DEVICE_ACK | ACK with wrong Device Bearer DENIED. | | | SERVER | [PENDING] |
| RP11-027 | COMMAND_ID_COLLISION | Same commandId, different device DENIED. | | | SERVER | [PENDING] |
| RP11-028 | SECRET_EXPOSURE | No secrets in command payload. | | | SERVER | [PENDING] |
| RP11-029 | CACHE | Polling endpoint returns `Cache-Control: no-store`. | | | NETWORK | [PENDING] |
| RP11-030 | POLLING_INTERVAL | Average polling interval ~5 seconds. | | | NETWORK | [PENDING] |

**Note**: All results are PENDING as physical execution is required.
