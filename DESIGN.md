---
name: Chris N Eddy's
description: A Hollywood smash-burger counter rendered as sign-painted ink on paper, and as its own neon after midnight.
colors:
  counter-red: "#e63027"
  counter-red-cta: "#d0281c"
  red-deep: "#b41d14"
  marquee-yellow: "#f5b82e"
  marquee-yellow-ink: "#ffd633"
  yellow-deep: "#e09e0e"
  butcher-paper: "#fff8e7"
  counter-cream: "#fff2c9"
  card-white: "#fffdf6"
  griddle-ink: "#1a1612"
  rule-line: "#e3d8bc"
  muted-ink: "#7a6f5e"
  ticket-green: "#2f6b43"
  neon-red: "#ff3b2f"
  sodium-gold: "#ffd53d"
  night-ground: "#0d0b09"
  night-card: "#171310"
  night-rule: "#2b2620"
  night-green: "#6fbe8b"
  map-paper: "#f4ecd8"
  map-water: "#bcd3dd"
typography:
  display:
    fontFamily: "Bowlby One, Impact, sans-serif"
    fontSize: "clamp(38px, 9vw, 88px)"
    fontWeight: 400
    lineHeight: 0.84
    letterSpacing: "1px"
  headline:
    fontFamily: "Bowlby One, Impact, sans-serif"
    fontSize: "clamp(23px, 4vw, 52px)"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "normal"
  title:
    fontFamily: "Bowlby One, Impact, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  body-lede:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(13px, 2.2vw, 24px)"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "9.5px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.16em"
  meta:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "clamp(12px, 1.4vw, 15px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.08em"
  button:
    fontFamily: "Bowlby One, Impact, sans-serif"
    fontSize: "clamp(12px, 1.6vw, 19px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.05em"
rounded:
  none: "0"
  stat: "20px"
  pill: "999px"
  sheet: "18px 18px 0 0"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "13px"
  gutter: "15px"
  lg: "22px"
  xl: "34px"
  gutter-desk: "44px"
  section-desk: "56px"
components:
  button-primary:
    backgroundColor: "{colors.marquee-yellow}"
    textColor: "{colors.griddle-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "13px 10px"
  button-primary-night:
    backgroundColor: "{colors.counter-red-cta}"
    textColor: "{colors.counter-cream}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "13px 10px"
  button-secondary:
    backgroundColor: "{colors.counter-cream}"
    textColor: "{colors.griddle-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "13px 10px"
  button-order:
    backgroundColor: "{colors.marquee-yellow}"
    textColor: "{colors.griddle-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "8px 11px"
  chip-topic:
    backgroundColor: "{colors.butcher-paper}"
    textColor: "{colors.muted-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  chip-topic-selected:
    backgroundColor: "{colors.counter-red-cta}"
    textColor: "{colors.counter-cream}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  status-pill:
    backgroundColor: "{colors.counter-cream}"
    textColor: "{colors.griddle-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.stat}"
    padding: "5px 9px"
  status-pill-closed:
    backgroundColor: "{colors.griddle-ink}"
    textColor: "{colors.counter-cream}"
    typography: "{typography.label}"
    rounded: "{rounded.stat}"
    padding: "5px 9px"
  card-location:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.griddle-ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.md}"
  input-ruled:
    backgroundColor: "transparent"
    textColor: "{colors.griddle-ink}"
    rounded: "{rounded.none}"
    padding: "8px 2px"
  tab:
    backgroundColor: "{colors.counter-red-cta}"
    textColor: "{colors.counter-cream}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "10px 4px"
---

# Design System: Chris N Eddy's

## 1. Overview

**Creative North Star: "The Counter at 2AM"**

This is one physical place rendered under two lights. By day it is a bright counter on Sunset Blvd: warm paper, spot-color red and yellow laid down flat, everything outlined in near-black ink like a sign someone painted by hand and a printer reproduced badly on purpose. After midnight the paper is taken away and the same room is lit only by its own signage. The ink borders go dark, the flat shadows are replaced by emitted glow, and red and gold become the only things in the room giving off light. This is not a light theme with a dark variant bolted on. It is one restaurant, twice, and the switch between them is the system's central idea.

The register is **brand**: design is the product here. The site exists to send a hungry person to the order button, and it earns that by being unmistakably a specific place rather than a generic food page. Density is high and deliberately unrefined. Type is oversized past the point of comfort, borders are thick enough to read as physical edges, and nothing is soft. The visual vocabulary is roadside and printed: halftone dot fields, hard offset shadows in ink, a marquee that never stops, oversized condensed-feeling display caps with a painted drop shadow behind them.

What this system explicitly rejects: the delivery-app aesthetic it links out to, with its rounded stock-photo cards and sterile grids. Corporate chain polish, regionless and committee-approved. Upscale-restaurant minimalism with thin serifs and stone neutrals. And the hipster craft-burger kit of kraft paper, chalkboards and distressed textures, which performs handmade instead of being loud.

**Key Characteristics:**
- Two complete palettes on a single `data-mode` attribute, day and 2AM, both first-class.
- Zero rounding by default. Sharp corners everywhere except pills and one status capsule.
- Shadows with no blur: solid ink offsets that read as printed registration, not lighting.
- Three typefaces with three non-overlapping jobs: Bowlby One shouts, Inter explains, JetBrains Mono annotates.
- Flat spot color. No gradients, no tints, no glass. A surface is one color.
- Every interactive element travels physically on press.

## 2. Colors: The Sign-Painter Palette

Four flat spot colors and a near-black, used the way a sign painter uses them: one color per surface, no blending, no gradients. Every value has a day cut and a 2AM cut, and several have a third contrast-corrected cut that exists purely so text can sit on them legally.

### Primary
- **Counter Red** (`#e63027`): the brand's display red. The hero panel, the nav bar by day, map pins, the accent on active location cards. This is a fill color, not a text color, and not a background for anything smaller than a headline.
- **Signal Red** (`#d0281c`): the same red taken one step deeper so cream text clears 4.5:1 on it. Every red that carries text uses this: the order button at night, the tab strip, section eyebrows, the focused input underline, selected topic chips. Both edges of the tab strip are ink rules, which is what makes the step down from Counter Red invisible.
- **Neon Red** (`#ff3b2f`): the 2AM red. Brighter and used as emitted light rather than as ink, driving every night-mode glow.

### Secondary
- **Marquee Yellow** (`#f5b82e`): the second spot color and the site's affirmative. Primary buttons by day, the tab indicator, the section-heading underline, freeway lines on the map, the marquee text on ink. Reserved by convention for price and for the primary action, so its meaning stays legible.
- **Marquee Yellow Ink** (`#ffd633`): a brighter cut used only when yellow must be *read as text* on Counter Red, where the fill yellow sits at 2.45:1.
- **Sodium Gold** (`#ffd53d`): the 2AM yellow, warmer and hotter. Carries eyebrows and the open indicator at night, where near-black can support it.

### Neutral
- **Butcher Paper** (`#fff8e7`): the day ground. Warm, slightly yellowed, never white.
- **Counter Cream** (`#fff2c9`): a deeper paper used for banded sections, secondary buttons, and as the text color on every red and ink surface, in both modes.
- **Card White** (`#fffdf6`): the lifted surface. The only near-white in the system, and it is still warm.
- **Griddle Ink** (`#1a1612`): every border, every shadow, every body glyph by day. Warm near-black, never `#000`.
- **Rule Line** (`#e3d8bc`): hairline dividers and inactive thumbnails on paper.
- **Muted Ink** (`#7a6f5e`): secondary and annotation text on paper.
- **Night Ground** (`#0d0b09`) / **Night Card** (`#171310`) / **Night Rule** (`#2b2620`): the 2AM stack. Card sits above ground by one step of lightness, and the rule is the only border color at night, because ink borders vanish against ink.

### Tertiary
- **Ticket Green** (`#2f6b43`) and **Night Green** (`#6fbe8b`): the one positive color in the system. Free shipping, the bag's free-shipping meter, the open indicator by day. Nowhere else.
- **Map Water** (`#bcd3dd`): the only non-brand hue on the site, used exclusively for the Pacific and the LA River on the locations map.

### Named Rules

**The Two Rooms Rule.** Every color decision must answer in both modes. A component that only works in day mode is unfinished. Day gets ink borders and hard shadows; night gets `--a-line` borders and glow. Never ship one without the other.

**The Fill-Is-Not-Text Rule.** Counter Red and Marquee Yellow are fill colors. When either must carry text, it is swapped for its contrast-corrected cut: Signal Red for red surfaces under text, Marquee Yellow Ink for yellow text on red. Using the display cut for a text surface is prohibited.

**The Reserved Meaning Rule.** Yellow means price and primary action. Green means free or open. Red means the brand. A color used decoratively outside its meaning weakens every other use of it.

## 3. Typography

**Display Font:** Bowlby One (with Impact, sans-serif)
**Body Font:** Inter (with system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono (with ui-monospace, monospace)

**Character:** Bowlby One is a fat, closed, uncompromising display face that only exists at one weight, which is the point: there is no dial to turn down. Inter carries every sentence that needs to be read rather than seen. JetBrains Mono handles anything that behaves like data, and its presence is what keeps the system from reading as pure poster: prices, hours, addresses, distances and map labels all look measured rather than shouted.

### Hierarchy
- **Display** (Bowlby One 400, 38px phone to 88px desktop, line-height 0.86 to 0.84, letter-spacing 0.4px to 1px): hero headline only, one per page. Carries a hard 3px to 6px ink text-shadow by day, which becomes a 22px to 44px red glow at night.
- **Headline** (Bowlby One 400, 23px to 52px, line-height 1 to 0.95): section titles. Always followed by the yellow underline that wipes out to 46px on scroll.
- **Title** (Bowlby One 400, 19px to 20px, line-height 1): location names, item sheet titles, card headings.
- **Body** (Inter 400, 14px, line-height 1.6): the document baseline. Prose is capped at 32ch in the hero lede and should not exceed 65ch to 75ch anywhere else.
- **Lede** (Inter 400, 13px phone to 24px desktop, line-height 1.45 to 1.4): the hero subtitle and shop introduction. The 24px desktop size is not decorative: it is the WCAG large-text threshold, which is what lets cream sit on Counter Red at 3:1.
- **Label** (JetBrains Mono 700, 9.5px to 13px, letter-spacing 0.16em to 0.2em, uppercase): eyebrows, field labels, status pills, chips, character counts. Always uppercase, always tracked out.
- **Meta** (JetBrains Mono 400, 12px to 15px, letter-spacing 0.08em): prices, addresses, hours, map annotations. Uses `font-variant-numeric: tabular-nums` wherever figures can change.

### Named Rules

**The Three Jobs Rule.** Bowlby One shouts, Inter explains, JetBrains Mono annotates. A typeface used outside its job is a bug. Never set a sentence in Bowlby One. Never set a price in Inter.

**The 16px Floor Rule.** Any input a user types into is 16px minimum, because iOS Safari zooms the viewport below that and never zooms back. Everything else on the page may be smaller.

**The One Shout Rule.** One Display-scale element per page. A second one is not emphasis, it is noise, and it makes the first one meaningless.

## 4. Elevation

Depth in this system is printed, not lit. Day shadows are solid ink offsets with **zero blur** and no transparency: a hard copy of the element's silhouette, displaced down and right, exactly as a two-pass print job registers slightly off. Size encodes importance, from a 2px offset on the nav order button through 4px on cards and buttons to 14px under the hero image on desktop. Borders do the same work: 1.5px on pills, 2px on thumbnails, 2.5px on cards and rows, 4px on desktop primary buttons and banded sections.

At night the metaphor inverts. Paper is gone, so an offset shadow has nothing to fall on. Ink borders are replaced by `#2b2620`, and elevation is carried by emitted light instead: `0 0 22px rgba(255, 59, 47, 0.45)` under a live element, up to `0 0 60px` around the hero image. The only blurred shadows in the entire system belong to genuinely floating layers: the lifted sticky header, the bag drawer, and the order dock.

### Shadow Vocabulary
- **Nudge** (`box-shadow: 2px 2px 0 #1a1612`): the nav order button and the bag button. Small, tight, always present.
- **Raised** (`box-shadow: 3px 3px 0 var(--a-ink)`): featured rows, selected chips, small cards.
- **Standard** (`box-shadow: 4px 4px 0 var(--a-ink)`): the default lifted surface. Location cards, primary buttons on phone, menu cards.
- **Anchor** (`box-shadow: 6px 6px 0 to 7px 7px 0 #1a1612`): the hero image, desktop buttons, desktop cards at rest.
- **Hover Extension** (`box-shadow: 10px 10px 0 to 12px 12px 0 #1a1612`, paired with `transform: translate(-2px, -2px)`): the element lifts away from the page and its shadow grows to match.
- **Night Glow** (`box-shadow: 0 0 22px rgba(255, 59, 47, 0.45)`, exposed as `--a-glow`): the 2AM replacement for every offset above.
- **Float** (`box-shadow: 0 5px 18px rgba(0, 0, 0, 0.3)`): reserved for genuinely overlaid layers. The lifted header, the drawer, the dock. Nothing else in the system is allowed blur.

### Named Rules

**The No-Blur Rule.** In day mode, `box-shadow` blur is zero and the color is the ink. A blurred grey drop shadow on a card is the single fastest way to make this site look like every other food site. If it looks soft, it is wrong.

**The Falling Rule.** Pressable elements sit above their shadow and fall into it. `:active` translates the element by the shadow's offset and shrinks the shadow to match, so the element ends flush with the page. This is why offsets and translate distances are always the same number.

**The Glow Is Night-Only Rule.** Emitted light belongs to 2AM. A glow in day mode reads as a mistake, and an offset shadow at night reads as a hole.

## 5. Components

### Buttons
- **Shape:** Square. Zero radius (`0`), no exceptions.
- **Primary:** Marquee Yellow fill, Griddle Ink text, Bowlby One uppercase at 12px phone / 19px desktop with 0.05em tracking, 2.5px ink border on phone and 4px on desktop, 13px 10px padding growing to 22px 34px. Shadow: Standard on phone, Anchor on desktop. At night it becomes Signal Red with cream text, a Neon Red border and a 22px to 34px red glow.
- **Secondary:** Counter Cream fill, ink text, otherwise identical geometry. At night it becomes Night Card with cream text and no shadow at all, because a secondary action should not emit light.
- **Hover:** `translate(-2px, -2px)` with the shadow extended to Hover Extension. **Active:** `translate(3px, 3px)` with the shadow crushed to 1px. The travel distance always equals the shadow delta.
- **Nav Order Button:** the miniature. Yellow fill, 11px display type, 2px border, Nudge shadow, 8px 11px padding. Its `:active` collapses the shadow to zero and moves the button 2px, so it lands flat on the nav.

### Chips
- **Style:** Pill (`999px`), 2px rule-colored border, transparent fill, JetBrains Mono 700 at 10.5px uppercase with 0.09em tracking, 8px 12px padding, muted ink text.
- **Selected:** fills with Signal Red, text goes cream, gains a Raised shadow, prepends a check glyph, and plays a 0.34s stamp animation that overshoots to 1.16 scale with a 3.5-degree rotation before settling. The rotation is the character: it lands like a rubber stamp, not like a toggle.
- **Status Pill:** the one rounded rectangle in the system (`20px`), Counter Cream on a 1.5px ink border, minimum 74px wide so the label can change through the day without the header reflowing. Carries a 6px pulsing dot: green when open, red when closed, deep red at last call.

### Cards / Containers
- **Corner Style:** Square (`0`).
- **Background:** Card White at rest, Counter Cream when live or featured, Night Card in 2AM.
- **Border:** 2.5px Griddle Ink, rising to 4px on desktop. Locations that have not opened yet use the same border `dashed` and drop their shadow entirely, so the difference between open and coming-soon is structural rather than a badge.
- **Shadow Strategy:** Standard at rest, Anchor on desktop, Hover Extension on hover. Selected cards switch their border and shadow to Counter Red rather than growing.
- **Internal Padding:** 13px on phone, 22px on desktop.
- **Nested cards are forbidden.** A card inside a card does not exist in this system.

### Inputs / Fields
- **Style:** No box. Each field is a single 2px ruled line under a transparent input, with an uppercase mono label above it. Inter at 16px, 8px 2px padding, zero radius.
- **Focus:** the 2px rule goes transparent and a 3px Signal Red underline wipes in from the left over 0.3s. The label above simultaneously shifts from muted ink to Signal Red. No outline, no glow, no box: the ruled line is the entire affordance.
- **Error:** the same underline stays at full width in Counter Red, with a 12px semibold message below it in Signal Red.
- The underline lives in its own wrapper element pinned to the input's bottom edge, so an error message appearing below does not drag the rule down with it.

### Navigation
- **Style:** a two-row sticky header. The top row is Counter Red by day and Night Ground at 2AM, with a 3px ink bottom rule, the status pill hard left, the order button hard right, and the wordmark absolutely centered on the row rather than flexed between them, so it does not drift as the pill's label changes.
- **Tab Strip:** below it, on Signal Red, full-width equal tabs in Bowlby One at 10px with 0.11em tracking. State is carried twice: a 4px Marquee Yellow indicator that slides on a `cubic-bezier(0.35, 1.3, 0.4, 1)` overshoot, and full opacity on the current label. At night idle tabs dim to 0.6; by day they do not dim at all, because the dim is what broke contrast on red.
- **Focus:** 3px Griddle Ink outline at 2px offset globally, switching to Marquee Yellow on dark surfaces.
- **Mobile:** identical structure. This system is phone-first and the desktop layout is the variant, not the reverse.

### Signature: The Halftone Field
Every red panel carries a dot field: `radial-gradient` at 1.15px to 1.5px, tiled at 9px to 14px, held at 0.16 to 0.18 opacity, absolutely positioned and `aria-hidden`. On the hero the dots are ink; on the marquee band they are yellow. This is the single texture in the system and it is what makes flat spot color read as printed rather than as a CSS background. At 2AM the dot opacity drops to zero, because a printed screen has nothing to reproduce in a dark room.

### Signature: The Section Underline
Every section heading carries a 4px Marquee Yellow bar that animates from 0 to 46px width over 0.7s when the section enters the viewport, 6px and 0.75s on desktop. It is the system's only entrance flourish that is not a fade, and it is applied uniformly, which is what makes it read as a rule of the page rather than as decoration.

## 6. Do's and Don'ts

### Do:
- **Do** answer both modes for every component. Day gets a Griddle Ink border and a zero-blur offset shadow; 2AM gets a `#2b2620` border and a red glow.
- **Do** use zero-blur ink shadows at the documented offsets (2 / 3 / 4 / 6 / 7 / 10 / 14px). Size means importance.
- **Do** make the travel distance on `:active` equal the shadow offset, so the element lands flat.
- **Do** swap Counter Red for Signal Red (`#d0281c`) the moment text sits on it, and Marquee Yellow for `#ffd633` the moment yellow becomes text on red.
- **Do** set every input at 16px minimum.
- **Do** keep Bowlby One for shouting, Inter for explaining, JetBrains Mono for annotating.
- **Do** use `tabular-nums` on any figure that changes: prices, counts, hours, distances.
- **Do** give every motion a `prefers-reduced-motion` exit. The site currently honors it for animation, hover transforms, parallax, the marquee and the map ring, and any new motion must join that block.
- **Do** carry state on two cues, not one. The tab strip uses an indicator and an opacity change; location cards use a border color and a shadow color.
- **Do** keep prose to 65ch to 75ch, and the hero lede to 32ch.

### Don't:
- **Don't** use a blurred or grey drop shadow in day mode. If it looks soft, it is wrong. Blur is reserved for the header, drawer and dock.
- **Don't** round corners. Square by default, `999px` for pills, `20px` for the status capsule, and nothing else.
- **Don't** introduce a gradient, a tint, a glass surface or a `backdrop-filter` as decoration. Surfaces are one flat color.
- **Don't** use `background-clip: text` with a gradient. The display face is already the emphasis.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on a card, row or callout. Use a full ink border, a Counter Cream fill, or nothing.
- **Don't** ship an identical card grid of icon plus heading plus paragraph. The featured row, the location card and the menu row are all deliberately different shapes.
- **Don't** nest a card inside a card.
- **Don't** reach for a modal. The site uses an item sheet, a bag drawer and inline expansion, in that order.
- **Don't** look like the delivery app the order button links to: rounded stock-photo cards, sterile grids, neutral grey chrome.
- **Don't** look like a corporate chain: regionless, committee-approved, safe.
- **Don't** look like an upscale minimalist restaurant: thin serifs, stone neutrals, acres of whitespace, reservation-first.
- **Don't** look like a hipster craft-burger shop: kraft paper textures, chalkboards, letterpress cliches, distressed overlays, the word "artisan".
- **Don't** use `#000` or `#fff`. Every neutral in this system is warmed toward the brand.
- **Don't** put a second Display-scale headline on a page.
- **Don't** use em dashes in interface copy.
