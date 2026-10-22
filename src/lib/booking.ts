/**
 * Booking logic and markup, shared by the server render (src/components/reserve) and the
 * browser (src/scripts/systems/booking.ts), so the first paint and every update come from
 * the same code.
 *
 * With `api` set (PUBLIC_BOOKING_API, the Apps Script web app inside the reservations sheet), the
 * browser loads the real nights from it and sends requests to it. Without it the page runs on the
 * placeholder `months` and "Request the seats" only shows the thank-you message.
 * Nothing is paid at booking; a saved card holds the seats (see docs/booking.md).
 *
 * A full night is not a dead end: picking it turns the booking into a waitlist request.
 
 */
import type { Night, Occasion, ReserveContent } from '../content/reserve';
import { fill } from './format';
import { site } from '../content/site';

export interface BookingConfig {
  months: ReserveContent['months'];
  seatWords: string[];
  copy: ReserveContent['copy'];
  occasions: Record<Occasion, string>;
  /** The most seats one online request can take (reserve.onlineMax). */
  onlineMax: number;
  contactEmail: string;
  /** The booking backend's web address; empty runs the page on placeholder data. */
  api: string;
}

/** A night as the booking backend sends it; `capacity` is that night's seats (16, or 14 on Saturdays). */
export interface ApiNight { date: string; left: number; capacity?: number }

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The backend's nights grouped into months and labelled the way the page writes them
 * ("Monday 5 October"), with each label's ISO date for sending the request back.
 */
export function monthsFromNights(nights: ApiNight[]) {
  const months: ReserveContent['months'] = [];
  const isoByLabel: Record<string, string> = {};
  for (const n of nights) {
    const [y, m, d] = n.date.split('-').map(Number);
    const label = `${WEEKDAYS[new Date(y, m - 1, d).getDay()]} ${d} ${MONTH_NAMES[m - 1]}`;
    isoByLabel[label] = n.date;
    let month = months[months.length - 1];
    if (!month || month.name !== MONTH_NAMES[m - 1]) months.push((month = { name: MONTH_NAMES[m - 1], nights: [] }));
    month.nights.push(n.capacity ? [label, n.left, n.capacity] : [label, n.left]);
  }
  return { months, isoByLabel };
}

/**
 * The placeholder nights that have already gone, so they can't be picked. Their labels carry no
 * year: they are read as running on from this year, into the next when the months turn over.
 */
export function pastLabels(months: ReserveContent['months'], today = new Date()) {
  const past = new Set<string>();
  const now = today.getFullYear() * 1e4 + (today.getMonth() + 1) * 100 + today.getDate();
  let year = today.getFullYear(), last = 0;
  for (const [label] of months.flatMap((m) => m.nights)) {
    const [, day, name] = label.split(' ');
    const month = MONTH_NAMES.indexOf(name) + 1;
    if (month < last) year++;
    last = month;
    if (year * 1e4 + month * 100 + Number(day) < now) past.add(label);
  }
  return past;
}

export interface BookingState {
  month: number;
  date: string | null;
  seats: number;
  name: string;
  email: string;
  whatsapp: string;
  occasion: Occasion | '';
  /** Only offered for a birthday. */
  cake: boolean;
  note: string;
  done: boolean;
}

export const initialState = (): BookingState => ({
  month: 0, date: null, seats: 0, name: '', email: '', whatsapp: '', occasion: '', cake: false, note: '', done: false,
});

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** Seats at the table when a night says nothing else (Saturdays say 14). */
export const TABLE = site.service.seats;

export const allNights = (cfg: Pick<BookingConfig, 'months'>): Night[] => cfg.months.flatMap((m) => m.nights);

const nightOf = (cfg: Pick<BookingConfig, 'months'>, date: string | null) => (date ? allNights(cfg).find((n) => n[0] === date) : undefined);

/** Seats that night: the whole table. */
export const capacityOn = (cfg: Pick<BookingConfig, 'months'>, date: string | null) => nightOf(cfg, date)?.[2] ?? TABLE;

export const openOn = (cfg: Pick<BookingConfig, 'months'>, date: string | null) =>
  date ? (nightOf(cfg, date)?.[1] ?? capacityOn(cfg, date)) : TABLE;

/** A full night takes waitlist requests instead of bookings. */
export const isWaitlist = (cfg: Pick<BookingConfig, 'months'>, date: string | null) => !!date && openOn(cfg, date) === 0;

/** How many seats can be asked for: what is open (or the whole table on the waitlist), up to the online maximum. */
export const seatLimit = (cfg: Pick<BookingConfig, 'months' | 'onlineMax'>, date: string | null) =>
  Math.min(cfg.onlineMax, isWaitlist(cfg, date) ? capacityOn(cfg, date) : openOn(cfg, date));

/**
 * One night: a column of marks (one per open seat, yours drawn longer), the weekday and the day.
 * A full night has no marks; it carries the waitlist label instead and can still be picked.
 * A night already gone (`past`) stays in its place but can't be picked.
 */
export function nightHtml([label, open, capacity = TABLE]: Night, state: Pick<BookingState, 'date' | 'seats'>, waitlistLabel = 'Waitlist', past = false) {
  const pressed = state.date === label;
  const mine = pressed ? state.seats : 0;
  const [dow, day] = label.split(' ');
  const marks = open === 0
    ? `<span class="nt-wait">${esc(waitlistLabel)}</span>`
    : Array.from({ length: open }, (_, i) => `<span class="mk" data-mine="${i < mine}"></span>`).join('');
  const aria = `${label}, ${open === 0 ? 'full, join the waitlist' : open === capacity ? 'the whole table open' : `${open} of ${capacity} seats open`}`;
  return `<button type="button" data-night data-label="${esc(label)}" class="nt" aria-pressed="${pressed}" aria-label="${esc(aria)}"${open === 0 ? ' data-full' : ''}${past ? ' disabled' : ''} draggable="false" style="display:flex;flex-direction:column;justify-content:flex-end;gap:18px;background:none;border:0;padding:0 0 20px;cursor:pointer;user-select:none;text-align:left;color:inherit;min-width:0;height:100%">`
    + `<span data-marks style="display:flex;flex-direction:column;gap:6px;align-items:flex-start">${marks}</span>`
    + `<span style="display:flex;flex-direction:column;gap:6px"><span class="num" style="font-size:12px;color:inherit;opacity:.6">${esc(dow.slice(0, 3))}</span><span style="font:300 clamp(20px,2vw,32px)/1 var(--font-display);letter-spacing:-.02em;color:inherit;font-variant-numeric:tabular-nums">${esc(day)}</span></span>`
    + `</button>`;
}

export const monthHtml = (cfg: Pick<BookingConfig, 'months' | 'copy'>, state: BookingState, past: ReadonlySet<string> = new Set()) =>
  cfg.months[state.month].nights.map((n) => nightHtml(n, state, cfg.copy.waitlistMark, past.has(n[0]))).join('');

/** One button per seat that can be asked for (seatLimit), named "1 seat", "2 seats"… for screen readers. */
export const seatOptionsHtml = (left: number, seats: number, copy: Pick<BookingConfig['copy'], 'seatOne' | 'seatMany'>) =>
  Array.from({ length: left }, (_, i) => `<button type="button" class="ch" data-seat="${i + 1}" aria-pressed="${seats === i + 1}" aria-label="${esc(fill(i ? copy.seatMany : copy.seatOne, { Seats: i + 1 }))}" style="font:300 clamp(24px,2.4vw,40px)/1 var(--font-display);letter-spacing:-.02em;font-variant-numeric:tabular-nums">${i + 1}</button>`).join('');

// the team finalises every booking on WhatsApp, so a number is required
const hasContact = (s: BookingState) =>
  s.name.trim().length > 1 && /.+@.+\..+/.test(s.email) && s.whatsapp.replace(/\D/g, '').length >= 7;

/** A booking or a waitlist request needs seats and contact details. */
export const canHold = (s: BookingState) => s.seats > 0 && hasContact(s);

/** Every sentence and figure on the page that depends on the booking so far. */
export function view(s: BookingState, cfg: BookingConfig) {
  const { copy, seatWords, months } = cfg;
  const left = openOn(cfg, s.date);
  const capacity = capacityOn(cfg, s.date);
  const waitlist = isWaitlist(cfg, s.date);
  // past the words there are (sixteen), a number is written as a number
  const word = (n: number) => seatWords[n - 1] ?? String(n);
  const seatPhrase = (n: number) => fill(n > 1 ? copy.seatMany : copy.seatOne, { Seats: word(n) });
  const cake = s.occasion === 'birthday' && s.cake;
  const extras = [s.occasion ? cfg.occasions[s.occasion].toLowerCase() : '', cake ? copy.withCake : ''].filter(Boolean);

  return {
    left,
    waitlist,
    limit: seatLimit(cfg, s.date),
    monthName: months[s.month].name,
    prevName: s.month > 0 ? months[s.month - 1].name : '',
    nextName: s.month < months.length - 1 ? months[s.month + 1].name : '',
    hasPrev: s.month > 0,
    hasNext: s.month < months.length - 1,
    seatsLeftLine: s.date ? fill(waitlist ? copy.waitlistSeats : left === capacity ? copy.wholeTableOpen : copy.someSeatsOpen, { date: s.date, left, capacity: word(capacity).toLowerCase() }) : copy.pickFirst,
    nightLine: s.date ? fill(waitlist ? copy.nightLineFull : left === capacity ? copy.nightLineWhole : copy.nightLineSome, { date: s.date, left, capacity: word(capacity).toLowerCase() }) : '',
    ticketDate: s.date || copy.datePlaceholder,
    ticketLine: waitlist
      ? (s.seats ? fill(copy.waitlistTicket, { seats: seatPhrase(s.seats).toLowerCase() }) : copy.waitlistTicketEmpty)
      : s.seats ? `${[seatPhrase(s.seats), ...extras].join(', ')}.` : copy.ticketEmpty,
    showCake: s.occasion === 'birthday',
    // which steps are awake: seats, then your details
    gates: [!!s.date, s.seats > 0],
    canHold: canHold(s) && !s.done,
    // back from Stripe in a tab that no longer remembers the night, the heading says only that it is requested
    doneHead: !s.done ? '' : s.seats && s.date ? fill(waitlist ? copy.waitlistDoneHead : copy.doneHead, { seats: seatPhrase(s.seats), date: s.date }) : copy.doneHeadShort,
    doneBody: s.done ? fill(waitlist ? copy.waitlistDoneBody : copy.doneBody, { email: s.email, contact: cfg.contactEmail }) : '',
  };
}
