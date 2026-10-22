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
import { isMobile, reducedMotion } from './env';

let lenis: Lenis | null = null;

export function initLenis() {
  // phones scroll natively; with reduced motion, so does everything
  if (lenis || isMobile() || reducedMotion) return;
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

// with reduced motion every programmatic scroll is a jump, on desktop (Lenis) and phones alike
export function scrollToTop({ immediate = false, duration = 1.6 } = {}) {
  const jump = immediate || reducedMotion;
  if (lenis) lenis.scrollTo(0, { immediate: jump, duration, force: true });
  else window.scrollTo({ top: 0, behavior: jump ? 'instant' : 'smooth' });
}

/** Glide to y; a duration of 0 (or reduced motion) jumps. */
export function scrollToY(y: number, duration = 1.4) {
  const jump = duration === 0 || reducedMotion;
  // force: a page can ask before scrolling is switched back on after its entrance
  if (lenis) lenis.scrollTo(y, { duration, immediate: jump, force: true });
  else window.scrollTo({ top: y, behavior: jump ? 'instant' : 'smooth' });
}

export function resizeScroll() {
  lenis?.resize();
}
