/**
 * The menu. Persistent chrome: bound once for the whole visit.
 *
 * Open (about 2.6s): a flat sheet slides up, the frames open column by column once it is
 * halfway, names rise on their tail. Close (about 1.5s): text lifts first, frames close
 * downward, and the sheet leaves before they finish. The Menu/Close word rolls between
 * the two, letter by letter.
 */
import { gsap } from '../core/gsap';
import { CLOSED, E, OPEN, SHEET } from '../core/env';
import { startScroll, stopScroll } from '../core/lenis';
import { setTone } from '../core/tone';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const $$ = (s: string) => Array.from(document.querySelectorAll<HTMLElement>(s));

let open = false;
let swapping = false;
let tl: gsap.core.Timeline | null = null;

const parts = () => ({
  panel: $('[data-menu-panel]'),
  scrim: $('[data-menu-scrim]'),
  button: $<HTMLButtonElement>('[data-nav-menu]'),
  masks: $$('[data-menu-mask]'),
  imgs: $$('[data-menu-mask] img'),
  labels: $$('[data-menu-label]'),
  contact: $('[data-menu-contact]'),
});

export const isMenuOpen = () => open;

/** The current word rolls up and out, the other rolls up and in. Only the word wrappers move. */
function swapWord(next: boolean, instant = false) {
  const outW = $(next ? '[data-word="menu"]' : '[data-word="close"]');
  const inW = $(next ? '[data-word="close"]' : '[data-word="menu"]');
  gsap.killTweensOf([outW, inW]);
  if (instant) {
    gsap.set(outW, { visibility: 'hidden', yPercent: 0, opacity: 1 });
    gsap.set(inW, { visibility: 'visible', yPercent: 0, opacity: 1 });
    swapping = false;
    return;
  }
  gsap.set([outW, inW], { visibility: 'visible' });
  swapping = true;
  gsap.to(outW, { yPercent: -100, opacity: 0, duration: 0.9, ease: E, onComplete: () => void gsap.set(outW, { visibility: 'hidden', yPercent: 0, opacity: 1 }) });
  gsap.fromTo(inW, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, ease: E, delay: 0.06, onComplete: () => { swapping = false; } });
}

function setOpenState(next: boolean) {
  open = next;
  const { panel, button } = parts();
  button.setAttribute('aria-expanded', String(next));
  button.setAttribute('aria-label', next ? 'Close menu' : 'Open menu');
  panel.toggleAttribute('inert', !next);
  // while the menu is open the page behind it is out of reach (keyboard, screen readers)
  document.querySelector('[data-barba="container"]')?.toggleAttribute('inert', next);
  setTone('menu', next);
  // focus goes into the menu, and back to its button when it closes from inside
  if (next) panel.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
  else if (panel.contains(document.activeElement)) button.focus({ preventScroll: true });
}

function killMenuTweens() {
  tl?.kill();
  const p = parts();
  gsap.killTweensOf([p.panel, p.scrim, ...p.masks, ...p.imgs, ...p.labels, p.contact]);
}

export function openMenu() {
  const { panel, scrim, masks, labels, contact } = parts();
  swapWord(true);
  setOpenState(true);
  stopScroll();
  killMenuTweens();
  gsap.set(masks, { clipPath: CLOSED });
  gsap.set('[data-menu-mask] img', { scale: 1.18 });
  gsap.set(labels, { opacity: 0, y: 14, filter: 'blur(6px)' });
  gsap.set(contact, { opacity: 0, y: 10 });
  const slide = 1.2;
  const t = (tl = gsap.timeline());
  t.to(panel, { yPercent: 0, duration: slide, ease: SHEET }, 0);
  t.to(scrim, { opacity: 0.55, duration: slide, ease: SHEET }, 0);
  masks.forEach((m, i) => {
    const at = slide * 0.5 + i * 0.09;
    t.to(m, { clipPath: OPEN, duration: 1.5, ease: E }, at);
    t.to(m.querySelector('img'), { scale: 1, duration: 2.2, ease: E }, at);
    t.to(labels[i], { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: E }, at + 0.35);
  });
  t.to(contact, { opacity: 1, y: 0, duration: 1.1, ease: E }, slide * 0.5 + 0.9);
}

export function closeMenu() {
  const { panel, scrim, masks, labels, contact } = parts();
  swapWord(false);
  setOpenState(false);
  startScroll();
  killMenuTweens();
  const t = (tl = gsap.timeline());
  t.to(contact, { opacity: 0, y: 10, duration: 1, ease: E }, 0.15);
  t.to(labels, { opacity: 0, y: -10, filter: 'blur(4px)', duration: 1.1, ease: E, stagger: 0.05 }, 0.1);
  // masks are cut by the sheet at roughly half their travel: an even close, never seen finishing
  masks.forEach((m, i) => {
    const at = 0.1 + i * 0.06;
    t.to(m, { clipPath: CLOSED, duration: 1.5, ease: 'power1.inOut' }, at);
    t.to(m.querySelector('img'), { scale: 1.08, duration: 1.5, ease: 'power1.inOut' }, at);
  });
  // the cut: the sheet drops while the images are mid-close
  t.to(panel, { yPercent: 102, duration: 0.9, ease: SHEET }, 0.55);
  t.to(scrim, { opacity: 0, duration: 0.9, ease: SHEET }, 0.55);
}

/** Closed at once, no motion. Used behind the transition sheet when a menu link was followed. */
export function resetMenu() {
  if (!open) return;
  const { panel, scrim, masks, labels, contact } = parts();
  killMenuTweens();
  setOpenState(false);
  swapWord(false, true);
  gsap.set(panel, { yPercent: 102 });
  gsap.set(scrim, { opacity: 0 });
  gsap.set(masks, { clipPath: CLOSED });
  gsap.set(labels, { opacity: 0, y: 16 });
  gsap.set(contact, { opacity: 0, y: 16 });
}

/** Mark the page in view in the menu. */
export function setMenuCurrent(key: string | undefined) {
  $$('[data-menu-item]').forEach((a) => {
    if (a.dataset.pageKey === key) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

export function initMenu() {
  const { panel, masks, imgs, labels, contact, button } = parts();
  gsap.set(panel, { yPercent: 102, visibility: 'visible' });
  gsap.set(masks, { clipPath: CLOSED });
  gsap.set(imgs, { scale: 1.18 });
  gsap.set([...labels, contact], { opacity: 0, y: 16 });
  button.addEventListener('click', (e) => {
    e.preventDefault();
    if (swapping) return;
    if (open) closeMenu();
    else openMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) closeMenu();
  });
  // a click on the page around the menu closes it
  parts().scrim.addEventListener('click', () => { if (open && !swapping) closeMenu(); });
  setMenuCurrent(document.querySelector<HTMLElement>('[data-barba="container"]')?.dataset.page);
}
