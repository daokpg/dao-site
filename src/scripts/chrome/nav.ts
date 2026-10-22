/**
 * The nav steps out of the way. Persistent chrome: bound once for the whole visit.
 *
 * The nav has no ground of its own, so text scrolling under it would run through the mark and
 * the menu word. It slides up out of view while the page is scrolled down and comes back as soon
 * as the visitor scrolls up. It is always there at the very top, while the menu is open, and
 * whenever something in it has keyboard focus. On the evening page on phones it stays: the clock's band
 * under it is its ground there.
 *
 * One window scroll listener covers both cases: Lenis (desktop) moves the native scroll position,
 * and phones scroll natively. Reduced motion: the nav still hides and returns, without moving
 * (core/gsap.ts lands every tween at once).
 */
import { gsap } from '../core/gsap';
import { E, isMobile } from '../core/env';
import { isMenuOpen } from './menu';

/** Within this distance of the top the nav always shows. */
const TOP = 80;
/** Scroll travel in one direction before the nav reacts, so a trackpad tremor does nothing. */
const SLACK = 6;

let nav: HTMLElement | null = null;
let hidden = false;
let lastY = 0;
let anchorY = 0;

function set(hide: boolean) {
  if (!nav || hide === hidden) return;
  hidden = hide;
  gsap.to(nav, { yPercent: hide ? -100 : 0, duration: 1, ease: E, overwrite: 'auto' });
}

/** Bring the nav back now (the menu opening, a page change). */
export function showNav() {
  set(false);
  anchorY = lastY = window.scrollY;
}

/** A page whose top band gives the nav a ground (the evening page's clock bar on phones): the nav stays. */
const hasGround = () => isMobile() && !!document.querySelector('[data-barba="container"] [data-rail]');

function onScroll() {
  const y = window.scrollY;
  if (y <= TOP || isMenuOpen() || nav?.contains(document.activeElement) || hasGround()) {
    set(false);
    anchorY = lastY = y;
    return;
  }
  // a change of direction starts a new run of travel
  if ((y > lastY) !== (lastY > anchorY)) anchorY = lastY;
  lastY = y;
  if (y - anchorY > SLACK) set(true);
  else if (anchorY - y > SLACK) set(false);
}

export function initNav() {
  nav = document.querySelector<HTMLElement>('[data-nav]');
  if (!nav) return;
  lastY = anchorY = window.scrollY;
  window.addEventListener('scroll', onScroll, { passive: true });
  nav.addEventListener('focusin', showNav);
}
