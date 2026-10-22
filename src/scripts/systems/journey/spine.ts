/**
 * A, the spine: a column of photographs strung on a wave held to the screen. Each frame eases
 * toward the sideways offset the wave gives its height on screen, so the column bends as it passes
 * and settles a beat after the scroll stops; inside its frame each picture drifts a little against
 * the scroll. The moment beside it follows the frames as they rise past the lower middle of the
 * screen (the time rolls, label and sentence change in place) and fades as the last frame is
 * handed over to the evening section. Phones: ./spine-mobile.ts.
 */
import { gsap, ScrollTrigger } from '../../core/gsap';
import { isMobile, reducedMotion } from '../../core/env';
import { handoff } from './handoff';
import { clamp, momentCopy, readMoments, revealIn, type State } from './shared';
import { spineMobile } from './spine-mobile';

export function spine(section: HTMLElement, me: State, scope: HTMLElement) {
  const list = readMoments(section, '[data-spine-moments]');
  // phones have their own layout (the other one was removed before anything started, data-only)
  if (isMobile()) {
    const swipe = section.querySelector<HTMLElement>('[data-spine-swipe]');
    if (swipe) spineMobile(swipe, list, me, scope);
    return;
  }

  const axis = section.querySelector<HTMLElement>('[data-spine-axis]')!;
  const items = Array.from(section.querySelectorAll<HTMLElement>('[data-spine-item]'));
  const imgs = items.map((el) => el.querySelector('img'));
  const setMoment = momentCopy(section, 'spine', list, me);
  revealIn(section.querySelector<HTMLElement>('[data-spine-copy]'), items, me);

  let H = 0, A = 0, L = 1;
  // the wave, measured from the axis's top (the screen's top while the column passes)
  const offset = (y: number) => A * Math.sin((y / L) * Math.PI * 2 + Math.PI * 0.2);
  const measure = () => {
    H = window.innerHeight;
    A = axis.getBoundingClientRect().width * 0.1;
    L = H * 1.8;
  };

  // where each frame is, and where the wave wants it: frames ease toward their place
  const x = items.map(() => NaN);
  const step = (follow: number) => {
    const top = axis.getBoundingClientRect().top;
    let active = 0;
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const want = offset(mid - top);
      x[i] = Number.isNaN(x[i]) ? want : x[i] + (want - x[i]) * follow;
      el.style.transform = `translate3d(${x[i].toFixed(2)}px,0,0)`;
      const img = imgs[i];
      if (img && !reducedMotion) img.style.transform = `translate3d(0,${((0.5 - mid / H) * 6).toFixed(2)}%,0)`;
      if (r.top < H * 0.62) active = Number(el.dataset.moment);
    });
    setMoment(active);
  };

  // run on the ticker only while the column is on screen
  const tick = () => step(reducedMotion ? 1 : 0.09);
  let running = false;
  const run = (on: boolean) => {
    if (on === running) return;
    running = on;
    if (on) gsap.ticker.add(tick); else gsap.ticker.remove(tick);
  };
  me.cleanups.push(() => run(false));

  measure();
  step(1);
  ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: 'bottom top',
    onToggle: (st) => run(st.isActive),
    onRefresh: (st) => { measure(); step(1); run(st.isActive); },
  });

  // the moment beside the column bows out as the last photograph is lifted off, before its column ends
  const copy = section.querySelector<HTMLElement>('[data-spine-copy]');
  const last = items[items.length - 1];
  if (last) handoff(last, me, scope, { onProgress: (p) => { if (copy) copy.style.opacity = String(1 - clamp(p / 0.12)); } });
}
