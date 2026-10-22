/**
 * Reveal-on-scroll, declared in markup:
 *
 *   data-reveal-soft + data-split="softlines"  lines rise and sharpen one after another
 *   data-reveal-soft + data-split="none"       the element as one block
 *   data-reveal + data-split="lines"           lines slide up out of a mask (captions)
 *   data-block                                 a block, staggered in small waves
 *   data-mask                                  a frame opens from its bottom centre, the picture settles from a zoom
 *   data-parallax                              the picture drifts inside its frame with the scroll
 *
 * Every trigger fires once. Pre-hidden states live in global.css under html.js, so without
 * JS the finished text simply stands. With reduced motion everything is set to its finished state.
 */
import { gsap, ScrollTrigger } from '../core/gsap';
import { CLOSED, E, OPEN, reducedMotion } from '../core/env';
import { splitLines, splitSoftLines } from '../core/split';
import type { System } from '../core/registry';

type State = { ac: AbortController; timers: number[] };
let state: State | null = null;

function resplit(scope: HTMLElement) {
  scope.querySelectorAll<HTMLElement>('[data-split="softlines"]').forEach(splitSoftLines);
}

function openImage(el: Element, delay = 0) {
  gsap.to(el, { clipPath: OPEN, duration: 2, ease: E, delay });
  gsap.to(el.querySelector('img'), { scale: 1, duration: 3, ease: E, delay });
}

function destroy() {
  if (!state) return;
  state.ac.abort();
  state.timers.forEach(clearTimeout);
  state = null;
}

function before(scope: HTMLElement) {
  destroy();
  const ac = new AbortController();
  state = { ac, timers: [] };
  const qa = <T extends Element = HTMLElement>(s: string) => Array.from(scope.querySelectorAll<T>(s));
  const still = reducedMotion;

  if (still) qa('[data-reveal-soft]').forEach((el) => (el.dataset.revealed = '1'));
  qa('[data-split="lines"]').forEach(splitLines);
  qa('[data-split="softlines"]').forEach(splitSoftLines);

  const [group, step] = (scope.dataset.blockRhythm ?? '4 0.08').split(' ').map(Number);
  const done = { y: 0, opacity: 1, filter: 'blur(0px)' };

  qa('[data-block]').forEach((el, i) => {
    if (still) return void gsap.set(el, done);
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(el, { ...done, duration: 1.25, ease: E, delay: (i % group) * step }) });
  });

  qa('[data-split="none"]').forEach((el) => {
    if (still) return void gsap.set(el, done);
    gsap.set(el, { opacity: 0, y: 18, filter: 'blur(8px)' });
    // elements at the very foot of the page can never cross the 88% line, so they fire as soon as they enter
    const last = el.closest('footer') && !el.nextElementSibling;
    ScrollTrigger.create({ trigger: el, start: last ? 'top bottom' : 'top 88%', once: true, onEnter: () => gsap.to(el, { ...done, duration: 1.25, ease: E }) });
  });

  if (!still) {
    qa('[data-reveal-soft]').forEach((el) => {
      if (!el.querySelector('[data-line-soft]')) return;
      ScrollTrigger.create({
        trigger: el, start: 'top 85%', once: true,
        onEnter: () => {
          el.dataset.revealed = '1';
          gsap.to(el.querySelectorAll('[data-line-soft]'), { ...done, duration: 1.25, ease: E, stagger: 0.06 });
        },
      });
    });
  }

  qa('[data-reveal]').forEach((el) => {
    const lines = el.querySelectorAll('[data-line-inner]');
    if (!lines.length) return;
    if (still) return void gsap.set(lines, { yPercent: 0, y: 0 });
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(lines, { yPercent: 0, y: 0, duration: 1.25, ease: E, stagger: 0.08, overwrite: true }) });
  });

  qa('[data-mask]').forEach((el) => {
    const img = el.querySelector('img');
    if (still) {
      gsap.set(el, { clipPath: OPEN });
      if (img) gsap.set(img, { scale: 1 });
      return;
    }
    gsap.set(el, { clipPath: CLOSED });
    if (img) gsap.set(img, { scale: 1.18 });
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => openImage(el) });
  });

  if (!still) {
    qa('[data-parallax] img').forEach((img) => {
      gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: (img.closest('picture') ?? img).parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  // Lines are only right for the width and fonts they were measured at.
  let t = 0;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = window.setTimeout(() => {
      resplit(scope);
      ScrollTrigger.refresh();
    }, 200);
  }, { signal: ac.signal });
  document.fonts?.ready.then(() => {
    if (ac.signal.aborted) return;
    resplit(scope);
    ScrollTrigger.refresh();
  });
  // late layout settles (images without dimensions, a slow font face)
  state.timers.push(window.setTimeout(() => resplit(scope), 900), window.setTimeout(() => ScrollTrigger.refresh(), 400));
}

export const system: System = {
  selector: '[data-split], [data-block], [data-mask]',
  before,
  destroy,
};
