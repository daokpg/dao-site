/**
 * The trail (home). Desktop: the section pins and the track travels left 1:1 with the
 * scroll. One curve drives every frame: its distance from a line at 40% of the screen sets
 * its lift, how open it is and its zoom. The two sentences are the only thing on a clock:
 * they arrive when their hollow does and leave upward before the next frames land on them.
 * When the pin releases, the paper sheet turns to charcoal for the night half of the page.
 *
 * Phones: the trail runs vertically (styles/pages/home.css); frames open like any image
 * and the sentences move into the flow after their frames.
 */
import { gsap, ScrollTrigger } from '../core/gsap';
import { E, OPEN, isMobile, reducedMotion } from '../core/env';
import { setTone } from '../core/tone';
import { onResplit } from './reveal';
import type { System } from '../core/registry';

type Node = {
  el: HTMLElement; img: HTMLImageElement;
  r: number; rz: number; seen: boolean;
  side: number; off: number;
  clip: (v: string) => void; tf: (v: object) => void; y: (v: number) => void;
};
type State = { raf: number; timer: number; unsub: () => void; tweened: object[] };
let state: State | null = null;

function destroy() {
  if (!state) return;
  cancelAnimationFrame(state.raf);
  clearTimeout(state.timer);
  state.unsub();
  gsap.killTweensOf(state.tweened);
  state = null;
}

/** The sheet runs to charcoal after the trail; the nav follows. */
function setNight(scope: HTMLElement, dark: boolean) {
  const sheet = scope.querySelector<HTMLElement>('[data-sheet]');
  if (sheet) sheet.dataset.theme = dark ? 'dark' : 'light';
  setTone('dark', dark);
}

function mobile(scope: HTMLElement) {
  const frames = Array.from(scope.querySelectorAll<HTMLElement>('[data-tmask]'));
  const texts = Array.from(scope.querySelectorAll<HTMLElement>('[data-trail-text]'));
  if (texts[0] && frames[4]) frames[4].after(texts[0]);
  if (texts[1] && frames[7]) frames[7].after(texts[1]);
  frames.forEach((el, i) => {
    const dir = i % 2 ? 1 : -1;
    gsap.fromTo(el, { y: dir * 24 }, { y: -dir * 24, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  frames.forEach((el) => {
    const img = el.querySelector('img');
    if (reducedMotion) return void gsap.set(el, { clipPath: OPEN });
    gsap.set(img, { scale: 1.14 });
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => { gsap.to(el, { clipPath: OPEN, duration: 2, ease: E }); gsap.to(img, { scale: 1, duration: 3, ease: E }); } });
  });
  texts.forEach((el) => {
    const lines = el.querySelectorAll('[data-line-soft]');
    if (!lines.length) return;
    const show = () => { el.dataset.revealed = '1'; gsap.to(lines, { y: 0, opacity: 1, filter: 'blur(0px)', duration: reducedMotion ? 0 : 1.25, ease: E, stagger: reducedMotion ? 0 : 0.06 }); };
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: show });
  });
  ScrollTrigger.create({ trigger: scope.querySelector('[data-trail]'), start: 'bottom 60%', onEnter: () => setNight(scope, true), onLeaveBack: () => setNight(scope, false) });
}

function desktop(scope: HTMLElement, me: State) {
  const trail = scope.querySelector<HTMLElement>('[data-trail]')!;
  const track = scope.querySelector<HTMLElement>('[data-track]')!;
  // lift reaches 0.7 of the screen from the line; the opening runs over a full screen and
  // never closes below 30%, so a frame at the edge is still a picture
  const LINE = 0.4, REACH = 0.7, HOLD = 0.06, REACH_O = 1.0, FLOOR = 0.3;
  const still = reducedMotion;
  let blend = 0; // 0 = resting layout before the lock, 1 = the live wave

  const nodes: Node[] = Array.from(scope.querySelectorAll<HTMLElement>('[data-tmask]')).map((el) => {
    const img = el.querySelector('img')!;
    return {
      el, img, r: 0, rz: 0, seen: false,
      side: Number(el.dataset.side) || 1, off: Number(el.dataset.off) || 0,
      clip: gsap.quickSetter(el, 'clipPath') as (v: string) => void,
      tf: gsap.quickSetter(img, 'css') as (v: object) => void,
      y: gsap.quickSetter(el, 'y', 'px') as (v: number) => void,
    };
  });
  me.tweened = nodes;
  type Text = { el: HTMLElement; state: 'idle' | 'in' | 'out' };
  const texts: Text[] = Array.from(scope.querySelectorAll<HTMLElement>('[data-trail-text]')).map((el) => ({ el, state: 'idle' }));
  const linesOf = (t: Text) => t.el.querySelectorAll('[data-line-soft]');
  const setX = gsap.quickSetter(track, 'x', 'px') as (v: number) => void;

  let x1 = 0, x2 = 0, queued = false;
  const live = () => {
    if (queued) return;
    queued = true;
    me.raf = requestAnimationFrame(() => { queued = false; liveNow(); });
  };
  const liveNow = () => {
    setX(-(x1 + x2));
    const vw = window.innerWidth, vh = window.innerHeight;
    for (const n of nodes) {
      const r = n.el.getBoundingClientRect(), c = (r.left + r.width / 2) / vw, d = c - LINE, a = Math.min(1, Math.abs(d) / REACH);
      const wave = n.side * a * a * vh * 0.1;
      n.y((n.off * vh) / 100 + wave * blend);
      const t = Math.min(1, Math.max(0, (Math.abs(d) - HOLD) / (REACH_O - HOLD)));
      const oLive = FLOOR + (1 - FLOOR) * (1 - t * t * (3 - 2 * t));
      // before the lock every frame reads fully open; frames still approaching the line rest at their
      // live opening, so they only ever grow toward it; the blend applies to frames at or past the line
      const o = d > HOLD ? oLive : 1 - (1 - oLive) * blend;
      // entrance: the first time a frame is on screen it opens from its bottom centre, like every image on the site
      if (!n.seen) {
        if (x1 > 2 || still) { n.seen = true; n.r = 1; n.rz = 1; }
        else if (r.left < vw && r.top < vh && r.bottom > 0) {
          n.seen = true;
          gsap.to(n, { r: 1, duration: 2, ease: E, onUpdate: live });
          gsap.to(n, { rz: 1, duration: 3, ease: E, onUpdate: live });
        }
      }
      const insN = (0.5 - 0.5 * o) * 100 + 0.01, rv = n.r;
      const xl = (50 * (1 - rv)).toFixed(2), xr = (50 + 50 * rv).toFixed(2), yt = (100 - (100 - insN) * rv).toFixed(2), yb = (100 - insN * rv).toFixed(2);
      n.clip(`polygon(${xl}% ${yt}%,${xr}% ${yt}%,${xr}% ${yb}%,${xl}% ${yb}%)`);
      // in-frame parallax: the picture slides against the travel, up to 12% of frame width across the screen
      n.tf({ scale: 1 + 0.14 * (1 - o) + 0.18 * (1 - n.rz), xPercent: (c - 0.5) * -12 });
    }
    for (const t of texts) {
      const tr = t.el.getBoundingClientRect(), c = tr.left / vw, right = tr.right / vw;
      const lines = linesOf(t);
      const d = (s: number) => (still ? 0 : s);
      if (t.state === 'idle' && c < 0.8) { t.state = 'in'; t.el.dataset.revealed = '1'; gsap.to(lines, { y: 0, opacity: 1, filter: 'blur(0px)', duration: d(1.25), ease: E, stagger: d(0.06), overwrite: true }); }
      else if (t.state === 'in' && right < 0) { t.state = 'out'; gsap.to(lines, { y: -18, opacity: 0, filter: 'blur(6px)', duration: d(0.9), ease: E, stagger: d(0.04), overwrite: true }); }
      else if (t.state === 'out' && right > 0.04) { t.state = 'in'; gsap.to(lines, { y: 0, opacity: 1, filter: 'blur(0px)', duration: d(1), ease: E, stagger: d(0.04), overwrite: true }); }
      else if (t.state === 'in' && c > 1) { t.state = 'idle'; gsap.to(lines, { y: 14, opacity: 0, filter: 'blur(6px)', duration: d(0.6), ease: E, overwrite: true }); }
    }
  };

  // travel ends when the second-to-last frame reaches the line
  const lastN = nodes[nodes.length - 2].el;
  const dist = () => {
    const x = Number(gsap.getProperty(track, 'x')) || 0;
    const r = lastN.getBoundingClientRect();
    return Math.max(0, r.left + r.width / 2 - x - LINE * window.innerWidth);
  };
  ScrollTrigger.create({
    trigger: trail, start: 'top top', end: () => `+=${dist()}`, pin: true, pinSpacing: true, scrub: true, invalidateOnRefresh: true, refreshPriority: 10,
    onUpdate: (st) => {
      x1 = st.progress * dist();
      const b = Math.min(1, x1 / (window.innerWidth * 0.5));
      blend = b * b * (3 - 2 * b);
      live();
    },
    onLeave: () => setNight(scope, true),
    onEnterBack: () => setNight(scope, false),
  });
  ScrollTrigger.create({ trigger: trail, start: 'top bottom', end: 'top top', onUpdate: live, onEnter: live });
  // after the travel the curves carry on softly while the section scrolls away
  const spacer = trail.parentElement!; // the pin spacer ScrollTrigger just wrapped the trail in
  ScrollTrigger.create({ trigger: spacer, start: 'bottom bottom', end: 'bottom top', scrub: true, onUpdate: (st) => { x2 = st.progress * window.innerWidth * 0.35; live(); } });

  me.unsub = onResplit(live);
  me.timer = window.setTimeout(live, 450);
}

function after(scope: HTMLElement) {
  destroy();
  const me: State = (state = { raf: 0, timer: 0, unsub: () => {}, tweened: [] });
  if (isMobile()) mobile(scope);
  else desktop(scope, me);
}

export const system: System = {
  selector: '[data-trail]',
  after,
  destroy,
};
