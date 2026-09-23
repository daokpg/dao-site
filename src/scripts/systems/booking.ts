/**
 * The reserve page. State lives here; every sentence and figure comes from view() in
 * src/lib/booking.ts, the same code that rendered the page, and the DOM is updated in
 * place (so the marks' and choices' CSS transitions play instead of being re-created).
 *
 * Choosing lands with motion: the ticket value resolves through blur, the next step wakes
 * and the page moves to it. The month slides sideways as a strip (arrows or, on desktop,
 * a drag), its name swapping through blur.
 */
import { gsap, ScrollTrigger } from '../core/gsap';
import { E, isMobile, reducedMotion } from '../core/env';
import { scrollToY } from '../core/lenis';
import {
  initialState, monthHtml, openOn, seatOptionsHtml, view,
  type BookingConfig, type BookingState, type MenuChoice, type Pairing,
} from '../../lib/booking';
import type { System } from '../core/registry';

type State = { ac: AbortController; timers: number[]; els: Element[] };
let state: State | null = null;

function destroy() {
  if (!state) return;
  state.ac.abort();
  state.timers.forEach(clearTimeout);
  gsap.killTweensOf(state.els);
  state = null;
}

/** Ticks fill in from the end of each night, night by night. */
export function drawMarks(scope: ParentNode, delay = 0, nightStep = 0.05, each = 0.03) {
  scope.querySelectorAll('[data-night] [data-marks]').forEach((m, i) => {
    if (!m.children.length) return;
    gsap.fromTo(m.children, { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: reducedMotion ? 0 : 1.2, ease: E, stagger: { each, from: 'end' }, delay: delay + i * nightStep });
  });
}

function before(scope: HTMLElement) {
  destroy();
  const root = scope.querySelector<HTMLElement>('[data-booking]')!;
  const cfg: BookingConfig = JSON.parse(root.querySelector('[data-booking-config]')!.textContent ?? '{}');
  const ac = new AbortController();
  const me: State = (state = { ac, timers: [], els: [] });
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const qa = <T extends HTMLElement = HTMLElement>(s: string) => Array.from(root.querySelectorAll<T>(s));
  const later = (fn: () => void, ms: number) => me.timers.push(window.setTimeout(fn, ms));

  const el = {
    monthName: q('[data-month-name]'),
    month: q('[data-month]'),
    clip: q('[data-month-clip]'),
    prev: q<HTMLButtonElement>('[data-month-prev]'),
    next: q<HTMLButtonElement>('[data-month-next]'),
    prevName: q('[data-prev-name]'),
    nextName: q('[data-next-name]'),
    nightLine: q('[data-night-line]'),
    after: q('[data-after]'),
    gates: qa('[data-gate]'),
    seatsLeft: q('[data-seats-left]'),
    seatOptions: q('[data-seat-options]'),
    ticketDate: q('[data-ticket-date]'),
    ticketLine: q('[data-ticket-line]'),
    deposit: q('[data-deposit]'),
    remainder: q('[data-remainder]'),
    holdWrap: q('[data-hold-wrap]'),
    done: q('[data-done]'),
    doneHead: q('[data-done-head]'),
    doneBody: q('[data-done-body]'),
  };
  me.els.push(el.monthName, el.month, el.ticketDate, el.deposit, el.done);

  let s: BookingState = initialState();
  let shownLeft = openOn(cfg, null);
  let sliding = false;

  /** Bring every dependent piece of the page in line with the state. */
  const render = () => {
    const v = view(s, cfg);
    el.monthName.textContent = v.monthName;
    el.prev.disabled = !v.hasPrev;
    el.next.disabled = !v.hasNext;
    el.prevName.textContent = v.prevName;
    el.nextName.textContent = v.nextName;
    el.nightLine.textContent = v.nightLine;
    // nights: pressed state and your marks, in place
    qa('[data-night]').forEach((n) => {
      const mine = n.dataset.label === s.date;
      n.setAttribute('aria-pressed', String(mine));
      n.querySelectorAll('.mk').forEach((mk, i) => mk.setAttribute('data-mine', String(mine && i < s.seats)));
    });
    el.seatsLeft.textContent = v.seatsLeftLine;
    if (v.left !== shownLeft) { el.seatOptions.innerHTML = seatOptionsHtml(v.left, s.seats); shownLeft = v.left; }
    qa('[data-seat]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.seat) === s.seats)));
    qa('[data-pick-menu]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pickMenu === s.menu)));
    qa('[data-pick-pairing]').forEach((b) => b.setAttribute('aria-pressed', String(s.pairing !== null && Number(b.dataset.pickPairing) === s.pairing)));
    el.gates.forEach((g, i) => g.setAttribute('data-live', String(v.gates[i])));
    el.ticketDate.textContent = v.ticketDate;
    el.ticketLine.textContent = v.ticketLine;
    el.deposit.textContent = v.deposit;
    el.remainder.textContent = v.remainder;
    el.holdWrap.setAttribute('data-can', String(v.canHold));
    el.doneHead.textContent = v.doneHead;
    el.doneBody.textContent = v.doneBody;
  };

  const resolve = (target: HTMLElement) => gsap.fromTo(target, { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: E });
  const scrollToEl = (target: HTMLElement, offset: number, ms: number) =>
    later(() => scrollToY(target.getBoundingClientRect().top + window.scrollY - offset), ms);

  // a choice lands: the ticket value resolves through blur, the next step opens and the page moves to it
  function pick<K extends 'date' | 'seats' | 'menu' | 'pairing'>(key: K, val: BookingState[K]) {
    const prev = s[key];
    const patch: Partial<BookingState> = { [key]: val };
    if (key === 'date' && s.seats > openOn(cfg, val as string)) patch.seats = 0;
    const firstTime = prev === null || prev === 0;
    s = { ...s, ...patch };
    render();
    if (key === 'date') {
      el.after.setAttribute('data-live', 'true');
      resolve(el.ticketDate);
      if (firstTime) scrollToEl(el.after, 120, 300);
    }
    if (key === 'seats' || key === 'pairing') resolve(el.deposit);
    if (firstTime && key !== 'date') {
      const next = el.gates[{ seats: 1, menu: 2, pairing: 3 }[key as 'seats' | 'menu' | 'pairing']];
      if (next) scrollToEl(next, isMobile() ? 96 : 140, 350);
    }
  }

  // the month slides sideways as a strip; the name swaps through blur
  function slideMonth(dir: 1 | -1) {
    const nextMonth = s.month + dir;
    if (nextMonth < 0 || nextMonth >= cfg.months.length || sliding) return;
    sliding = true;
    gsap.to(el.monthName, { opacity: 0, filter: 'blur(6px)', y: -8, duration: 0.4, ease: 'power2.in' });
    gsap.to(el.month, {
      xPercent: -12 * dir, opacity: 0, filter: 'blur(4px)', duration: 0.7, ease: 'expo.inOut',
      onComplete: () => {
        s = { ...s, month: nextMonth };
        el.month.innerHTML = monthHtml(cfg, s);
        render();
        gsap.fromTo(el.monthName, { opacity: 0, filter: 'blur(6px)', y: 8 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1, ease: E });
        gsap.fromTo(el.month, { xPercent: 12 * dir, opacity: 0, filter: 'blur(4px)' }, { xPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, ease: E, onComplete: () => { sliding = false; } });
        drawMarks(root, 0.15, 0.03, 0.02);
      },
    });
  }

  function confirm() {
    if (s.done) return;
    const out = Array.from(el.after.children).filter((c) => !c.hasAttribute('data-done')) as HTMLElement[];
    gsap.to(out, {
      opacity: 0, y: -12, filter: 'blur(6px)', duration: 0.9, ease: E, stagger: 0.06,
      onComplete: () => {
        out.forEach((c) => (c.style.display = 'none'));
        s = { ...s, done: true };
        render();
        el.after.querySelector('aside')?.style.setProperty('display', 'none', 'important');
        el.done.style.display = 'flex';
        gsap.fromTo(el.done.children, { opacity: 0, y: 18, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.25, ease: E, stagger: 0.1 });
      },
    });
  }

  // ---- the steps and the ticket rise into place as they are scrolled to
  if (!reducedMotion) {
    qa('[data-after] [data-gate], [data-after] aside > *').forEach((step) => {
      ScrollTrigger.create({
        trigger: step, start: 'top 88%', once: true,
        onEnter: () => gsap.fromTo(step.children, { opacity: 0, y: 14, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.25, ease: E, stagger: 0.06 }),
      });
    });
  }

  // ---- input
  let swallow = false;
  root.addEventListener('click', (e) => {
    const t = e.target as Element;
    const night = t.closest<HTMLElement>('[data-night]');
    if (night) {
      if (swallow) { e.preventDefault(); e.stopPropagation(); return; } // a drag is not a pick
      return pick('date', night.dataset.label ?? null);
    }
    const seat = t.closest<HTMLElement>('[data-seat]');
    if (seat) return pick('seats', Number(seat.dataset.seat));
    const menu = t.closest<HTMLElement>('[data-pick-menu]');
    if (menu) return pick('menu', menu.dataset.pickMenu as MenuChoice);
    const pairing = t.closest<HTMLElement>('[data-pick-pairing]');
    if (pairing) return pick('pairing', Number(pairing.dataset.pickPairing) as Pairing);
    if (t.closest('[data-month-prev]')) return slideMonth(-1);
    if (t.closest('[data-month-next]')) return slideMonth(1);
    if (t.closest('[data-confirm]')) return confirm();
  }, { signal: ac.signal });

  root.addEventListener('input', (e) => {
    const f = (e.target as HTMLInputElement).dataset.field as 'name' | 'email' | 'phone' | 'note' | undefined;
    if (!f) return;
    s = { ...s, [f]: (e.target as HTMLInputElement).value };
    render();
  }, { signal: ac.signal });

  // ---- drag the month sideways (desktop)
  if (!isMobile()) {
    const strip = el.month, clip = el.clip;
    clip.style.touchAction = 'pan-y';
    let x0 = 0, dx = 0, down = false, moved = false;
    clip.addEventListener('pointerdown', (e) => {
      if (sliding) return;
      down = true; moved = false; x0 = e.clientX; dx = 0;
      gsap.killTweensOf(strip, 'x');
    }, { signal: ac.signal });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      dx = e.clientX - x0;
      if (Math.abs(dx) > 6) moved = true;
      gsap.set(strip, { x: dx * 0.6 });
    }, { signal: ac.signal });
    const up = () => {
      if (!down) return;
      down = false;
      const th = clip.clientWidth * 0.12;
      if (dx < -th && s.month < cfg.months.length - 1) { slideMonth(1); gsap.set(strip, { x: 0 }); }
      else if (dx > th && s.month > 0) { slideMonth(-1); gsap.set(strip, { x: 0 }); }
      else gsap.to(strip, { x: 0, duration: 1.2, ease: E });
      if (moved) { swallow = true; later(() => (swallow = false), 50); }
    };
    window.addEventListener('pointerup', up, { signal: ac.signal });
    window.addEventListener('pointercancel', up, { signal: ac.signal });
  }
}

export const system: System = {
  selector: '[data-booking]',
  before,
  destroy,
};
