/**
 * Press wall (home): three marks visible, the rest in rotation, one swap per beat, never
 * the same slot twice in a row. It only runs while on screen and while the tab is visible.
 * With reduced motion the first three simply stand.
 */
import { gsap, ScrollTrigger } from '../core/gsap';
import { reducedMotion } from '../core/env';
import type { System } from '../core/registry';

type State = { tl: gsap.core.Timeline; ac: AbortController; logos: Element[] };
let state: State | null = null;

function destroy() {
  if (!state) return;
  state.tl.kill();
  state.ac.abort();
  gsap.killTweensOf(state.logos);
  state = null;
}

function before(scope: HTMLElement) {
  destroy();
  const root = scope.querySelector<HTMLElement>('[data-press-wall]');
  if (!root) return;
  const slots = Array.from(root.querySelectorAll<HTMLElement>('[data-press-slot]'));
  const poolEl = root.querySelector('[data-press-pool]');
  const pool = Array.from(poolEl?.querySelectorAll('[data-press-logo]') ?? []);
  pool.forEach((n) => n.remove());
  const logos = [...slots.map((s) => s.querySelector('[data-press-logo]')!), ...pool];
  slots.forEach((s) => gsap.set(s.querySelector('[data-press-logo]'), { xPercent: -50, yPercent: -50 }));

  const ac = new AbortController();
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.8, paused: true });
  state = { tl, ac, logos };
  if (reducedMotion || !pool.length) return;

  let last = -1;
  const swap = () => {
    let i: number;
    do i = Math.floor(Math.random() * slots.length); while (i === last && slots.length > 1);
    last = i;
    const slot = slots[i], cur = slot.querySelector('[data-press-logo]'), next = pool.shift()!;
    gsap.set(next, { xPercent: -50, yPercent: 10, autoAlpha: 0, filter: 'blur(4px)' });
    slot.appendChild(next);
    if (cur) {
      gsap.to(cur, {
        xPercent: -50, yPercent: -110, autoAlpha: 0, filter: 'blur(4px)', duration: 1.1, ease: 'expo.inOut',
        onComplete: () => { cur.remove(); gsap.set(cur, { clearProps: 'transform,opacity,visibility,filter' }); pool.push(cur); },
      });
    }
    gsap.to(next, { xPercent: -50, yPercent: -50, autoAlpha: 1, filter: 'blur(0px)', duration: 1.1, ease: 'expo.inOut', delay: 0.1 });
  };
  tl.call(swap);

  let onScreen = false;
  const run = () => (onScreen && !document.hidden ? tl.play() : tl.pause());
  ScrollTrigger.create({
    trigger: root, start: 'top bottom', end: 'bottom top',
    onToggle: (st) => { onScreen = st.isActive; run(); },
  });
  document.addEventListener('visibilitychange', run, { signal: ac.signal });
}

export const system: System = {
  selector: '[data-press-wall]',
  before,
  destroy,
};
