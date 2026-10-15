/**
 * How each page arrives. Played once per page entry: on a real load straight away (home
 * first plays the intro loader), after a transition while the sheet is still dropping.
 * Keyed on what the page has:
 *
 *   [data-entrance="film"]   home hero: mask opens, headline lines rise, the reserve link draws in
 *   [data-entrance="photo"]  story hero: same gesture, lines a beat later
 *   [data-entrance="page"]   info: no photograph, the title lines rise
 *   [data-clock]             evening: the clock resolves out of blur
 *   [data-month]             reserve: the month name, then the nights, then their seats tick in
 *
 * Reduced motion: the timeline is built and jumped straight to its end.
 */
import { gsap } from '../core/gsap';
import { E, OPEN, SHEET, reducedMotion } from '../core/env';
import { drawMarks } from './booking';

/** When the home intro plays on a real page load. Never after a transition. */
const INTRO: 'every load' | 'once per session' | 'off' = 'every load';

const HERO = {
  film: { lines: [0, 0.2], nav: 0.3, corner: 1.1 },
  photo: { lines: [0.6, 0.8], nav: 0.5, corner: 1.5 },
  page: { lines: [0.2, 0.36], nav: 0.3, corner: 1.1 },
} as const;

let tl: gsap.core.Timeline | null = null;

export function killEntrance() {
  tl?.kill();
  tl = null;
}

const $ = (s: string, root: ParentNode = document) => root.querySelector<HTMLElement>(s);

function wantsIntro() {
  if (reducedMotion || INTRO === 'off') return false;
  let seen = false;
  try {
    seen = sessionStorage.getItem('dao-intro-seen') === '1';
    sessionStorage.setItem('dao-intro-seen', '1');
  } catch { /* storage blocked: treat as unseen */ }
  return INTRO === 'every load' || !seen;
}

function hideLoader() {
  const loader = $('[data-loader]'), logo = $('[data-loader-logo]');
  if (loader) gsap.set(loader, { display: 'none' });
  if (logo) gsap.set(logo, { display: 'none' });
  gsap.set('[data-nav-mark]', { opacity: 1 });
}

/** Hero content: every element starts on the tail of the one before. */
function heroIn(t: gsap.core.Timeline, scope: HTMLElement, at: number, withMask = true) {
  const hero = $('[data-entrance]', scope)!;
  const timing = HERO[(hero.dataset.entrance as keyof typeof HERO) ?? 'photo'] ?? HERO.photo;
  const lines = scope.querySelectorAll('[data-hero-line]');
  if (withMask) {
    t.to($('[data-hero-mask]', scope), { clipPath: OPEN, duration: 2, ease: E }, at);
    t.to($('[data-hero-img]', scope), { scale: 1, duration: 3, ease: E }, at);
  }
  lines.forEach((line, i) => t.to(line, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.25, ease: E }, at + (timing.lines[i] ?? timing.lines[1] + 0.2 * (i - 1))));
  const label = $('[data-hero-reserve-label]', scope), rule = $('[data-hero-reserve-rule]', scope);
  if (label) t.to(label, { opacity: 1, y: 0, duration: 1.1, ease: E }, at + 0.6);
  if (rule) t.to(rule, { scaleX: 1, duration: 1.25, ease: E }, at + 0.75);
  t.to('[data-nav]', { opacity: 1, duration: 1, ease: E }, at + timing.nav);
  const corner = $('[data-hero-corner]', scope);
  if (corner) t.to(corner, { opacity: 1, duration: 1, ease: E }, at + timing.corner);
}

/**
 * The home intro: the mark is there from the first frame, the tagline arrives letter by letter,
 * then the sheet drops and the mark flies into the nav in the same beat, one motion.
 */
function playIntro(t: gsap.core.Timeline, scope: HTMLElement) {
  const tag = document.querySelectorAll('[data-loader-tag] [data-char]');
  const loader = $('[data-loader]')!, logo = $('[data-loader-logo]')!, mark = $('[data-nav-mark]')!;
  // the hero exists behind the sheet the whole time: image already open
  gsap.set($('[data-hero-mask]', scope), { clipPath: OPEN });
  gsap.set($('[data-hero-img]', scope), { scale: 1.06 });
  gsap.set(mark, { opacity: 0 });
  const lettersDone = 0.3 + 1.25 + tag.length * 0.02;
  t.to(tag, { yPercent: 0, y: 0, duration: 1.25, ease: E, stagger: 0.02 }, 0.3);
  // the moment the line reads complete the sheet drops, and the logo detaches in the same beat:
  // sheet and logo share duration and curve
  const drop = lettersDone - 0.45, flight = 1.3;
  t.to(loader, { yPercent: 100, duration: flight, ease: SHEET }, drop);
  t.set(loader, { display: 'none' }, drop + flight + 0.05);
  t.add(() => {
    const a = logo.getBoundingClientRect(), b = mark.getBoundingClientRect();
    gsap.to(logo, {
      x: b.left + b.width / 2 - (a.left + a.width / 2),
      y: b.top + b.height / 2 - (a.top + a.height / 2),
      scale: b.width / a.width, duration: flight, ease: SHEET, transformOrigin: '50% 50%',
    });
  }, drop);
  // the picture settles as it is uncovered, and the headline starts before the logo lands
  t.to($('[data-hero-img]', scope), { scale: 1, duration: 3, ease: E }, drop);
  heroIn(t, scope, drop + flight * 0.6, false);
  t.set(mark, { opacity: 1 }, drop + flight - 0.03);
  t.set(logo, { display: 'none' }, drop + flight - 0.02);
}

export function playEntrance(scope: HTMLElement, { delay = 0, firstLoad = false } = {}) {
  killEntrance();
  const t = (tl = gsap.timeline({ delay }));
  const hasLoader = !!$('[data-loader]');

  if (hasLoader && firstLoad && $('[data-entrance]', scope) && wantsIntro()) {
    playIntro(t, scope);
    return;
  }
  if (hasLoader) hideLoader();

  if ($('[data-entrance]', scope)) {
    heroIn(t, scope, 0.1, !!$('[data-hero-mask]', scope));
  } else if ($('[data-clock]', scope)) {
    t.to($('[data-clock]', scope), { opacity: 1, filter: 'blur(0px)', duration: 1.6, ease: E }, 0.2);
    t.to('[data-nav]', { opacity: 1, duration: 1, ease: E }, 0.6);
    t.to($('[data-hero-corner]', scope), { opacity: 1, duration: 1, ease: E }, 1.4);
  } else if ($('[data-month]', scope)) {
    t.to('[data-nav]', { opacity: 1, duration: 1, ease: E }, 0.4);
    t.fromTo($('[data-month-name]', scope), { opacity: 0, y: 18, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.25, ease: E }, 0.3);
    t.fromTo(scope.querySelectorAll('[data-night]'), { opacity: 0, y: 14, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.25, ease: E, stagger: 0.05 }, 0.5);
    t.fromTo(scope.querySelectorAll('.mn, [data-night-line]'), { opacity: 0, y: 10, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: E, stagger: 0.08 }, 1.3);
    drawMarks(scope, delay + 0.7);
    // the from-states are now inline, so the CSS that held these hidden can let go
    scope.setAttribute('data-entered', '');
  } else {
    t.to('[data-nav]', { opacity: 1, duration: 1, ease: E }, 0.4);
  }

  if (reducedMotion) t.progress(1);
}
