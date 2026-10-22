/**
 * B, rows (desktop): each row's sideways place is a function of how far the page has scrolled
 * through the section, times the row's speed, wrapped at the width of one set so it goes round
 * without a seam. Nothing moves on its own, so the rows only ever travel with the scroll (and back
 * with it). The lower row is offset so that, travelling at its own pace, the evening section's
 * photograph arrives in the middle of the screen exactly as the hold ends; there it is lifted off and
 * grows into the evening photograph (./handoff.ts).
 *
 * Phones: two plain columns, the photographs fading in as they come (reveal.ts, data-block).
 */
import { ScrollTrigger } from '../../core/gsap';
import { isMobile } from '../../core/env';
import { handoff } from './handoff';
import { nightAfter, type State } from './shared';

const SCROLL = 0.55; // px of travel per px of scroll

export function rows(section: HTMLElement, me: State, scope: HTMLElement) {
  // phones have plain columns (the rows were removed before anything started, data-only)
  if (isMobile()) {
    nightAfter(section, scope);
    return;
  }

  const list = Array.from(section.querySelectorAll<HTMLElement>('[data-rows-row]')).map((row) => ({
    row,
    track: row.querySelector<HTMLElement>('[data-rows-track]')!,
    speed: Number(row.dataset.speed) || 1,
    width: 0,
    end: 0, // the row's place when the hold ends
  }));
  // the tiles showing the evening section's photograph (both copies), and the row they are in
  const src = scope.querySelector('[data-trail-handoff] img')?.getAttribute('src');
  const tiles = src ? Array.from(section.querySelectorAll<HTMLImageElement>('[data-rows-track] img')).filter((im) => im.getAttribute('src') === src).map((im) => im.closest('li')!) : [];
  const home = list.find((l) => tiles[0] && l.row.contains(tiles[0]));
  const wrap = (x: number, w: number) => ((x % w) + w) % w - w; // into (-w, 0]

  // the scroll from the section entering the screen to the hold ending is the section's own height
  let total = 0;
  const measure = () => {
    total = section.offsetHeight;
    for (const l of list) {
      l.width = (l.track.firstElementChild as HTMLElement).offsetWidth;
      l.end = -(total * SCROLL * l.speed);
      if (l === home) {
        // the place that puts the first copy of the tile in the middle of the screen
        const t = l.track.getBoundingClientRect(), r = tiles[0].getBoundingClientRect();
        l.end = l.row.clientWidth / 2 - (r.left - t.left + r.width / 2);
      }
    }
  };
  const paint = (scrolled: number) => {
    for (const l of list) {
      if (!l.width) continue;
      const x = wrap(l.end + (total - scrolled) * SCROLL * l.speed, l.width);
      l.track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    }
  };
  const at = (st: ScrollTrigger) => Math.max(0, Math.min(total, st.scroll() - st.start));
  measure();
  paint(0);
  ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: 'bottom bottom',
    onUpdate: (st) => paint(at(st)),
    onRefresh: (st) => { measure(); paint(at(st)); },
  });

  // the tiles slide in from far off to the side, beyond where lazy loading looks: load them all
  // a screen before the section arrives, so none appears blank
  const imgs = Array.from(section.querySelectorAll<HTMLImageElement>('[data-rows-track] img'));
  ScrollTrigger.create({ trigger: section, start: 'top bottom+=100%', once: true, onEnter: () => imgs.forEach((im) => (im.loading = 'eager')) });

  // when the hold lets go, the tile in the middle is lifted off and carried into the evening section
  if (tiles.length) {
    const centred = () => tiles.reduce((a, b) => {
      const d = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - window.innerWidth / 2); };
      return d(b) < d(a) ? b : a;
    });
    handoff(centred, me, scope, { trigger: section, start: 'bottom bottom' });
  } else {
    nightAfter(section, scope);
  }
}
