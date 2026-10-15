/**
 * Page transitions (Barba). One physical gesture: a charcoal sheet rises over the page you
 * leave (which settles back into black), the next page's name resolves letter by letter on
 * the still sheet, everything swaps behind it, the name unwinds, the sheet drops and the new
 * page grows back into place.
 *
 * Lifecycle, and what each step owes:
 *   leave        sheet up, name in. The old page stays until it is covered.
 *   afterLeave   covered: kill every ScrollTrigger and system, hide the old page, close the
 *                menu, jump to the top.
 *   beforeEnter  the new page is in the DOM, in flow, untransformed, still covered: set its
 *                tone and ground, run the registry's `before` (splits, pre-hides, reveals).
 *   enter        name out, sheet down, the page grows back; its entrance starts under the drop.
 *   afterEnter   landed, transforms cleared: the registry's `after` (pins, scrubs), scroll on.
 *
 * The first page load skips the sheet and runs the same steps in `once`.
 */
import barba from '@barba/core';
import { gsap } from './gsap';
import { E, SHEET, reducedMotion, wait } from './env';
import { scrollToTop, startScroll, stopScroll } from './lenis';
import { resetTone } from './tone';
import { runAfter, runBefore, teardown } from './registry';
import { killEntrance, playEntrance } from '../systems/entrance';
import { resetMenu, setMenuCurrent } from '../chrome/menu';
import { cleanPath } from './links';

/** The pieces of Barba's transition data used here (its bundled typings do not resolve). */
interface Page { container: HTMLElement; namespace: string; url: { href: string; path?: string } }
interface Data { current: Page; next: Page }

// Timing, as designed. The name unwinds as soon as it has finished arriving: there is no hold for
// a page load, because Barba fetched the next page while the sheet was rising (and usually on
// hover, before the click).
const T = {
  cover: 1, // sheet up, page settles back
  lettersAt: 0.7, letterStagger: 0.028, letterDur: 2.2,
  numAfter: 0.9, push: 1.2,
  read: 1.0, // from the number starting to rise until the name unwinds (it has landed by then)
  hold: 0.1, unwindStagger: 0.018, unwindDur: 0.75,
  drop: 1.75, dropAfter: -0.12,
  entranceAfterDrop: 0.35,
};

const panel = () => document.querySelector<HTMLElement>('[data-pt-panel]')!;
const nameEl = () => document.querySelector<HTMLElement>('[data-pt-name]')!;
const numEl = () => document.querySelector<HTMLElement>('[data-pt-num]')!;

/**
 * Name and number for a destination, taken from the menu so there is one list of pages; a page
 * outside the menu (site.unlisted, listed in TransitionSheet.astro) has a name and no number.
 */
function pageMeta(path: string) {
  const clean = cleanPath(path);
  const same = (href: string) => cleanPath(new URL(href, location.href).pathname) === clean;
  const item = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-menu-item]')).find((a) => same(a.href));
  if (item) {
    return {
      name: item.querySelector('[data-menu-name]')?.textContent ?? '',
      num: item.querySelector('[data-menu-num]')?.textContent ?? '',
    };
  }
  const other = Array.from(document.querySelectorAll<HTMLElement>('[data-pt-page]')).find((p) => same(p.dataset.href ?? ''));
  return { name: other?.dataset.name ?? '', num: '' };
}

/** Scale around the middle of the screen, wherever the page is scrolled to. */
const originFor = (el: HTMLElement) => `50% ${-el.getBoundingClientRect().top + window.innerHeight / 2}px`;

function setGround(color: string) {
  document.body.style.backgroundColor = color;
  document.documentElement.style.background = color;
}

async function leave(data: Data): Promise<void> {
  const page = data.current.container;
  // The browser keeps this per history entry, and Barba has just pushed a new one (which starts
  // as 'auto'). Without it, "back" would restore an old scroll position into a swapped page.
  history.scrollRestoration = 'manual';
  stopScroll();
  if (reducedMotion) {
    await gsap.to(page, { opacity: 0, duration: 0.3 });
    return;
  }

  const { name, num } = pageMeta(data.next.url.path ?? new URL(data.next.url.href).pathname);
  const nEl = nameEl(), numE = numEl(), p = panel();
  nEl.replaceChildren(...Array.from(name).map((ch) => Object.assign(document.createElement('span'), { textContent: ch })));
  numE.textContent = num;
  gsap.set([...nEl.children, numE], { clearProps: 'all' });
  gsap.set(p, { yPercent: 102, visibility: 'visible' });
  setGround('#000');
  gsap.set(page, { transformOrigin: originFor(page) });
  const letters = nEl.children;
  gsap.set(nEl, { y: (numE.getBoundingClientRect().height + 20) / 2 });

  const tl = gsap.timeline();
  tl.to(page, { scale: 0.94, y: 16, duration: T.cover, ease: SHEET }, 0);
  tl.to(p, { yPercent: 0, duration: T.cover, ease: SHEET }, 0);
  tl.to(letters, { opacity: 1, y: 0, filter: 'blur(0px)', duration: T.letterDur, ease: E, stagger: T.letterStagger }, T.lettersAt);
  const numAt = T.lettersAt + letters.length * T.letterStagger + T.numAfter;
  tl.to(numE, { opacity: 1, y: 0, filter: 'blur(0px)', duration: T.push, ease: E }, numAt);
  tl.to(nEl, { y: 0, duration: T.push, ease: E }, numAt);
  const go = Math.max(numAt + T.read, T.cover);
  await new Promise<void>((resolve) => void tl.call(resolve, undefined, go));
}

function afterLeave(data: Data) {
  teardown();
  killEntrance();
  resetMenu();
  data.current.container.style.display = 'none';
  scrollToTop({ immediate: true });
}

/** Everything a page needs before it is shown, on a real load or behind the sheet. */
function prepare(container: HTMLElement) {
  document.body.dataset.page = container.dataset.page;
  resetTone(container.dataset.tone === 'cream');
  setMenuCurrent(container.dataset.page);
  runBefore(container);
}

async function enter(data: Data): Promise<void> {
  const page = data.next.container;
  if (reducedMotion) {
    gsap.set(panel(), { visibility: 'hidden' });
    playEntrance(page);
    await gsap.fromTo(page, { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'all' });
    return;
  }
  const p = panel(), nEl = nameEl(), numE = numEl();
  gsap.set(p, { yPercent: 0 });
  setGround('#000');
  gsap.set(page, { transformOrigin: originFor(page), scale: 0.94, y: 16 });
  const tl = gsap.timeline();
  // number and letters leave together, the first beat on a still sheet; then the sheet moves and carries the rest
  tl.to(numE, { opacity: 0, y: 10, filter: 'blur(6px)', duration: T.unwindDur, ease: E }, T.hold);
  tl.to(nEl.children, { opacity: 0, y: 10, filter: 'blur(6px)', duration: T.unwindDur, ease: E, stagger: { each: T.unwindStagger, from: 'end' } }, T.hold);
  const drop = Math.max(0, T.hold + T.dropAfter);
  tl.to(p, { yPercent: 102, duration: T.drop, ease: SHEET }, drop);
  // clearProps: a leftover transform would make the page a containing block and break every position:fixed inside it
  tl.to(page, { scale: 1, y: 0, duration: T.drop, ease: SHEET, clearProps: 'all', onComplete: () => setGround('') }, drop);
  tl.call(() => playEntrance(page), undefined, drop + T.entranceAfterDrop);
  await new Promise<void>((resolve) => void tl.call(() => { gsap.set(p, { visibility: 'hidden' }); resolve(); }, undefined, drop + T.drop + 0.05));
}

function finish(container: HTMLElement, navigated = false) {
  runAfter(container);
  startScroll();
  const announcer = document.querySelector('[data-route-announcer]');
  if (announcer) announcer.textContent = document.title;
  // after a page change, keyboard focus starts at the new page's title (the link that had it is gone)
  if (navigated) {
    const title = container.querySelector<HTMLElement>('h1') ?? container;
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
}

/** Fonts decide where lines break; wait for them (briefly) before the first split. */
const fontsReady = () => Promise.race([document.fonts?.ready ?? Promise.resolve(), wait(2500)]);

/** Fetch a page as soon as a pointer reaches its link, so the transition never waits on the network. */
function prefetchOnIntent() {
  const seen = new Set<string>();
  const warm = (e: Event) => {
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.origin !== location.origin || a.pathname === location.pathname || seen.has(a.href)) return;
    seen.add(a.href);
    barba.prefetch(a.href);
  };
  document.addEventListener('pointerover', warm, { passive: true });
  document.addEventListener('touchstart', warm, { passive: true });
}

export function initTransitions() {
  prefetchOnIntent();
  barba.init({
    preventRunning: true,
    timeout: 10000,
    transitions: [{
      name: 'dao',
      async once(data: Data) {
        await fontsReady();
        const c = data.next.container;
        prepare(c);
        playEntrance(c, { firstLoad: true });
        finish(c);
      },
      leave,
      afterLeave,
      beforeEnter: (data: Data) => prepare(data.next.container),
      enter,
      afterEnter: (data: Data) => finish(data.next.container, true),
    }],
  });
}
