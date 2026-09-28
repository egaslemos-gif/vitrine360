# LANDING-HERO-12: Playlist Height

Because the Player's total height is now dictated by the Reader (`~316px`), the Playlist (`~314px`) sits gracefully aligned within the internal Player grid without being forcibly stretched. 

Since `lg:self-center` was applied in a previous step, the 2px height difference is handled seamlessly by centering the Playlist block alongside the Reader.

No `flex-1`, `height: 100%`, or `min-height: 100%` is applied to the Playlist. It retains its compact size while maintaining the `56px` item height for the 4 items, completely preventing desktop scrollbars while preserving tight visual density.
