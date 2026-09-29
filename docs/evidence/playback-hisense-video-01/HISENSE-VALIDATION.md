# HISENSE VALIDATION

## Strategy
To be run by QA on the physical TV: `Hisense Smart TV 3B78`.
Using the DEV-only console logs added during implementation, testers will be able to observe the sequence of events and ensure that the `blob:` URL is no longer used when the TV is online.

## Expected Results
- **Direct URL**: The video src should now point to `/api/device/media/...` rather than `blob:https://...`.
- **Playback**: VIDEO physical visual and audio playback should be successful, and the playlist should not skip the item prematurely.
- **Diagnostics**: `[VIDEO-DIAG] play() resolved` should appear, confirming the native media backend accepted the byte-range request stream.
