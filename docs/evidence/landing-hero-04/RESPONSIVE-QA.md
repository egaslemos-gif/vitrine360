# LANDING-HERO-04: Responsive QA

## Desktop QA

**1366 × 768 (Primary Target)**
- **Navbar:** Sticky and visible.
- **Breathing Room:** Small, intentional padding (`pt-12`) separates Navbar from Hero content. No excessive whitespace.
- **Player Structure:** 
  - Header spans the full width.
  - Media Viewport takes the maximum width (up to 42vw or 640px) and maintains 16:9 ratio. It feels large and dominant.
  - Controls are perfectly flushed against the bottom gradient of the Media container.
  - Playlist stacks under the Media.
- **Next Section:** `pb-16` padding allows the start of the "Capabilities" section to peek in naturally at the bottom of the viewport, inviting the user to scroll.

**1280 × 720 / 1440 × 900 / 1536 × 864**
- The Player card retains its stacked layout in the Hero section and a side-by-side layout in the Showcase section further down.
- Media scales fluidly within the grid column constraints. The aspect ratio is strictly maintained without revealing empty white background.

## Mobile QA

**375 × 812 / 390 × 844 (Phones)**
- Hero copy is stacked above the CTA.
- The Player falls below the text.
- Player is fully legible: single column layout means Header -> Media -> Playlist stack perfectly.
- No horizontal overflow.
- Playlist is fully visible and scrollable if necessary.

**768 × 1024 (Tablets)**
- Padding is proportionally reduced (`sm:pt-10 sm:pb-12`).
- The entire composition remains balanced. Player fits perfectly within the tablet viewport width.
