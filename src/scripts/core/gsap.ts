/**
 * The one animation library. Every tween and scroll-driven effect goes through GSAP so
 * there is one ticker and one kill path (see CLAUDE.md, "Motion rules").
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { E } from './env';

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: E });

// The browser must never restore a scroll position into a page that is about to be swapped.
// ScrollTrigger re-applies whatever mode it saw at startup on every refresh, so tell it too.
history.scrollRestoration = 'manual';
ScrollTrigger.clearScrollMemory('manual');

export { gsap, ScrollTrigger };
