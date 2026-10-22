/**
 * The info page's topic index: choosing a topic glides there (through Lenis, core/lenis.ts) and
 * moves focus to its heading; the topic being read is marked in the index (aria-current). An
 * address naming a topic (/info#booking-and-paying, also after a page change) lands on it. Topics
 * stop at their scroll-margin-top (styles/pages/info.css), so the nav never covers their name.
 * Without JS the links are plain anchors. Barba leaves them alone (data-barba-prevent).
 */
import { scrollToY } from '../core/lenis';
import type { System } from '../core/registry';

let ac: AbortController | null = null;
let io: IntersectionObserver | null = null;

function destroy() {
  ac?.abort();
  ac = null;
  io?.disconnect();
  io = null;
}

const topOf = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);

function before(scope: HTMLElement) {
  destroy();
  ac = new AbortController();
  const links = Array.from(scope.querySelectorAll<HTMLAnchorElement>('[data-info-jump]'));
  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = document.getElementById(decodeURIComponent(a.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      scrollToY(topOf(target));
      history.replaceState(history.state, '', a.hash);
      const heading = target.querySelector<HTMLElement>('h2');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }, { signal: ac!.signal });
  });
  // the topic crossing the upper middle of the screen is the one being read
  io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => a.toggleAttribute('aria-current', a.hash === `#${en.target.id}`));
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  links.forEach((a) => { const t = document.getElementById(decodeURIComponent(a.hash.slice(1))); if (t) io!.observe(t); });
}

function after() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id ? document.getElementById(id) : null;
  if (target?.matches('.info-topic')) requestAnimationFrame(() => scrollToY(topOf(target), 0));
}

export const system: System = {
  selector: '[data-info-jump]',
  before,
  after,
  destroy,
};
