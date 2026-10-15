/**
 * The registry: the one place that knows what should be running on the page in view.
 *
 * A <script> inside a page runs once, on a real page load, and is dead after the first
 * transition. So all page behaviour lives here as systems, and the transition layer asks
 * the registry on every page entry.
 *
 * The contract every system keeps:
 *  1. It is keyed on a data attribute (`selector`), never on a class or a page name.
 *  2. If the page has the selector it is started, otherwise it is destroyed. Always both.
 *  3. It owns its state at module level and nulls it in destroy.
 *  4. Every document/window listener goes through one AbortController, aborted in destroy.
 *  5. Every observer, timer and requestAnimationFrame it starts is stopped in destroy.
 *  6. init calls destroy first, so it is safe to call twice.
 * ScrollTriggers are the exception to 5: the transition kills all of them on leave.
 *
 * Two moments:
 *  - before: the new page is in the DOM, in normal flow and untransformed, but still covered
 *    by the transition sheet. Split text, pre-hide, bind, create one-shot reveal triggers
 *    (so anything already in view starts revealing under the sheet, as designed).
 *  - after: the page has landed and every transform is cleared. Pins and scroll-scrubbed
 *    systems that must measure the final layout go here.
 */
import { ScrollTrigger } from './gsap';
import { resizeScroll } from './lenis';
import * as trailVariant from '../systems/trail-variant';
import * as journey from '../systems/journey/index';
import * as reveal from '../systems/reveal';
import * as sheetTone from '../systems/sheet-tone';
import * as recede from '../systems/recede';
import * as heroVideo from '../systems/hero-video';
import * as pressWall from '../systems/press-wall';
import * as faq from '../systems/faq';
import * as infoIndex from '../systems/info-index';
import * as eveningClock from '../systems/evening-clock';
import * as tastingMenu from '../systems/tasting-menu';
import * as booking from '../systems/booking';

export interface System {
  /** The page has this system when it contains an element matching this selector. */
  selector: string;
  before?: (scope: HTMLElement) => void;
  after?: (scope: HTMLElement) => void;
  destroy: () => void;
}

/** Order matters: reveal splits text before anything else measures it. */
const systems: System[] = [
  trailVariant.system, // must run first: removes the home day section's unused version
  reveal.system,
  sheetTone.system,
  heroVideo.system,
  recede.system,
  journey.system,
  pressWall.system,
  faq.system,
  infoIndex.system,
  eveningClock.system,
  tastingMenu.system,
  booking.system,
];

let scope: HTMLElement | null = null;
const has = (s: string) => !!scope?.querySelector(s);

export function runBefore(next: HTMLElement) {
  scope = next;
  for (const s of systems) {
    if (has(s.selector)) s.before?.(next);
    else s.destroy();
  }
}

export function runAfter(next: HTMLElement) {
  scope = next;
  for (const s of systems) if (has(s.selector)) s.after?.(next);
  resizeScroll();
  // triggers were created across two moments; a pin (refreshPriority) must measure before what follows it
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}

/** On leave, while the sheet covers the old page: every trigger, then every system. */
export function teardown() {
  for (const t of ScrollTrigger.getAll()) t.kill();
  for (const s of systems) s.destroy();
  scope = null;
}
