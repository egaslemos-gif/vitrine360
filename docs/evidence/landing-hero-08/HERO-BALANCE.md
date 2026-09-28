# LANDING-HERO-08: Hero Balance

## Spatial Resolution
Previously, the Hero Copy column had a rigid, hardcoded vertical padding, which meant it either floated too high (leaving whitespace below) or sank too low if adjusted improperly.

## Flexbox Implementation
- Modified the Grid container: Swapped `items-start` for `lg:items-stretch`. This forces the Left Column container to dynamically equal the height of the Player Demo on the right.
- Modified the Left Column container: Wrapped the content in `flex flex-col`.
- **Capability Rail Alignment:** Replaced the rigid top margin on the Capability Rail with `lg:mt-auto`. 
- **The Result:** The Capability Rail is automatically pushed to the absolute bottom of the grid cell. Because the cell matches the Player's exact height, the Capability Rail forms a perfect horizontal baseline with the bottom edge of the Player. 

This completely eliminates unmanaged whitespace and creates a sophisticated, structured grid look typical of premium SaaS designs, without adding any artificial content blocks.
