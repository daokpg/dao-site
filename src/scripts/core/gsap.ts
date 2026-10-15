/**
 * The one animation library. Every tween and scroll-driven effect goes through GSAP so
 * there is one ticker and one kill path (see CLAUDE.md, "Motion rules").
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { E, MOTION_QUERY } from './env';

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: E });

// Reduced motion means the finished state: every tween lands at once. Scroll-scrubbed effects still
// follow the scroll (the visitor moves them), and the systems that loop on their own (the press
// wall, the hero video) stop themselves.
const rm = matchMedia(MOTION_QUERY);
const syncSpeed = () => gsap.globalTimeline.timeScale(rm.matches ? 1000 : 1);
syncSpeed();
rm.addEventListener?.('change', syncSpeed);

// The browser must never restore a scroll position into a page that is about to be swapped.
// ScrollTrigger re-applies whatever mode it saw at startup on every refresh, so tell it too.
history.scrollRestoration = 'manual';
ScrollTrigger.clearScrollMemory('manual');

export { gsap, ScrollTrigger };
