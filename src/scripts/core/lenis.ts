/**
 * Smooth scroll, desktop only (phones keep native scrolling, as designed). One instance
 * for the whole visit, driven by GSAP's ticker so scroll position and tweens are never a
 * frame apart.
 *
 * Programmatic scrolling must go through scrollToY / scrollToTop here: window.scrollTo
 * fights Lenis's own idea of the position and can snap back.
 */
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap, ScrollTrigger } from './gsap';
import { isMobile } from './env';

let lenis: Lenis | null = null;

export function initLenis() {
  if (lenis || isMobile()) return;
  lenis = new Lenis({ duration: 1.2, wheelMultiplier: 0.9, smoothWheel: true, allowNestedScroll: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

export function stopScroll() {
  if (lenis) lenis.stop();
  else document.body.style.overflow = 'hidden';
}

export function startScroll() {
  if (lenis) lenis.start();
  else document.body.style.overflow = '';
}

export function scrollToTop({ immediate = false, duration = 1.6 } = {}) {
  if (lenis) lenis.scrollTo(0, { immediate, duration, force: true });
  else window.scrollTo({ top: 0, behavior: immediate ? 'instant' : 'smooth' });
}

export function scrollToY(y: number, duration = 1.4) {
  if (lenis) lenis.scrollTo(y, { duration });
  else window.scrollTo({ top: y, behavior: 'smooth' });
}

export function resizeScroll() {
  lenis?.resize();
}
