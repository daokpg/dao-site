/** What the home page's day section versions share (see ./index.ts). */
import { gsap, ScrollTrigger } from '../../core/gsap';
import { E, reducedMotion } from '../../core/env';
import { odometer } from '../../core/odometer';
import { setNight } from '../../core/tone';

export type Moment = { time: string; label: string; text: string };

/** Everything one start of the options leaves behind, undone in destroy. */
export type State = { tweened: Element[]; cleanups: (() => void)[] };

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** The moments, as each option's markup writes them into a JSON script tag. */
export const readMoments = (section: HTMLElement, sel: string): Moment[] => JSON.parse(section.querySelector(sel)?.textContent ?? '[]');

/**
 * A line of copy with two layers stacked in the same grid cell, so its box never changes size
 * while it changes: the outgoing layer leaves and the incoming one arrives, by rolling up inside the
 * mask (.jr-roll) or by a short fade (.jr-swap). A change arriving mid-way simply takes over.
 */
export type Swap = { a: HTMLElement; b: HTMLElement; front: HTMLElement; kind: 'roll' | 'fade' };

export function layered(el: HTMLElement | null, me: State): Swap | null {
  if (!el) return null;
  const a = el.firstElementChild as HTMLElement;
  const b = document.createElement('span');
  b.setAttribute('aria-hidden', 'true');
  el.append(b);
  me.tweened.push(a, b);
  me.cleanups.push(() => b.remove());
  const kind = el.classList.contains('jr-roll') ? 'roll' : 'fade';
  gsap.set(b, kind === 'roll' ? { yPercent: 110 } : { opacity: 0 });
  return { a, b, front: a, kind };
}

export function change(s: Swap | null, txt: string) {
  if (!s || s.front.textContent === txt) return;
  const out = s.front, inn = out === s.a ? s.b : s.a;
  gsap.killTweensOf([s.a, s.b]);
  inn.textContent = txt;
  s.front = inn;
  out.setAttribute('aria-hidden', 'true');
  inn.removeAttribute('aria-hidden');
  if (reducedMotion) {
    gsap.set(inn, { yPercent: 0, y: 0, opacity: 1 });
    gsap.set(out, s.kind === 'roll' ? { yPercent: 110 } : { opacity: 0 });
    return;
  }
  if (s.kind === 'roll') {
    gsap.to(out, { yPercent: -110, duration: 0.8, ease: 'expo.out' });
    gsap.fromTo(inn, { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'expo.out' });
  } else {
    gsap.to(out, { opacity: 0, y: -6, duration: 0.35, ease: 'power2.in' });
    gsap.fromTo(inn, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1, delay: 0.2, ease: E });
  }
}

/** The time, label and sentence of a layout, changing together. */
export function momentCopy(el: HTMLElement, prefix: string, list: Moment[], me: State) {
  const q = (k: string) => el.querySelector<HTMLElement>(`[data-${prefix}-${k}]`);
  const time = q('time') ? odometer(q('time')!) : null;
  const label = layered(q('label'), me);
  const text = layered(q('text'), me);
  me.cleanups.push(() => { time?.stop(); });
  let current = 0;
  return (i: number) => {
    if (i === current) return;
    const dir = i > current ? 1 : -1;
    current = i;
    time?.set(list[i].time, dir);
    change(label, list[i].label);
    change(text, list[i].text);
  };
}

/** The paper turns to charcoal once the section has passed, as the day section ends. */
export function nightAfter(section: HTMLElement, scope: HTMLElement) {
  ScrollTrigger.create({ trigger: section, start: 'bottom 60%', onEnter: () => setNight(scope, true), onLeaveBack: () => setNight(scope, false) });
}
