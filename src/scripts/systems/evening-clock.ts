/**
 * The evening page's clock and dusk.
 *
 * The clock is the hero: it sits centred at display size on a hidden placeholder
 * ([data-clock-hero]), then flies to the rail ([data-clock-target]) and shrinks as the hero
 * scrolls away, one gesture, like the mark in the home intro. While the moments scroll by
 * it runs from the hero time to the last moment's time, the rail names the light and the
 * moment in view, and the page runs from paper to charcoal. It all fades away at the footer.
 *
 * Dusk never mixes the ink: the ground eases to charcoal, the type holds dark until well
 * past the middle, then flips over a short band while dipping out and back, so no
 * grey-on-grey frame is ever held.
 */
import { gsap, ScrollTrigger } from '../core/gsap';
import { E, isMobile } from '../core/env';
import { setTone } from '../core/tone';
import type { System } from '../core/registry';
import { pad2 } from '../../lib/format';

type State = { timers: number[]; els: Element[] };
let state: State | null = null;

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmt = (m: number) => `${Math.floor(m / 60)}:${pad2(m % 60)}`;

function swapText(el: HTMLElement & { _txt?: string }, txt: string) {
  if (el._txt === txt) return;
  el._txt = txt;
  gsap.killTweensOf(el);
  gsap.to(el, {
    opacity: 0, filter: 'blur(4px)', y: -6, duration: 0.35, ease: 'power2.in',
    onComplete: () => {
      el.textContent = txt;
      gsap.fromTo(el, { opacity: 0, filter: 'blur(4px)', y: 6 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.9, ease: E });
    },
  });
}

function destroy() {
  if (!state) return;
  state.timers.forEach(clearTimeout);
  gsap.killTweensOf(state.els);
  document.body.style.backgroundColor = '';
  state = null;
}

const parts = (scope: HTMLElement) => ({
  clock: scope.querySelector<HTMLElement>('[data-clock]')!,
  hero: scope.querySelector<HTMLElement>('[data-clock-hero]')!,
  target: scope.querySelector<HTMLElement>('[data-clock-target]')!,
});

/** Document-space position of the placeholder (measured at whatever scroll we are at, so add it back). */
const docStart = (hero: HTMLElement) => {
  const r = hero.getBoundingClientRect();
  return { x: r.left, y: r.top + window.scrollY };
};

/** Seat the clock on its placeholder, hidden, before the page is uncovered. The entrance fades it in. */
function before(scope: HTMLElement) {
  destroy();
  const { clock, hero } = parts(scope);
  state = { timers: [], els: [clock] };
  const d = docStart(hero);
  gsap.set(clock, { x: d.x, y: d.y, opacity: 0, filter: 'blur(10px)' });
}

function after(scope: HTMLElement) {
  const me = state!;
  const { clock, hero, target } = parts(scope);
  const sheet = scope.querySelector<HTMLElement>('[data-sheet]')!;
  const rail = scope.querySelector<HTMLElement>('[data-rail]')!;
  const word = scope.querySelector<HTMLElement>('[data-rail-word]')!;
  const name = scope.querySelector<HTMLElement>('[data-rail-name]')!;
  const moments = Array.from(scope.querySelectorAll<HTMLElement>('[data-moment]'));
  me.els.push(rail, word, name, ...moments);

  // ---- the flight: placeholder to rail as the hero scrolls away
  const end = () => {
    const r = target.getBoundingClientRect(), h = hero.getBoundingClientRect();
    return { x: r.left, y: isMobile() ? 76 : 140, s: r.height / h.height };
  };
  // before the hero moves the clock is pinned to its placeholder, so it scrolls with the page like static type
  const seat = (st: ScrollTrigger) => {
    if (st.progress !== 0) return;
    const d = docStart(hero);
    gsap.set(clock, { x: d.x, y: d.y - window.scrollY });
  };
  const flight = gsap.fromTo(clock,
    { x: () => docStart(hero).x, y: () => docStart(hero).y, scale: 1 },
    {
      x: () => end().x, y: () => end().y, scale: () => end().s, ease: 'none', immediateRender: true,
      scrollTrigger: { trigger: scope.querySelector('[data-hero]'), start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true, onUpdate: seat, onRefresh: seat },
    });
  // layout can still settle after the first measure (fonts, grid); re-seat the clock on the placeholder
  const reseat = () => { flight.invalidate(); ScrollTrigger.refresh(); };
  me.timers.push(...[300, 900, 1600].map((ms) => window.setTimeout(reseat, ms)));

  // ---- the time: from the hero time to the last moment's time across the moments
  const from = toMin(clock.textContent ?? '19:30');
  const to = toMin(moments[moments.length - 1]?.dataset.time ?? '22:00');
  const light: { from: string; word: string }[] = JSON.parse(word.dataset.light ?? '[]');
  let lastTxt = '';
  ScrollTrigger.create({
    trigger: scope.querySelector('[data-moments]'), start: 'top 60%', end: 'bottom bottom', scrub: true,
    onUpdate: (st) => {
      const mins = from + Math.round(st.progress * (to - from));
      const t = fmt(mins);
      if (t !== lastTxt) { lastTxt = t; clock.textContent = t; }
      const w = [...light].reverse().find((l) => mins >= toMin(l.from))?.word ?? light[0]?.word;
      if (w && word.textContent !== w) swapText(word, w);
    },
  });

  // ---- gone at the footer
  let clockGone = false;
  ScrollTrigger.create({
    trigger: scope.querySelector('footer'), start: 'top 70%',
    onEnter: () => {
      clockGone = true;
      gsap.to(clock, { opacity: 0, filter: 'blur(6px)', duration: 1, ease: E });
      gsap.to(rail, { opacity: 0, y: -24, filter: 'blur(6px)', duration: 1, ease: E });
    },
    onLeaveBack: () => {
      clockGone = false;
      gsap.to(clock, { opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: E });
      gsap.to(rail, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: E });
    },
  });
  for (const m of moments) {
    ScrollTrigger.create({ trigger: m, start: 'top 55%', end: 'bottom 55%', onEnter: () => swapText(name, m.dataset.name ?? ''), onEnterBack: () => swapText(name, m.dataset.name ?? '') });
  }

  // ---- dusk: the sheet, the ink ladder and the rules run from paper to charcoal with the scroll
  // the two palettes come from the colour tokens (styles/tokens/colors.css); the ladders are the same as there
  const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const L = { bg: token('--paper'), ink: token('--ink-warm'), ink2: 'rgba(26,24,21,.7)', ink3: 'rgba(26,24,21,.45)', rule: 'rgba(26,24,21,.16)' };
  const D = { bg: token('--night'), ink: token('--cream'), ink2: 'rgba(237,232,220,.7)', ink3: 'rgba(237,232,220,.45)', rule: 'rgba(237,232,220,.18)' };
  let palette: typeof L | null = null;
  const bg = gsap.utils.interpolate(L.bg, D.bg);
  const clamp = gsap.utils.clamp(0, 1);
  // the ground eases to charcoal; the ink holds dark until the ground is well past the middle, then flips over a short band
  const inkT = (t: number) => clamp((t - 0.55) / 0.14);
  const fading = [...moments, rail, clock];
  let dark = false;
  ScrollTrigger.create({
    trigger: scope.querySelector('[data-moments]'), start: 'top 60%', end: 'bottom bottom', scrub: true,
    onUpdate: (st) => {
      // the light goes between 19:45 and 20:45
      const p = clamp((st.progress - 0.12) / 0.4), t = p * p * (3 - 2 * p), k = inkT(t);
      const ground = bg(t);
      sheet.style.backgroundColor = ground;
      sheet.style.setProperty('--sheet', ground);
      document.body.style.backgroundColor = ground;
      // the ink never mixes: it is dark or cream, swapped at the middle of the flip, and the type dips out and back through it
      const P = k < 0.5 ? L : D, a = 1 - Math.sin(k * Math.PI);
      // the ladder is written only when it flips, not every frame (each write restyles the whole sheet)
      if (P !== palette) {
        palette = P;
        sheet.style.setProperty('--ink', P.ink);
        sheet.style.setProperty('--ink-2', P.ink2);
        sheet.style.setProperty('--ink-3', P.ink3);
        sheet.style.setProperty('--rule', P.rule);
        clock.style.color = P.ink;
      }
      if (clockGone) return;
      for (const el of fading) {
        el.style.opacity = String(a);
        el.style.filter = a < 0.999 ? `blur(${((1 - a) * 6).toFixed(1)}px)` : 'blur(0px)';
      }
      const d = k > 0.5;
      if (d !== dark) {
        dark = d;
        sheet.setAttribute('data-theme', d ? 'dark' : 'light');
        setTone('dusk', d);
      }
    },
  });
}

export const system: System = {
  selector: '[data-clock]',
  before,
  after,
  destroy,
};
