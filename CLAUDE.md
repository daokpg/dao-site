# Dao site

Marketing site for Dao, a sixteen-seat chef's table on Koh Phangan. Four pages: `/`, `/story`,
`/evening`, `/reserve`. Static Astro, deployed on Cloudflare. Designed in Claude Design, then
ported here; from now on all work happens in this repo.

Read `docs/DESIGN.md` before touching copy, colour, type or motion.

## Commands

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static output in dist/
npm run preview   # serve dist/ locally
npm run check     # astro + TypeScript checks
```

## Deploy

Cloudflare Workers (static assets), Worker name `dao-design`, connected to this GitHub repo.
**A push to `main` deploys to production.** Work on a branch and merge when it is right.
`wrangler.jsonc` points Cloudflare at `dist/`; the Cloudflare build command must be
`npm run build` (deploy command `npx wrangler deploy`).

## Layout of the repo

```
src/
  pages/            one file per route; assembles sections, passes nothing but the page key
  layouts/Base.astro  <head>, persistent chrome, the Barba container (<main>)
  components/
    chrome/         nav, menu, footer, cursor pill, loader, transition sheet (shared by every page)
    ui/             small shared pieces: Cta, MaskImage, PressLogo, Letters
    home/ story/ evening/ reserve/   the sections of each page
  content/          ALL copy, images and numbers (see "Content" below)
  lib/              content getters, formatting, structured data, booking logic
  scripts/          all JavaScript (see "Motion" below)
  styles/
    tokens/         the design tokens (colour, type, spacing, grid, motion, texture, fonts)
    global.css      shared rules and the pre-hidden states
    chrome.css      nav, menu, pill, loader, transition sheet, footer
    pages/*.css     page-only rules, each scoped to [data-page="…"]
public/
  assets/photos/    photography (the crops live in content as object-position)
  assets/press/     publication marks (SVG, drawn in currentColor)
  fonts/            Season Mix (TRIAL files, see "Before launch")
docs/DESIGN.md      the design laws
```

## Content (and Sanity, later)

Every piece of copy, every image and its crop, prices, dates and contact details live in
`src/content/*.ts`, typed in `src/content/types.ts` and each page's interface. Components never
hold copy. Pages read content only through `src/lib/content.ts` (`getHome()`, `getSite()`, …).

Sanity is planned but not connected. When it is: define schemas matching these types, and turn
each getter in `src/lib/content.ts` into a query returning the same shape. Nothing else changes.
Prices are numbers (`site.pricing`) and are formatted with `money()`; booking sentences are
templates with `{tokens}` filled by `fill()`.

## Motion architecture

Stack: **Astro + Barba + GSAP (ScrollTrigger) + Lenis**. The site is multi-page, but Barba swaps
only the page container, so the document lives for the whole visit.

**Two zones.** Persistent chrome (nav, menu, cursor pill, loader, transition sheet) sits outside
`<main data-barba="container">` and is bound once in `src/scripts/app.ts`. Everything inside
`<main>` is swapped on navigation.

**The registry (`src/scripts/core/registry.ts`) is the one rule that matters.** A `<script>` in a
page or component runs once on a real load and is dead after the first transition. So every piece
of page behaviour is a *system* in `src/scripts/systems/`, listed in the registry, and started or
destroyed on every page entry. The contract, which every system keeps:

1. Keyed on a data attribute (`selector`), never a class or page name.
2. Page has it: start it. Page does not: destroy it. Always both.
3. State at module level, nulled in `destroy`.
4. Every `window`/`document` listener goes through one `AbortController`, aborted in `destroy`.
5. Every timer, observer and `requestAnimationFrame` is stopped in `destroy`.
6. `init` calls `destroy` first.

ScrollTriggers are the exception: the transition kills *all* of them on every leave.

Systems have two moments: `before` (page in the DOM, untransformed, still under the transition
sheet: split text, pre-hide, bind, one-shot reveal triggers) and `after` (landed, transforms
cleared: pins and scroll-scrubbed things that measure the final layout).

**Transition lifecycle** (`src/scripts/core/transition.ts`): leave (sheet up, next page's name
resolves) → afterLeave (teardown, hide old page, close menu, scroll to top) → beforeEnter (tone,
ground, registry `before`) → enter (name unwinds, sheet drops, page grows back, its entrance
starts) → afterEnter (registry `after`, scroll on). The first load runs the same steps in `once`.
Entrances per page are in `src/scripts/systems/entrance.ts`.

**To add behaviour to a page:** create `src/scripts/systems/thing.ts` exporting a `system`,
key it on a `data-*` attribute in the markup, add it to the list in `registry.ts`.

### Motion rules

- GSAP is the only animation library. No CSS transitions on properties GSAP also animates.
- Scroll programmatically only through `scrollToY` / `scrollToTop` in `core/lenis.ts`
  (`window.scrollTo` fights Lenis). Lenis runs on desktop only; phones scroll natively.
- Pre-hidden states live in CSS under `html.js` (set by an inline script in `<head>`), so the
  page reads finished without JS. JS takes things away and gives them back.
- Reduced motion means the finished state, not faster motion. Check `reducedMotion`
  (`core/env.ts`) in anything that animates.
- One breakpoint (820px). Crossing it reloads the page: desktop and phone are different layouts.
- Never leave an inline `transform` on `<main>`: it becomes the containing block for every
  `position: fixed` inside (the evening clock, the mobile ticket bar).

## CSS

Tokens first (`styles/tokens`), then `global.css`, `chrome.css`, then `styles/pages/*.css`.
**Page CSS must stay scoped** under `[data-page="…"]`: after one transition every page's CSS is
loaded together. Page sections still carry much of their styling inline (inherited from the
design export); the mobile layer overrides it with `!important` rules keyed on `data-*`
attributes, so keep those attributes when restyling. Do not use Astro scoped `<style>` for
anything JS creates at runtime (scoped rules never reach runtime-created nodes).

## Before launch (placeholders from the design phase)

- **Fonts**: `public/fonts/SeasonMixTRIAL-*.otf` are trial cuts; replace with licensed woff2.
- **Operational values** (prices, times, seat counts, deposit rule, availability, phone
  `+66 00 000 0000`) were invented for design and are not client-confirmed.
- **Photography** is a placeholder set.
- **Press**: publications and years are real; any quote must be pulled verbatim.
- **Booking** has no backend: "Hold the seats" only shows the confirmation (`src/lib/booking.ts`).

## Known quirks (kept on purpose, ask before "fixing")

These reproduce the shipped design exactly; each looks accidental:
- Phone menu: a later rule sets `align-items: start` on the menu list, so rows are not
  full-width taps despite the comment (`styles/chrome.css`, the two mobile blocks).
- Phone home page: the press wall stacks to one column (`styles/pages/home.css`).

## Verifying changes

Check computed values and rects, not only screenshots. After touching motion, do two or three
round trips between pages and confirm nothing grows: `ScrollTrigger.getAll().length` on arrival,
one `[data-barba="container"]`, one `.pin-spacer` on home (desktop), `document.body.style` clean.
A hidden or background browser tab throttles animation frames and will look "stuck"; that is the
environment, not the code.
