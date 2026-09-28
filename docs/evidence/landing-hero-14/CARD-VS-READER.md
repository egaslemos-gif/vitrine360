# CARD VS READER

- **Reader Encapsulation:** The Reader is no longer flush against the player shell border. It is wrapped in a container with `p-2 sm:p-3 xl:p-4`, creating an elegant `12-16px` breathing room all around it.
- **Reader Independence:** Because the Reader wrapper has padding, the Reader Canvas now has its own `rounded-[10px]` and a subtle `border border-black/5` with a shadow. This separates the inner viewport clearly from the outer player shell.
- **Aspect Ratio Control:** The inner Reader canvas uses `aspect-video` (16:9). At a calculated width of ~350px (after padding), its height perfectly houses the media. 
- **Media Fit:** With `aspect-video` and `object-contain`, the media flawlessly fills the Reader space without clipping (as requested as an option if preservation of full content is paramount) and without black bars.
- **Controls Integration:** The Controls are absolute positioned within the 16:9 canvas, maintaining their position at the bottom of the active visual frame without adding vertical height to the Reader container.
