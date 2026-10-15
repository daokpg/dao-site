/**
 * The reserve page. State lives here; every sentence and figure comes from view() in
 * src/lib/booking.ts, the same code that rendered the page, and the DOM is updated in
 * place (so the marks' and choices' CSS transitions play instead of being re-created).
 *
 * Choosing lands with motion: the ticket value resolves through blur, the next step wakes
 * and the page moves to it.
 *
 * With cfg.api set, the real nights are loaded from the booking backend (the Apps Script in the
 * reservations sheet), requests are posted to it, and a booking continues to Stripe to save a
 * card; Stripe sends the guest back to /reserve?request=…&card=1|0. The month slides sideways as a strip (arrows or, on desktop,
 * a drag), its name swapping through blur.
 */
import { gsap, ScrollTrigger } from '../core/gsap';
import { E, isMobile, reducedMotion } from '../core/env';
import { scrollToY } from '../core/lenis';
import {
  initialState, monthHtml, monthsFromNights, seatLimit, seatOptionsHtml, view,
  type ApiNight, type BookingConfig, type BookingState,
} from '../../lib/booking';
import { fill } from '../../lib/format';
import type { System } from '../core/registry';

/** What the page remembers across the trip to Stripe and back. */
const PENDING_KEY = 'dao-request';

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
    const marks = m.querySelectorAll('.mk'); // a full night's waitlist label is not a mark
    if (!marks.length) return;
    gsap.fromTo(marks, { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: reducedMotion ? 0 : 1.2, ease: E, stagger: { each, from: 'end' }, delay: delay + i * nightStep });
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
    holdWrap: q('[data-hold-wrap]'),
    done: q('[data-done]'),
    doneHead: q('[data-done-head]'),
    doneBody: q('[data-done-body]'),
    cake: q('[data-cake]'),
    cakeBox: q<HTMLInputElement>('[data-cake-box]'),
    honeypot: q<HTMLInputElement>('[data-honeypot]'),
    holdError: q('[data-hold-error]'),
  };
  me.els.push(el.monthName, el.month, el.ticketDate, el.done);

  let s: BookingState = initialState();
  let shownLeft = seatLimit(cfg, null);
  let sliding = false;
  let sending = false;
  let isoByLabel: Record<string, string> = {};

  /** Bring every dependent piece of the page in line with the state. */
  const render = () => {
    const v = view(s, cfg);
    root.setAttribute('data-waitlist', String(v.waitlist));
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
    if (v.limit !== shownLeft) { el.seatOptions.innerHTML = seatOptionsHtml(v.limit, s.seats); shownLeft = v.limit; }
    qa('[data-seat]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.seat) === s.seats)));
    // a step that is not open yet is out of reach (keyboard and screen readers too), and so is the button until the request is complete
    el.gates.forEach((g, i) => { g.setAttribute('data-live', String(v.gates[i])); g.inert = !v.gates[i]; });
    qa<HTMLButtonElement>('[data-confirm]').forEach((b) => { b.disabled = !v.canHold; });
    el.ticketDate.textContent = v.ticketDate;
    el.ticketLine.textContent = v.ticketLine;
    el.holdWrap.setAttribute('data-can', String(v.canHold));
    el.doneHead.textContent = v.doneHead;
    el.doneBody.textContent = v.doneBody;
    el.cake.hidden = !v.showCake;
    el.cakeBox.checked = s.cake;
  };

  const resolve = (target: HTMLElement) => gsap.fromTo(target, { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: E });
  const scrollToEl = (target: HTMLElement, offset: number, ms: number) =>
    later(() => scrollToY(target.getBoundingClientRect().top + window.scrollY - offset), ms);

  // a choice lands: the ticket value resolves through blur, the next step opens and the page moves to it
  function pick<K extends 'date' | 'seats'>(key: K, val: BookingState[K]) {
    if (s.done) return;
    const prev = s[key];
    const patch: Partial<BookingState> = { [key]: val };
    if (key === 'date' && s.seats > seatLimit(cfg, val as string)) patch.seats = 0;
    const firstTime = prev === null || prev === 0;
    s = { ...s, ...patch };
    render();
    if (key === 'date') {
      el.after.setAttribute('data-live', 'true');
      el.after.inert = false;
      resolve(el.ticketDate);
      if (firstTime) scrollToEl(el.after, 120, 300);
    }
    if (key === 'seats') {
      if (firstTime) scrollToEl(el.gates[1], isMobile() ? 96 : 140, 350);
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
        fillMonth();
        render();
        gsap.fromTo(el.monthName, { opacity: 0, filter: 'blur(6px)', y: 8 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1, ease: E });
        gsap.fromTo(el.month, { xPercent: 12 * dir, opacity: 0, filter: 'blur(4px)' }, { xPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, ease: E, onComplete: () => { sliding = false; } });
        drawMarks(root, 0.15, 0.03, 0.02);
      },
    });
  }

  /** The month strip has one column per night: sixteen in the placeholder, around twenty-two in a real month. */
  const fillMonth = () => {
    el.month.innerHTML = monthHtml(cfg, s);
    const n = cfg.months[s.month]?.nights.length ?? 16;
    el.month.style.gridTemplateColumns = `repeat(${n},minmax(0,1fr))`;
    el.month.style.columnGap = n > 16 ? '8px' : '';
  };

  const showError = (msg: string) => { el.holdError.textContent = msg; el.holdError.hidden = !msg; };

  // ---- the real nights, from the booking backend
  async function loadNights() {
    root.setAttribute('data-loading', 'true');
    el.nightLine.textContent = cfg.copy.loadingNights;
    try {
      const res = await fetch(cfg.api, { signal: ac.signal });
      const data: { nights: ApiNight[] } = await res.json();
      const built = monthsFromNights(data.nights ?? []);
      if (!built.months.length) { el.nightLine.textContent = fill(cfg.copy.noNights, { contact: cfg.contactEmail }); return; }
      cfg.months = built.months;
      isoByLabel = built.isoByLabel;
      s = { ...s, month: 0, date: null, seats: 0 };
      fillMonth();
      render();
      drawMarks(root, 0.1, 0.03, 0.02);
    } catch (err) {
      if (ac.signal.aborted) return;
      el.nightLine.textContent = fill(cfg.copy.loadError, { contact: cfg.contactEmail });
    } finally {
      if (!ac.signal.aborted) root.removeAttribute('data-loading');
    }
  }

  // ---- sending the request
  async function confirm() {
    if (s.done || sending || !view(s, cfg).canHold) return;
    if (!cfg.api) return showDone();
    const v = view(s, cfg);
    sending = true;
    el.holdWrap.setAttribute('data-sending', 'true');
    showError('');
    try {
      // text/plain keeps this a simple request, which Apps Script accepts from another site
      const res = await fetch(cfg.api, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ac.signal,
        body: JSON.stringify({
          type: v.waitlist ? 'waitlist' : 'booking', date: isoByLabel[s.date ?? ''], seats: s.seats,
          name: s.name, whatsapp: s.whatsapp, email: s.email, occasion: s.occasion, cake: s.cake, note: s.note,
          website: el.honeypot.value,
        }),
      });
      const out: { ok: boolean; reason?: string; left?: number; cardUrl?: string | null } = await res.json();
      // only ever send the guest on to Stripe's own card page (or the local test backend's stand-in)
      const toCard = !!out.cardUrl && (out.cardUrl.startsWith('https://checkout.stripe.com/') || (cfg.api.startsWith('http://localhost') && out.cardUrl.startsWith('http://localhost')));
      if (out.ok && toCard && out.cardUrl) {
        try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ date: s.date, seats: s.seats })); } catch {}
        window.location.href = out.cardUrl;
        return;
      }
      if (out.ok) return showDone();
      if (out.reason === 'not_enough') showError(fill(cfg.copy.notEnough, { left: out.left ?? 0, date: s.date ?? '' }));
      else if (out.reason === 'closed') showError(fill(cfg.copy.nightClosed, { date: s.date ?? '' }));
      else showError(fill(cfg.copy.sendError, { contact: cfg.contactEmail }));
    } catch (err) {
      if (!ac.signal.aborted) showError(fill(cfg.copy.sendError, { contact: cfg.contactEmail }));
    } finally {
      sending = false;
      el.holdWrap.removeAttribute('data-sending');
    }
  }

  /** The form gives way to the thank-you message. */
  function showDone(extra = '') {
    const out = Array.from(el.after.children).filter((c) => !c.hasAttribute('data-done')) as HTMLElement[];
    gsap.to(out, {
      opacity: 0, y: -12, filter: 'blur(6px)', duration: 0.9, ease: E, stagger: 0.06,
      onComplete: () => {
        out.forEach((c) => (c.style.display = 'none'));
        s = { ...s, done: true };
        render();
        if (extra) el.doneBody.textContent += ` ${extra}`;
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
    if (t.closest('[data-month-prev]')) return slideMonth(-1);
    if (t.closest('[data-month-next]')) return slideMonth(1);
    if (t.closest('[data-confirm]')) return confirm();
  }, { signal: ac.signal });

  root.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-cake-box]')) { s = { ...s, cake: t.checked }; render(); return; }
    const f = t.dataset.field as 'name' | 'email' | 'whatsapp' | 'occasion' | 'note' | undefined;
    if (!f) return;
    s = { ...s, [f]: t.value };
    // the cake belongs to a birthday; changing the occasion takes it away
    if (f === 'occasion' && t.value !== 'birthday') s.cake = false;
    render();
  }, { signal: ac.signal });

  // ---- back from Stripe, or load the real nights
  const back = new URLSearchParams(window.location.search);
  if (back.get('request')) {
    let saved: { date?: string; seats?: number } = {};
    try { saved = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? '{}'); sessionStorage.removeItem(PENDING_KEY); } catch {}
    // only bookings go to Stripe, so the message is a booking's even if the night has filled since
    s = { ...s, date: saved.date ?? null, seats: saved.seats ?? 0, done: false };
    cfg.months = [{ name: cfg.months[0]?.name ?? '', nights: [] }];
    fillMonth();
    el.after.setAttribute('data-live', 'true');
    el.after.inert = false;
    showDone(back.get('card') === '0' ? cfg.copy.cardSkipped : '');
  } else if (cfg.api) {
    loadNights();
  }

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
