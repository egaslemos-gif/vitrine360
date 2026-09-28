# LANDING-HERO-03: Pre-Implementation Audit

## Identification of Components and Layout Classes

### 1. Root Container
- **Component:** `LandingPage` main wrapper (`div`)
- **Classes:** `min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]`
- **Analysis:** Uses `min-h-screen` which is standard to ensure the page fills the viewport, but does not force the Hero specifically to be `100vh`.

### 2. Navbar
- **Component:** `header` element
- **Classes:** `sticky top-0 z-40 border-b border-black/[0.04] bg-white/70 backdrop-blur-md`
- **Height:** The inner container has `h-14` (56px).

### 3. Hero Section (`section`)
- **Component:** `section` element (first child of `main`)
- **Classes:** `relative overflow-hidden border-b border-[var(--color-border-subtle)] bg-gradient-to-b from-[#F8F8FB] to-white`
- **Inner Wrapper Container:** `div` with `relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-8 sm:gap-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-12 lg:py-24`
- **Analysis:** 
  - `lg:py-24` adds `96px` of padding at the top and bottom on desktop.
  - `sm:py-20` adds `80px` on tablets/small screens.
  - `gap-12` (48px) spacing between text and player on desktop.

### 4. Hero Text Group
- **Component:** Left side `div`
- **Classes:** `max-w-[520px]`
- **Eyebrow:** `mt-0` (implicit)
- **Headline:** `mt-2 sm:mt-3`
- **Description:** `mt-3 sm:mt-4`
- **CTA Group:** `mt-5 sm:mt-8`
- **Footer/Capability proof:** `mt-5 sm:mt-6`

### 5. Hero Player Container
- **Component:** Right side `div`
- **Classes:** `relative mx-auto w-full max-w-[640px] lg:mx-0 lg:ml-auto lg:max-w-[min(640px,42vw)]`
- **Inner Player Wrapper:** `relative rounded-[20px] ... p-1.5 sm:rounded-[24px] sm:p-2 ...`

## Diagnosis of Vertical Space Issues
1. **Excessive Top & Bottom Padding:** `lg:py-24` (96px) creates a large gap below the navbar and a large gap before the next section.
2. **Visual Floating:** The large paddings make the content seem "floating" in a tall section, not well-anchored to the navbar, and distant from the following "Capabilities" section.
3. **No `100vh` on Hero:** The excessive height is primarily due to large top/bottom paddings (`py-24`) combined with the content height, rather than a forced `h-screen` or `min-h-screen` on the `<section>` itself. 

## Action Plan
1. **Reduce Padding:** Change `lg:py-24` to something more compact like `pt-12 pb-16` or similar for desktop, creating asymmetric padding that anchors the hero closer to the navbar.
2. **Adjust Gap:** Tweak `sm:py-20` for tablets.
3. **Responsive Adjustments:** Ensure mobile spacing is also appropriate.
4. **Preserve Elements:** Maintain the grid structure (`grid-cols-[...]`) and max-widths.

Next step: Modify `src/features/marketing/landing-page.tsx`.
