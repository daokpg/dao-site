/**
 * The spine on phones: the moment above a row of photographs swiped sideways (native scrolling,
 * one card per swipe). As the finger moves, the card in view is full and its neighbours recede,
 * each picture drifting a little; the moment above follows the card in view. The five lines under
 * the row show where you are and take you to a card.
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
  const setMoment = momentCopy(el, 'ms', list, me);
  revealIn(el.querySelector<HTMLElement>('[data-ms-copy]'), cards, me);
  const stepX = () => (cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 1);

  let frame = 0;
  const paint = () => {
    frame = 0;
    const f = rail.scrollLeft / stepX();
    cards.forEach((c, i) => {
      const d = Math.min(1, Math.abs(i - f));
      c.style.opacity = String(1 - 0.45 * d);
      c.style.transform = `scale(${(1 - 0.06 * d).toFixed(4)})`;
      const img = imgs[i];
      if (img && !reducedMotion) img.style.transform = `translate3d(${(Math.max(-1, Math.min(1, i - f)) * -5).toFixed(2)}%,0,0)`;
    });
    const i = Math.min(cards.length - 1, Math.max(0, Math.round(f)));
    dots.forEach((d, k) => d.toggleAttribute('data-on', k === i));
    setMoment(i);
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(paint); };
  const ac = new AbortController();
  rail.addEventListener('scroll', onScroll, { passive: true, signal: ac.signal });
  window.addEventListener('resize', onScroll, { signal: ac.signal });
  dots.forEach((d, i) => d.addEventListener('click', () => rail.scrollTo({ left: i * stepX(), behavior: reducedMotion ? 'auto' : 'smooth' }), { signal: ac.signal }));
  me.cleanups.push(() => {
    ac.abort();
    cancelAnimationFrame(frame);
  });
  paint();

  // the paper turns to charcoal once the row has nearly left the screen
  ScrollTrigger.create({ trigger: el, start: 'bottom 25%', onEnter: () => setNight(scope, true), onLeaveBack: () => setNight(scope, false) });
}
