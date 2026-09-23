/**
 * Booking logic and markup, shared by the server render (src/components/reserve) and the
 * browser (src/scripts/systems/booking.ts), so the first paint and every update come from
 * the same code.
 *
 * Nothing here talks to a backend yet: "Hold the seats" only shows the confirmation.
 * When a booking system exists, availability replaces `months` and confirm() posts.
 */
import type { Night, ReserveContent } from '../content/reserve';
import type { Pricing } from '../content/types';
import { fill, money } from './format';

export interface BookingConfig {
  months: ReserveContent['months'];
  seatWords: string[];
  copy: ReserveContent['copy'];
  pricing: Pricing;
  contactEmail: string;
}

export type MenuChoice = 'meat' | 'fish';
export type Pairing = 0 | 4 | 5;

export interface BookingState {
  month: number;
  date: string | null;
  seats: number;
  menu: MenuChoice | null;
  pairing: Pairing | null;
  name: string;
  email: string;
  phone: string;
  note: string;
  done: boolean;
}

export const initialState = (): BookingState => ({
  month: 0, date: null, seats: 0, menu: null, pairing: null, name: '', email: '', phone: '', note: '', done: false,
});

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export const TABLE = 16;

export const allNights = (cfg: Pick<BookingConfig, 'months'>): Night[] => cfg.months.flatMap((m) => m.nights);

export const openOn = (cfg: Pick<BookingConfig, 'months'>, date: string | null) =>
  date ? (allNights(cfg).find((n) => n[0] === date)?.[1] ?? TABLE) : TABLE;

/** One night: a column of marks (one per open seat, yours drawn longer), the weekday and the day. */
export function nightHtml([label, open]: Night, state: Pick<BookingState, 'date' | 'seats'>) {
  const pressed = state.date === label;
  const mine = pressed ? state.seats : 0;
  const [dow, day] = label.split(' ');
  const marks = Array.from({ length: open }, (_, i) => `<span class="mk" data-mine="${i < mine}"></span>`).join('');
  const aria = `${label}, ${open === 0 ? 'full' : open === TABLE ? 'the whole table open' : `${open} of ${TABLE} seats open`}`;
  return `<button type="button" data-night data-label="${esc(label)}" class="nt" aria-pressed="${pressed}" aria-label="${esc(aria)}"${open === 0 ? ' disabled' : ''} draggable="false" style="display:flex;flex-direction:column;justify-content:flex-end;gap:18px;background:none;border:0;padding:0 0 20px;cursor:pointer;user-select:none;text-align:left;color:inherit;min-width:0;height:100%">`
    + `<span data-marks style="display:flex;flex-direction:column;gap:6px;align-items:flex-start">${marks}</span>`
    + `<span style="display:flex;flex-direction:column;gap:6px"><span class="num" style="font-size:12px;color:inherit;opacity:.6">${esc(dow.slice(0, 3))}</span><span style="font:300 clamp(20px,2vw,32px)/1 var(--font-display);letter-spacing:-.02em;color:inherit;font-variant-numeric:tabular-nums">${esc(day)}</span></span>`
    + `</button>`;
}

export const monthHtml = (cfg: Pick<BookingConfig, 'months'>, state: BookingState) =>
  cfg.months[state.month].nights.map((n) => nightHtml(n, state)).join('');

/** One button per seat still open on the chosen night (all sixteen before a night is picked). */
export const seatOptionsHtml = (left: number, seats: number) =>
  Array.from({ length: left }, (_, i) => `<button type="button" class="ch" data-seat="${i + 1}" aria-pressed="${seats === i + 1}" style="font:300 clamp(24px,2.4vw,40px)/1 var(--font-display);letter-spacing:-.02em;font-variant-numeric:tabular-nums">${i + 1}</button>`).join('');

export const canHold = (s: BookingState) => s.pairing !== null && s.name.trim().length > 1 && /.+@.+\..+/.test(s.email);

/** Every sentence and figure on the page that depends on the booking so far. */
export function view(s: BookingState, cfg: BookingConfig) {
  const { copy, pricing, seatWords, months } = cfg;
  const left = openOn(cfg, s.date);
  const seatPhrase = (n: number) => fill(n > 1 ? copy.seatMany : copy.seatOne, { Seats: seatWords[n - 1] });
  const perGuest = pricing.menu + (s.pairing === 4 ? pricing.pairingFour : s.pairing === 5 ? pricing.pairingFive : 0);
  const seats = Math.max(1, s.seats);
  const deposit = pricing.menu * pricing.depositShare * seats;
  const rest = perGuest * seats - deposit;
  const cur = pricing.currency;

  const ticketParts = s.seats
    ? [
        seatPhrase(s.seats),
        s.menu ? (s.menu === 'meat' ? copy.menuMeat : copy.menuFish) : null,
        s.pairing === null ? null : s.pairing === 0 ? copy.withoutWine : s.pairing === 4 ? copy.fourGlasses : copy.fiveGlasses,
      ].filter(Boolean)
    : [];

  return {
    left,
    monthName: months[s.month].name,
    prevName: s.month > 0 ? months[s.month - 1].name : '',
    nextName: s.month < months.length - 1 ? months[s.month + 1].name : '',
    hasPrev: s.month > 0,
    hasNext: s.month < months.length - 1,
    seatsLeftLine: s.date ? fill(left === TABLE ? copy.wholeTableOpen : copy.someSeatsOpen, { date: s.date, left }) : copy.pickFirst,
    nightLine: s.date ? fill(left === TABLE ? copy.nightLineWhole : copy.nightLineSome, { date: s.date, left }) : '',
    ticketDate: s.date || copy.datePlaceholder,
    ticketLine: s.seats ? `${ticketParts.join(', ')}.` : copy.ticketEmpty,
    deposit: money(s.seats ? deposit : pricing.menu * pricing.depositShare, cur),
    remainder: s.seats ? fill(s.pairing ? copy.remainderWithPairing : copy.remainder, { amount: money(rest, cur) }) : copy.remainderEmpty,
    gates: [!!s.date, s.seats > 0, s.menu !== null, s.pairing !== null],
    canHold: canHold(s) && !s.done,
    doneHead: s.done && s.seats ? fill(copy.doneHead, { seats: seatPhrase(s.seats), date: s.date ?? '' }) : '',
    doneBody: s.done ? fill(copy.doneBody, { email: s.email, contact: cfg.contactEmail }) : '',
  };
}
