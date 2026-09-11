# Product

## Register

brand

## Users

**Primary: the hungry local, deciding now.** On a phone, often late, frequently already on Sunset Blvd or within a fifteen minute drive of it. They are choosing between Chris N Eddy's and three other options in the same moment. They need three facts (is it open, what does it cost, where is it) and one button. They are not reading the site, they are scanning it.

**The first-timer.** Arrived from Instagram, a press list, or a friend. They do not yet know what a Chris N Eddy's slider actually is: two smashed patties, two slices of cheese, a buttered Martin's roll, every topping free. The site has to answer "what am I ordering and why does it matter" before it asks for the order.

**The repeat fan.** Already sold on the burger. Comes back for new locations, hours changes, merch drops, and the story. This is the audience the shop and the about page serve.

**Press, partners and catering.** Journalists, festival bookers, event organizers. They need credibility, facts and a way to reach a human, fast, and they should never have to hunt through a marketing page to find it. The contact form exists for them.

## Product Purpose

Send people to the order button.

The site's job is to convert attention into an online order at the Otter storefront, and everything else on it is in service of that: the menu exists so people know what to order, the locations page exists so they know which location is serving them, the story exists so they care enough to choose this burger over the one next to it, and the shop exists so the brand can travel past Sunset Blvd.

Success is a visitor who lands on any page, gets the fact they came for in under five seconds, and taps through to order without needing a second page. Failure is a beautiful page that sends nobody anywhere.

Because the register is **brand**, the design is not a neutral container for that goal. Being unmistakably a specific place on Sunset Blvd is the conversion mechanism, not decoration around it. A generic food site with the same information would convert worse.

## Brand Personality

**Loud, warm, unpretentious.**

A neighborhood burger shop with a big voice. The volume is hospitality, not exclusivity: this is a place that shouts a welcome across the room, not one that makes you feel lucky to be let in. Confident about the burger, never precious about it. Two friends, a flat-top, and no interest in explaining the concept.

The voice is direct and unhedged. Short sentences, real facts, no restaurant-marketing vocabulary. It says "every topping free" rather than "complimentary artisanal accompaniments." It never uses the words artisan, elevated, curated, journey or craft.

Emotionally the site should produce appetite first and recognition second. Being open when everything else has closed is part of the hospitality, and the site says so in words and hours rather than in a change of costume.

## Anti-references

**The delivery app.** DoorDash, Uber Eats, the Otter storefront itself. Rounded stock-photo cards, sterile grids, neutral grey chrome, everything interchangeable. The site links out to this and must not resemble it. If a screen could belong to any restaurant on the platform, it has failed.

**The corporate chain.** Shake Shack, Five Guys, McDonald's brand-system polish. Regionless, committee-approved, safe, optimized until nothing is left that anyone could object to or remember.

**The upscale minimalist restaurant.** Thin serifs, muted stone palettes, acres of whitespace, reservation-first architecture. Fine-dining cosplay. Nothing on this site should feel like it requires a booking.

**The hipster craft-burger shop.** Kraft paper textures, chalkboards, letterpress cliches, distressed overlays, the word "artisan." This lane performs handmade instead of being loud, and it is the closest trap to fall into by accident.

## Design Principles

**Never more than one tap from hungry to ordering.** An order path is present on every page and every viewport: the header button, the hero CTA, the sticky dock. Adding a step between a decision and the storefront is the most expensive thing this site can do.

**Only promise what a store can keep.** Hours, phone numbers and open-late claims are per-location facts, not brand copy. A number appears only where that store actually answers it, and a closing time appears only on the nights it is true. The site is allowed to be loud, and it is not allowed to be wrong.

**The product is the proof.** The burger, the price and the press quotes do the persuading. The site does not argue that the food is good, it shows the food and gets out of the way.

**Answer the scan, then reward the read.** Every page's top screen carries the three facts a scanner needs. Depth, story and detail live below that line for the people who want them. Neither audience is made to work for the other.

**Loud is not careless.** The volume is the brand; the precision underneath it is the craft. Oversized type, spot color and hard shadows sit on top of contrast ratios that pass, motion that respects reduced-motion, and copy that has been checked against the data. If a choice is loud and sloppy, it is the sloppiness that is off-brand.

## Accessibility & Inclusion

**Target: WCAG 2.2 AA.** This is already the working standard in the codebase and it is now the stated rule.

- **Contrast.** All text meets 4.5:1, or 3:1 where it qualifies as large text. The palette carries contrast-corrected variants specifically for this: a deeper red for any red surface under text, a brighter yellow for yellow set as text on red. The display cuts of red and yellow are fill colors and are never used as text backgrounds.
- **Motion.** Every animation, hover transform, parallax effect, marquee and scroll-driven reveal has a `prefers-reduced-motion: reduce` exit. New motion joins that block or it does not ship.
- **Keyboard.** Every interactive element is reachable and has a visible focus indicator: a 3px ink outline at 2px offset, switching to yellow where the surface is ink or red.
- **Color independence.** State is never carried by color alone. Open and closed differ by dot color and label text; the active tab differs by indicator position and opacity; a location that has not opened yet differs by border style, not by a colored badge.
- **Input handling.** Text inputs are 16px minimum so iOS Safari does not zoom on focus. Errors are announced with `aria-invalid` and `aria-describedby`, not signalled by color alone.
- **Content.** Decorative layers (halftone fields, separators, ornamental marks) are `aria-hidden`. Anything where an icon carries the meaning also carries visually hidden text.
