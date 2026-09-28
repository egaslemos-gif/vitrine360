# STATE MACHINE

| Event              | Current State        | Result State | Recoverable     | Retry / Action                             |
|--------------------|----------------------|--------------|-----------------|--------------------------------------------|
| MEDIA_LOAD         | (any)                | LOADING      | N/A             | Starts initialization                      |
| MEDIA_READY        | LOADING              | PLAYING      | N/A             | Enters active playback                     |
| MEDIA_PLAY_ERROR   | PLAYING / LOADING    | PAUSED       | Yes             | Autoplay blocked; awaits USER `PLAY`       |
| MEDIA_ERROR        | PLAYING / LOADING    | ERROR        | Yes / No        | Pipeline broken; awaits USER `PLAY` (reload)|
| MEDIA_PAUSE        | PLAYING              | PAUSED       | N/A             | USER intentionally paused                  |
| MEDIA_ENDED        | PLAYING              | (Advances)   | N/A             | Moves to next item or ENDED                |
| PLAY               | PAUSED               | PLAYING      | N/A             | Un-pauses existing media element           |
| PLAY               | ERROR                | LOADING      | N/A             | Hard-reloads the media element             |
| STOP               | PLAYING / PAUSED     | STOPPED      | N/A             | Halts playback, resets to 0                |
| RESTART            | (any)                | LOADING      | N/A             | Hard-reloads from 0                        |
