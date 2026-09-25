# Keyboard QA

Target: focused `InteractivePlayerDemo` root (`tabIndex={0}`).

| Key | Expected | Observed |
|-----|----------|----------|
| Space | Play / Pause | Implemented |
| ArrowRight | Next (or seek when Seek focused) | Implemented |
| ArrowLeft | Previous (or seek when Seek focused) | Implemented |
| M | Mute / Unmute | Implemented |
| F | Fullscreen toggle | Implemented |

Does not capture keys when focus is on native `input` / `textarea` / `select` outside the demo (handlers bound to demo root only).
