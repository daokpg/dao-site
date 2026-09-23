/**
 * Entry point, loaded once per visit by src/layouts/Base.astro.
 *
 * Persistent chrome is bound here, once. Everything that belongs to a page goes through the
 * registry (core/registry.ts), which the transition layer runs on every page entry.
 */
import './core/gsap';
import { isMobile } from './core/env';
import { initLenis } from './core/lenis';
import { initTransitions } from './core/transition';
import { initSamePageLinks } from './core/links';
import { initMenu } from './chrome/menu';
import { initCursorMarquee } from './chrome/cursor-marquee';
import { initPressPulse } from './chrome/pulse';

initLenis();
initMenu();
initCursorMarquee();
initPressPulse();
initSamePageLinks();
initTransitions();

// Desktop and phone are two different layouts (the trail, smooth scroll); crossing the
// breakpoint rebuilds the page rather than trying to morph one into the other.
const wasMobile = isMobile();
let resizeT = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = window.setTimeout(() => {
    if (isMobile() !== wasMobile) location.reload();
  }, 200);
});
