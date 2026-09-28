# PLAYER-HOTFIX-01A
# REGRESSION PROVENANCE

## Current Commit
`7145adc6997ac8cb59eb06886f776b165db84ef0` (fix(player): fix GIF animation in web, fix Hisense video skipping)

## Baseline Commit
`214daa9445f1ed234b3dc04c51e0655c4d048d42` (fix: mount native videos with muted=true to prevent browser autoplay blocking)

## Changed Files
- `public/tv.js`
- `src/player/playback/playback-renderer-adapter.tsx`
*(Note: `src/player/playback/playback-controller.ts` was not modified in the current commit).*

## MEDIA-054

### HEAD^
FAIL (Expected 'ERROR', Actual 'PAUSED')

### HEAD
FAIL (Expected 'ERROR', Actual 'PAUSED')

## Provenance
PRE-EXISTING.
The test failure was introduced in commit `906ba73` ("fix: gracefully fallback to paused state instead of showing error overlay on autoplay block"), which occurred prior to `HEAD^`. It was NOT introduced by the current hotfix.

## Playback Contract
**Expected:** ERROR  
**Actual:** PAUSED  
The test expects the state machine to transition to `ERROR` upon receiving `MEDIA_PLAY_ERROR`, but the actual implementation now intercepts this code and gracefully forces `PAUSED`.

## Relevant History
```text
906ba73 fix: gracefully fallback to paused state instead of showing error overlay on autoplay block
```
In this commit, `playback-controller.ts` line 489 was changed to:
```typescript
    if (code === "MEDIA_PLAY_ERROR") {
      this.commit({ status: "PAUSED", error: null });
      return;
    }
```
This directly conflicts with `test-runtime-playback-05.ts` (`MEDIA-054`), which asserts `assert.equal(c.getState().status, "ERROR");`.

## Hotfix Interaction
The current hotfix (`7145adc`) strictly isolates modifications to the `Blob` MIME type casting (`image/gif`) in `playback-renderer-adapter.tsx` and the `muted` attribute assignment in `tv.js`. Neither change intersects with the controller's event state machine or triggers additional synthetic `MEDIA_PLAY_ERROR` events.

## Other Test Results
- `npm run typecheck`: PASS
- `npm run lint`: PASS (0 errors, 104 warnings)
- `npm run test:runtime-playback-*`: 6 out of 7 test suites PASS completely.

## Findings
CRITICAL: A formal state machine contract discrepancy exists between `PlaybackController` and `test-runtime-playback-05.ts`.
HIGH: N/A
MEDIUM: N/A
LOW: N/A
INFO: The current hotfix is fully cleared of introducing the `MEDIA-054` regression.

## Recommendation
Document this as a `PRE-EXISTING PLAYBACK CONTRACT ISSUE`.
The hotfix (`7145adc`) is safe and addresses actual device playback regressions. It should not be blocked by this pre-existing contract discrepancy.
A separate task (`PLAYBACK-CONTRACT-REMEDIATION`) must be scheduled to either update the `MEDIA-054` test expectations to `PAUSED` or refine the controller's state machine.

## VERDICT
[PLAYER-HOTFIX-01A PROVENANCE ESTABLISHED]
