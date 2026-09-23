/**
 * The cursor pill. Over anything marked data-cursor-marquee-text (the reserve links), a
 * frosted pill follows the pointer with the next available date running through it.
 * Persistent chrome; it looks for targets under the pointer, so it works on every page
 * without being told about them. Not on touch screens.
 */
import { gsap } from '../core/gsap';
import { isCoarsePointer } from '../core/env';
import { getLenis } from '../core/lenis';

export function initCursorMarquee() {
  const cursor = document.querySelector<HTMLElement>('[data-cursor-marquee-status]');
  if (!cursor || isCoarsePointer()) return;
  const targets = cursor.querySelectorAll<HTMLElement>('[data-cursor-marquee-text-target]');
  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.4, ease: 'power3' });
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.4, ease: 'power3' });
  // snap onto the pointer before opening so the pill never appears mid-flight
  const xSet = gsap.quickSetter(cursor, 'x', 'px') as (v: number) => void;
  const ySet = gsap.quickSetter(cursor, 'y', 'px') as (v: number) => void;
  let pauseTimeout = 0, active: Element | null = null, lastX = 0, lastY = 0;
  // the pointer tip sits at the pill's top-left corner
  gsap.set(cursor, { xPercent: 0, yPercent: 0 });
  gsap.set(cursor.querySelector('.cm-card'), { x: 10, y: 10 });

  const playFor = (el: Element) => {
    clearTimeout(pauseTimeout);
    const text = el.getAttribute('data-cursor-marquee-text') || '';
    const sec = (text.length || 1) / 5;
    targets.forEach((t) => { t.textContent = text; t.style.animationPlayState = 'running'; t.style.animationDuration = `${sec}s`; });
    xSet(lastX);
    ySet(lastY);
    requestAnimationFrame(() => cursor.setAttribute('data-cursor-marquee-status', 'active'));
    active = el;
  };
  const pauseLater = () => {
    cursor.setAttribute('data-cursor-marquee-status', 'not-active');
    clearTimeout(pauseTimeout);
    pauseTimeout = window.setTimeout(() => targets.forEach((t) => { t.style.animationPlayState = 'paused'; }), 900);
    active = null;
  };
  const check = () => {
    const hit = document.elementFromPoint(lastX, lastY)?.closest('[data-cursor-marquee-text]') ?? null;
    if (hit !== active) {
      if (active) pauseLater();
      if (hit) playFor(hit);
    }
  };
  window.addEventListener('pointermove', (e) => { lastX = e.clientX; lastY = e.clientY; xTo(lastX); yTo(lastY); check(); }, { passive: true });
  window.addEventListener('scroll', () => { xTo(lastX); yTo(lastY); check(); }, { passive: true });
  getLenis()?.on('scroll', check);
  cursor.setAttribute('data-cursor-marquee-status', 'not-active');
}

/** Called when a page is swapped out from under the pointer. */
export function resetCursorMarquee() {
  document.querySelector('[data-cursor-marquee-status]')?.setAttribute('data-cursor-marquee-status', 'not-active');
}
