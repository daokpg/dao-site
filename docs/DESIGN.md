# Dao design laws

The rules the site was designed to. Read before changing copy, colour, type or motion.
Condensed from the design system that came out of Claude Design.

Dao is a sixteen-seat chef's table on Koh Phangan, led by Chef Nir Mesika. One communal
table, one arrival time, one fixed menu, wine pairing as the only drinks. The cooking is Thai
and Levantine: Nir's Israeli and Moroccan food made from Thai produce.

The name is Taoist, "the path". It is structure, not decoration: the site is shaped like a
progression and never explains that it is one. No 道 character, no philosophy quotes, no
yin-yang. The real argument for the communal table is biographical: Nir's grandmother raised
nine children and the older ones cooked for the younger. The shared table is how he was fed.

Each page answers three objections, in order: what is this, will I be uncomfortable, is it worth
the money. Nothing else is the job.

## Copy

- **Tone.** Warm, grounded, unhurried, humbly confident. A working restaurant talking, not a
  brand performing. Plain sentences that name the thing.
- **Person.** Mostly third person about Nir and the restaurant; second person for a decision the
  reader is making ("You will be seated with people you have not met"). "We" only where a
  person at the restaurant would say it.
- **Casing.** Sentence case everywhere. Uppercase only in the tracked 10px Inter metadata
  (corners, footers, button labels). Nothing is title-cased.
- **Punctuation.** No em dashes, anywhere. Numerals for facts (16 seats, 19:30, THB 3,900);
  words where a number is part of a sentence's rhythm ("sixteen-seat", "nine children").
- **Never:** emoji; eyebrows or kickers above a headline; balanced aphorisms with a reversal;
  poetic pointing instead of naming; course numbering; scarcity claims ("limited seats").
  Scarcity is shown on the booking page, night by night; a full night offers its waitlist.

## Colour

Two grounds, warm in both directions, and **no accent colour**. Colour enters only through
photography.

| | Light | Dark |
|---|---|---|
| Ground | `#F7F4EC` limewash paper | `#1C1A17` / `#15130F` charcoal |
| Ink | `#1A1815` (never `#000`) | `#EDE8DC` |

One ink at five alphas does everything else: secondary 70%, meta 45%, rules 16% (18% on dark).
Dark is narrative, not a preference: the site walks day into night the way a visit does.
Tokens: `src/styles/tokens/colors.css`.

## Type

Two families. **Season Mix** (Light 300) for display and headings, **Inter** for body, small
text and data. Serif tracking tightens with size (−2% at 56px+, −1% from 24 to 56). Inter is
never tracked except the 10px metadata at +22%. Tabular figures wherever digits align.
Running text stays near 65 characters. Tokens: `src/styles/tokens/typography.css`.

## Layout

12 columns, 24px gutter, 64px outer offset at a 1440 artboard (max width 1440, centred). Text
snaps to 4 to 7 columns; nothing runs the full 12. Photography may float free of the grid. One
deliberate grid break per page, an image, never type. No centred-column-by-default layouts, no
identical section anatomy repeating down a page. One breakpoint: 820px.

## Surfaces

- No cards, no shadows under content, no border-radius, no backdrop-blur panels. Content sits
  on the ground, separated by 1px hairlines.
- No images behind text except full photographs with a scrim, and every scrim is two layers:
  a flat 38% floor plus a vertical band. Type on a photograph is full-opacity cream.
- Every ground carries the paper grain (`.dao-paper`). It should be felt, not stared at.
- No icon set. None should be invented or pulled from a library. The only glyph is the `·`
  separator.

## Photography

Two temperatures, and a section uses one or the other, never both. Daylight is cooler and
documentary (territory, market, foraging, prep), sized smaller and gridded. Night service is
warm and low-light (candlelight, plating, the table), sized large, often full-bleed. Warm,
natural light, un-styled: no filters, no cool grading, no black and white.

## Motion

Slow, the expo-out family, nothing springs or bounces. Durations ladder by role: hover 0.75s,
chrome 1s, content reveals 1.25s, masked image reveals 2s, large image movement 3s. Staggers:
per character 0.005 to 0.02s, per element 0.035 to 0.1s.

The signature gestures are one physical idea reused:
- **The clipped reveal**: a frame opens from its bottom centre while the picture settles from a
  zoom (2s mask against a 3s settle).
- **In-frame parallax**: 10 to 15% of frame height, never past 20%.
- **The receding panel**: the outgoing section holds still and scales back while the next one
  moves over it. The same gesture is the page transition and the intro loader's exit.

Hover is colour and rule weight only. **Nothing lifts or translates upward on hover.**
