/**
 * The spine on phones: the moment above a row of photographs swiped sideways (native scrolling,
 * one card per swipe). As the finger moves, the card in view is full and its neighbours recede,
 * each picture drifting a little; the moment above follows the card in view. The five lines under
 * the row take you to a card; one marker over them moves with the finger, so it is never behind.
 */
import { ScrollTrigger } from '../../core/gsap';
import { reducedMotion } from '../../core/env';
import { setNight } from '../../core/tone';
import { momentCopy, revealIn, type Moment, type State } from './shared';

export function spineMobile(el: HTMLElement, list: Moment[], me: State, scope: HTMLElement) {
  const rail = el.querySelector<HTMLElement>('[data-ms-rail]')!;
  const cards = Array.from(el.querySelectorAll<HTMLElement>('[data-ms-card]'));
  const imgs = cards.map((c) => c.querySelector('img'));
  const dots = Array.from(el.querySelectorAll<HTMLButtonElement>('[data-ms-dot]'));
  const thumb = el.querySelector<HTMLElement>('[data-ms-thumb]');
  const setMoment = momentCopy(el, 'ms', list, me);
  // the cards in view; the rest wait off to the side
  revealIn(el.querySelector<HTMLElement>('[data-ms-copy]'), cards, (c) => c.getBoundingClientRect().left < window.innerWidth, me);
  const stepX = () => (cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 1);

  // the marker's step and width, measured once and again on resize (never mid-paint)
  let pitch = -1;
  const measureBar = () => {
    if (!thumb || !dots.length) return;
    const r = dots.map((d) => d.getBoundingClientRect());
    pitch = r.length > 1 ? r[1].left - r[0].left : 0;
    thumb.style.width = `${r[0].width}px`;
  };
  let frame = 0;
  const paint = () => {
    frame = 0;
    const f = rail.scrollLeft / stepX();
    cards.forEach((c, i) => {
      const d = Math.min(1, Math.abs(i - f));
      c.style.opacity = String(1 - 0.45 * d);
      c.style.transform = `scale(${(1 - 0.06 * d).toFixed(4)})`;
      const img = imgs[i];
      if (img && !reducedMotion) img.style.transform = `translate3d(${(Math.max(-1, Math.min(1, i - f)) * -9.5).toFixed(2)}%,0,0)`;
    });
    const i = Math.min(cards.length - 1, Math.max(0, Math.round(f)));
    if (thumb && dots.length) {
      if (pitch < 0) measureBar();
      thumb.style.transform = `translate3d(${(Math.max(0, Math.min(dots.length - 1, f)) * pitch).toFixed(2)}px,0,0)`;
    }
    setMoment(i);
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(paint); };
  const ac = new AbortController();
  rail.addEventListener('scroll', onScroll, { passive: true, signal: ac.signal });
  window.addEventListener('resize', () => { pitch = -1; onScroll(); }, { signal: ac.signal });
  dots.forEach((d, i) => d.addEventListener('click', () => rail.scrollTo({ left: i * stepX(), behavior: reducedMotion ? 'auto' : 'smooth' }), { signal: ac.signal }));
  me.cleanups.push(() => {
    ac.abort();
    cancelAnimationFrame(frame);
  });
  paint();

  // the paper turns to charcoal once the row has nearly left the screen
  ScrollTrigger.create({ trigger: el, start: 'bottom 25%', onEnter: () => setNight(scope, true), onLeaveBack: () => setNight(scope, false) });
}
