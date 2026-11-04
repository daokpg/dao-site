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
  CONTACT, fieldOk, missingFields, seatGridStyle, type ContactField,
  initialState, monthHtml, monthsFromNights, pastLabels, seatLimit, seatOptionsHtml, view,
  type ApiNight, type BookingConfig, type BookingState,
} from '../../lib/booking';
import { fill } from '../../lib/format';
import type { System } from '../core/registry';

/** What the page remembers across the trip to Stripe and back. */
const PENDING_KEY = 'dao-request';
/** How long a call to the booking backend may take before the page shows its error. */
const TIMEOUT_MS = 20000;

type State = { ac: AbortController; timers: number[]; els: Element[] };
let state: State | null = null;

function destroy() {
  if (!state) return;
  state.ac.abort();
  state.timers.forEach(clearTimeout);
  gsap.killTweensOf(state.els);
  state = null;
}

/** Seats rise into each night from its foot, night after night across the month, so the eye goes to them. */
export function drawMarks(scope: ParentNode, delay = 0, nightStep = 0.07, each = 0.03) {
  scope.querySelectorAll('[data-night] [data-marks]').forEach((m, i) => {
    const marks = m.querySelectorAll('.mk'); // a full night's waitlist label is not a mark
    if (!marks.length) return;
    // desktop marks are short lines drawn out from the left; on phones they are upright ticks that grow from the foot
    const from = isMobile() ? { scaleY: 0, transformOrigin: '50% 100%' } : { scaleX: 0, y: 10, transformOrigin: '0 50%' };
    gsap.fromTo(marks, from, { scaleX: 1, scaleY: 1, y: 0, duration: reducedMotion ? 0 : 1.2, ease: E, stagger: { each, from: isMobile() ? 'start' : 'end' }, delay: delay + i * nightStep });
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
    holdMissing: q('[data-hold-missing]'),
    announce: q('[data-announce]'),
    pickFirst: q<HTMLButtonElement>('[data-pick-first]'),
  };
  me.els.push(el.monthName, el.month, el.ticketDate, el.done);

  let s: BookingState = initialState();
  let shownLeft = seatLimit(cfg, null);
  let shownGrid = shownLeft;
  let sliding = false;
  let sending = false;
  let isoByLabel: Record<string, string> = {};
  // with a backend, the placeholder month can't be used until the real nights are in
  let nightsReady = !cfg.api;
  // the placeholder nights already gone leave the calendar, and a month with none left goes too
  // (the real ones start from today)
  const past = cfg.api ? new Set<string>() : pastLabels(cfg.months);
  if (past.size) cfg.months = cfg.months.map((m) => ({ ...m, nights: m.nights.filter((n) => !past.has(n[0])) })).filter((m) => m.nights.length);
  // every placeholder night gone (the placeholders run out): an empty month and the 'no nights' line
  const noneLeft = !cfg.months.length;
  if (noneLeft) cfg.months = [{ name: new Date().toLocaleString('en-GB', { month: 'long' }), nights: [] }];
  // the note pointing back up to the nights, once someone has scrolled on without one
  let asked = false;
  // what was last read out, so a render that changes nothing says nothing
  let spoken = '';
  // the page's own signal, plus a time limit, so a backend that never answers ends in the error message
  // (by hand: AbortSignal.any over AbortSignal.timeout never fired in WebKit when tried)
  const timed = () => {
    const c = new AbortController();
    later(() => c.abort(), TIMEOUT_MS);
    ac.signal.addEventListener('abort', () => c.abort(), { once: true });
    return c.signal;
  };

  /** Bring every dependent piece of the page in line with the state. */
  const render = () => {
    const v = view(s, cfg);
    root.setAttribute('data-waitlist', String(v.waitlist));
    el.monthName.textContent = v.monthName;
    el.clip.inert = !nightsReady;
    el.prev.disabled = !v.hasPrev || !nightsReady;
    el.next.disabled = !v.hasNext || !nightsReady;
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
    if (v.limit !== shownLeft) { el.seatOptions.innerHTML = seatOptionsHtml(v.limit, s.seats, cfg.copy); shownLeft = v.limit; }
    qa('[data-seat]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.seat) === s.seats)));
    // a step that is not open yet is out of reach (keyboard and screen readers too), and so is the button until the request is complete
    el.gates.forEach((g, i) => { g.setAttribute('data-live', String(v.gates[i])); g.inert = !v.gates[i]; });
    // the button stays reachable when it can't send yet: pressing it shows what is missing (guide)
    qa<HTMLButtonElement>('[data-confirm]').forEach((b) => b.setAttribute('aria-disabled', String(!v.canHold)));
    el.ticketDate.textContent = v.ticketDate;
    el.ticketLine.textContent = v.ticketLine;
    el.holdWrap.setAttribute('data-can', String(v.canHold));
    el.doneHead.textContent = v.doneHead;
    el.doneBody.textContent = v.doneBody;
    el.cake.hidden = !v.showCake;
    el.cakeBox.checked = s.cake;
    root.setAttribute('data-ask', String(asked && !s.date && !s.done));
    el.holdMissing.textContent = v.missing;
    el.holdMissing.hidden = !v.missing;
    if (v.limit !== shownGrid) { el.seatOptions.setAttribute('style', seatGridStyle(v.limit)); shownGrid = v.limit; }
    // a change of night or seats is read out (the ticket says it all)
    const say = s.date ? `${v.ticketDate}. ${v.ticketLine}` : '';
    if (say !== spoken) { spoken = say; el.announce.textContent = say; }
  };

  const resolve = (target: HTMLElement) => gsap.fromTo(target, { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: E });
  const scrollToEl = (target: HTMLElement, offset: number, ms: number) =>
    later(() => scrollToY(target.getBoundingClientRect().top + window.scrollY - offset, reducedMotion ? 0 : 1.4), ms);

  // a choice lands: the ticket value resolves through blur, the next step opens and the page moves to it
  function pick<K extends 'date' | 'seats'>(key: K, val: BookingState[K]) {
    if (s.done) return;
    const prev = s[key];
    const patch: Partial<BookingState> = { [key]: val };
    // a night with fewer seats open keeps as many of yours as it can, and says so
    const cap = key === 'date' ? seatLimit(cfg, val as string) : Infinity;
    const capped = s.seats > cap;
    if (capped) patch.seats = cap;
    const firstTime = prev === null || prev === 0;
    showError('');
    const wasLive = el.gates.map((g) => g.dataset.live === 'true');
    s = { ...s, ...patch };
    render();
    if (capped) el.announce.textContent = fill(cfg.copy.seatsCapped, { seats: cap });
    // on phones a step only appears once it is open: bring it in, and let the page re-measure
    if (isMobile()) {
      el.gates.forEach((g, i) => { if (!wasLive[i] && g.dataset.live === 'true') gsap.fromTo(g.children, { opacity: 0, y: 14, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.25, ease: E, stagger: 0.06 }); });
      ScrollTrigger.refresh();
    }
    if (key === 'date') {
      el.after.setAttribute('data-live', 'true');
      el.after.inert = false;
      // the first time, the ticket rises with its column as it is scrolled to; after that it resolves in place
      if (!firstTime || isMobile()) resolve(el.ticketDate);
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
    // the nights can't be hovered or picked until the new month has nearly landed
    root.setAttribute('data-sliding', '');
    later(() => root.removeAttribute('data-sliding'), reducedMotion ? 0 : 1550);
    gsap.to(el.monthName, { opacity: 0, filter: 'blur(6px)', y: -8, duration: 0.4, ease: 'power2.in' });
    gsap.to(el.month, {
      xPercent: -12 * dir, opacity: 0, filter: 'blur(4px)', duration: 0.7, ease: 'expo.inOut',
      onComplete: () => {
        s = { ...s, month: nextMonth };
        fillMonth();
        render();
        // an arrow that has just been hidden (the last month) can't keep the focus: the other one takes it
        const active = document.activeElement as HTMLButtonElement | null;
        if (active?.disabled && (active === el.prev || active === el.next)) (active === el.next ? el.prev : el.next).focus();
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
    el.month.toggleAttribute('data-dense', n > 12);
  };

  const showError = (msg: string) => { el.holdError.textContent = msg; el.holdError.hidden = !msg; };

  // ---- the real nights, from the booking backend
  // until they are (and for good if they fail or there are none), the placeholder month stays faded and inert
  async function loadNights() {
    root.setAttribute('data-nights', 'loading');
    render();
    el.nightLine.textContent = cfg.copy.loadingNights;
    try {
      const res = await fetch(cfg.api, { signal: timed() });
      const data: { nights: ApiNight[] } = await res.json();
      const built = monthsFromNights(data.nights ?? []);
      if (!built.months.length) {
        root.setAttribute('data-nights', 'none');
        el.nightLine.textContent = fill(cfg.copy.noNights, { contact: cfg.contactEmail });
        return;
      }
      cfg.months = built.months;
      isoByLabel = built.isoByLabel;
      nightsReady = true;
      root.removeAttribute('data-nights');
      s = { ...s, month: 0, date: null, seats: 0 };
      fillMonth();
      render();
      drawMarks(root, 0.1, 0.03, 0.02);
    } catch (err) {
      if (ac.signal.aborted) return;
      root.setAttribute('data-nights', 'none');
      el.nightLine.textContent = fill(cfg.copy.loadError, { contact: cfg.contactEmail });
    }
  }

  // ---- not ready to send: go to what is missing (the seats, or the first detail), marked as such
  const fieldEl = (f: string) => q<HTMLInputElement>(`[data-field="${f}"]`);
  const markInvalid = (f: ContactField) => {
    const input = fieldEl(f);
    input.setAttribute('aria-invalid', String(!fieldOk(s, f)));
  };
  function guide(from?: ContactField | 'note') {
    if (s.done) return;
    if (!s.seats) return void root.querySelector<HTMLElement>('[data-seat]')?.focus();
    const missing = missingFields(s);
    missing.forEach((f) => { if (fieldEl(f).value) markInvalid(f); });
    // the next missing detail after the one Enter was pressed in, else the first
    const order = from ? CONTACT.indexOf(from as ContactField) : -1;
    const next = missing.find((f) => CONTACT.indexOf(f) > order) ?? missing[0];
    if (next) fieldEl(next).focus();
  }

  // ---- sending the request
  async function confirm() {
    if (s.done || sending) return;
    if (!view(s, cfg).canHold) return guide();
    if (!cfg.api) return showDone();
    const v = view(s, cfg);
    // a night not from the backend (the placeholders) can't be sent
    const date = isoByLabel[s.date ?? ''];
    if (!date) return showError(fill(cfg.copy.sendError, { contact: cfg.contactEmail }));
    sending = true;
    el.holdWrap.setAttribute('data-sending', 'true');
    el.holdWrap.setAttribute('aria-busy', 'true');
    showError('');
    try {
      // text/plain keeps this a simple request, which Apps Script accepts from another site
      const res = await fetch(cfg.api, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: timed(),
        body: JSON.stringify({
          type: v.waitlist ? 'waitlist' : 'booking', date, seats: s.seats,
          name: s.name, whatsapp: s.whatsapp, email: s.email, occasion: s.occasion, cake: s.cake, note: s.note,
          website: el.honeypot.value,
        }),
      });
      const out: { ok: boolean; reason?: string; left?: number; type?: 'booking' | 'waitlist'; cardUrl?: string | null } = await res.json();
      // only ever send the guest on to Stripe's own card page (or the local test backend's stand-in)
      const toCard = !!out.cardUrl && (out.cardUrl.startsWith('https://checkout.stripe.com/') || (cfg.api.startsWith('http://localhost') && out.cardUrl.startsWith('http://localhost')));
      if (out.ok && toCard && out.cardUrl) {
        try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ date: s.date, seats: s.seats })); } catch {}
        window.location.href = out.cardUrl;
        return;
      }
      // the night filled while the guest was choosing: the backend took it as a waitlist request, so the
      // page marks the night full and thanks them for joining the waitlist
      if (out.ok && out.type === 'waitlist' && !v.waitlist) {
        const night = cfg.months.flatMap((m) => m.nights).find((n) => n[0] === s.date);
        if (night) { night[1] = 0; fillMonth(); }
      }
      if (out.ok) return showDone();
      // the night changed while the guest was choosing: the calendar takes the backend's word for it
      const chosen = s.date ?? '';
      if (out.reason === 'not_enough') {
        const night = cfg.months.flatMap((m) => m.nights).find((n) => n[0] === chosen);
        if (night) { night[1] = out.left ?? 0; fillMonth(); render(); }
        showError(fill(cfg.copy.notEnough, { left: out.left ?? 0, date: chosen }));
      } else if (out.reason === 'closed') {
        cfg.months.forEach((m) => { m.nights = m.nights.filter((n) => n[0] !== chosen); });
        s = { ...s, date: null };
        fillMonth();
        render();
        showError(fill(cfg.copy.nightClosed, { date: chosen }));
      }
      else showError(fill(cfg.copy.sendError, { contact: cfg.contactEmail }));
    } catch (err) {
      if (!ac.signal.aborted) showError(fill(cfg.copy.sendError, { contact: cfg.contactEmail }));
    } finally {
      sending = false;
      el.holdWrap.removeAttribute('data-sending');
      el.holdWrap.removeAttribute('aria-busy');
    }
  }

  /** The form gives way to the thank-you message, and the page goes up to it: the calendar is done with. */
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
        root.setAttribute('data-done', '');
        el.done.style.display = 'flex';
        ScrollTrigger.refresh();
        scrollToY(0, reducedMotion ? 0 : 1.2);
        // focus moves to the heading so a screen reader reads the confirmation out
        el.doneHead.focus({ preventScroll: true });
        gsap.fromTo(el.done.children, { opacity: 0, y: 18, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.25, ease: E, stagger: 0.1 });
      },
    });
  }

  // ---- the steps and the ticket rise into place as they are scrolled to
  // (phones bring each step in as it appears, in pick())
  if (!reducedMotion && !isMobile()) {
    qa('[data-after] [data-gate], [data-after] aside > *').filter((step) => step.children.length).forEach((step) => {
      ScrollTrigger.create({
        trigger: step, start: 'top 88%', once: true,
        onEnter: () => gsap.fromTo(step.children, { opacity: 0, y: 14, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.25, ease: E, stagger: 0.06 }),
      });
    });
  }

  // ---- scrolled on without a night: a note under the month points back up to it
  // (not on the way back from Stripe, where there is nothing left to choose)
  const back = new URLSearchParams(window.location.search);
  if (!back.get('request')) {
    ScrollTrigger.create({
      trigger: isMobile() ? el.pickFirst : el.after, start: isMobile() ? 'top 80%' : 'top 70%',
      onEnter: () => { asked = true; render(); },
    });
  }
  // up to the nights, and the focus with it (on the chosen night or the first)
  el.pickFirst.addEventListener('click', () => {
    scrollToY(el.clip.getBoundingClientRect().top + window.scrollY - (isMobile() ? 200 : 260), reducedMotion ? 0 : 1.4);
    (root.querySelector<HTMLElement>('[data-night][aria-pressed="true"]') ?? root.querySelector<HTMLElement>('[data-night]'))?.focus({ preventScroll: true });
  }, { signal: ac.signal });

  // ---- input
  let swallow = false;
  root.addEventListener('click', (e) => {
    const t = e.target as Element;
    const night = t.closest<HTMLElement>('[data-night]');
    if (night?.hasAttribute('data-closed')) return; // a closed night isn't a choice
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

  // Enter in a detail: send when everything is in, otherwise on to the next detail still missing
  root.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.key !== 'Enter' || e.isComposing || !t.matches('input[data-field]')) return;
    e.preventDefault();
    if (view(s, cfg).canHold) return void confirm();
    guide(t.dataset.field as ContactField | 'note');
  }, { signal: ac.signal });
  // a required detail left filled in wrongly is marked as such; set right, the mark goes
  root.addEventListener('focusout', (e) => {
    const f = (e.target as HTMLElement).dataset?.field;
    if (f && (CONTACT as readonly string[]).includes(f) && fieldEl(f).value) markInvalid(f as ContactField);
  }, { signal: ac.signal });

  root.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    showError('');
    if (t.matches('[data-cake-box]')) { s = { ...s, cake: t.checked }; render(); return; }
    const f = t.dataset.field as 'name' | 'email' | 'whatsapp' | 'occasion' | 'note' | undefined;
    if (!f) return;
    s = { ...s, [f]: t.value };
    if ((CONTACT as readonly string[]).includes(f) && t.getAttribute('aria-invalid') === 'true' && fieldOk(s, f as ContactField)) t.setAttribute('aria-invalid', 'false');
    // the cake belongs to a birthday; changing the occasion takes it away
    if (f === 'occasion' && t.value !== 'birthday') s.cake = false;
    render();
  }, { signal: ac.signal });

  // ---- back from Stripe, or load the real nights
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
  } else if (noneLeft) {
    root.setAttribute('data-nights', 'none');
    fillMonth();
    render();
    el.nightLine.textContent = fill(cfg.copy.noNights, { contact: cfg.contactEmail });
  } else if (past.size) {
    fillMonth();
    render();
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
