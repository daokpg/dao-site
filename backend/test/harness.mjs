// Runs backend/booking.gs in Node with fake Google services, on the structure of the real October
// board (dates, guests per table and total formulas only: board-october.json holds no guest details).
//   node backend/test/harness.mjs test    → runs the checks
//   node backend/test/harness.mjs serve   → serves doGet/doPost on :4323 (CORS like Apps Script);
//     build the site with PUBLIC_BOOKING_API=http://localhost:4323 to try it end to end
// The checks expect the October 2026 nights to be in the future; refresh the fixture after that.
// The script runs in UTC while the sheet is in Bangkok, as when a project's own time zone was never
// set: a night read with getDay() instead of through the sheet's time zone lands on the day before.
process.env.TZ = 'UTC';
import fs from 'node:fs';
import vm from 'node:vm';
import http from 'node:http';
import crypto from 'node:crypto';

const GS = fs.readFileSync(new URL('../booking.gs', import.meta.url), 'utf8');
const fixture = JSON.parse(fs.readFileSync(new URL('./board-october.json', import.meta.url), 'utf8'));
const log = [];

// ---------- fake spreadsheet
const chain = new Proxy({}, { get: (t, k) => (k === 'build' ? () => ({}) : () => chain) });
function makeSheet(name, rows = []) {
  const sh = { name, data: rows, merges: [], formulas: {} };
  const cell = (r, c) => { while (sh.data.length < r) sh.data.push([]); return sh.data[r - 1][c - 1]; };
  const set = (r, c, v) => { while (sh.data.length < r) sh.data.push([]); sh.data[r - 1][c - 1] = v; };
  const range = (r, c, nr = 1, nc = 1) => { const rg = new Proxy({
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => cell(r + i, c + j) ?? '')),
    setValues: (v) => v.forEach((row, i) => row.forEach((x, j) => set(r + i, c + j, x))),
    setValue: (v) => set(r, c, v),
    clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { set(r + i, c + j, ''); delete sh.formulas[`${r + i},${c + j}`]; } return chain; },
    getFormula: () => sh.formulas[`${r},${c}`] || '',
    setFormula: (f) => { sh.formulas[`${r},${c}`] = f; },
    getMergedRanges: () => sh.merges.filter(([a, b]) => a <= r + nr - 1 && b >= r).map(([a, b]) => ({ getRow: () => a, getLastRow: () => b })),
  }, { get: (t, k) => { const f = t[k]; if (f) return (...a) => { const out = f(...a); return out === undefined ? rg : out; }; return () => rg; } }); return rg; };
  return Object.assign(sh, {
    getName: () => name,
    getLastRow: () => { if (sh.lastRow) return sh.lastRow; for (let i = sh.data.length; i > 0; i--) if ((sh.data[i - 1] || []).some((v) => v !== '' && v != null)) return i; return 0; },
    getRange: (a, b, c, d) => {
      if (typeof a !== 'string') return range(a, b, c, d);
      // A1 cells and blocks like 'J2' or 'I1:J3'; open-ended ranges ('B2:B') are formatting only
      const m = /^([A-Z])(\d+)(?::([A-Z])(\d+))?$/.exec(a);
      if (!m) return chain;
      const col = (l) => l.charCodeAt(0) - 64;
      return range(+m[2], col(m[1]), m[4] ? +m[4] - +m[2] + 1 : 1, m[3] ? col(m[3]) - col(m[1]) + 1 : 1);
    },
    appendRow: (v) => { const r = sh.getLastRow() + 1; v.forEach((x, j) => set(r, j + 1, x)); },
    setFrozenRows: () => chain, setRowHeight: () => chain, setColumnWidth: () => chain, setConditionalFormatRules: () => chain,
  });
}
const sheets = [];
let SDate = Date; // replaced by the sandbox's Date below, so instanceof Date holds inside the script
function loadFixture() {
for (const [name, t] of Object.entries(fixture)) {
  const sh = makeSheet(name);
  // a date cell holds midnight in the sheet's time zone (Bangkok, UTC+7)
  t.A.forEach((a, i) => { if (a) { const [y, m, d] = a.split('-').map(Number); sh.data[i] = sh.data[i] || []; sh.data[i][0] = new SDate(SDate.UTC(y, m - 1, d) - 7 * 36e5); } });
  t.C.forEach((c, i) => { sh.data[i] = sh.data[i] || []; if (typeof c === 'number') sh.data[i][2] = c; else if (c) sh.formulas[`${i + 1},3`] = c; });
  sh.merges = t.merges;
  sh.lastRow = t.rows; // the board has names and notes further right, so its last row is the sheet's
  sheets.push(sh);
}
}
const ss = {
  getSheets: () => [...sheets], getSheetByName: (n) => sheets.find((s) => s.name === n) || null,
  getSpreadsheetTimeZone: () => 'Asia/Bangkok', getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST', getId: () => 'TEST-COPY',
  insertSheet: (n, i) => { const s = makeSheet(n); sheets.splice(i, 0, s); return s; },
  deleteSheet: (s) => sheets.splice(sheets.indexOf(s), 1),
};

// ---------- fake services
const props = { NOTIFY_EMAIL: 'team@example.com' };
const stripeCalls = [];
let sessions = 0, sessionStatus = 'open', chargeFails = false;
const cache = new Map();
let locks = 0;
const ISO_DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ctx = {
  SpreadsheetApp: { getActive: () => ss, newDataValidation: () => chain, newConditionalFormatRule: () => chain },
  Utilities: {
    // in the time zone asked for, like Apps Script: yyyy, MM, dd, and u (1 = Monday … 7 = Sunday)
    formatDate: (d, tz, f) => {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d).map((x) => [x.type, x.value]));
      return f === 'u' ? String(ISO_DAYS.indexOf(p.weekday)) : f.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day);
    },
    getUuid: () => crypto.randomUUID(),
  },
  CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
  LockService: { getScriptLock: () => ({ waitLock: () => { locks++; }, tryLock: () => true, releaseLock: () => {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }) },
  ContentService: { createTextOutput: (s) => ({ body: s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
  MailApp: { sendEmail: (o) => log.push(['mail', o.subject]), getRemainingDailyQuota: () => 100 },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => chain },
  // a fake Stripe that records every call: customers, card pages (setup mode), and fee charges
  UrlFetchApp: {
    fetch: (url, o) => {
      const path = url.replace('https://api.stripe.com/v1/', '');
      stripeCalls.push({ path, method: o.method, payload: o.payload, key: o.headers['Idempotency-Key'] });
      log.push(['stripe', o.method, path.split('?')[0]]);
      let code = 200, body;
      if (path === 'customers') body = { id: 'cus_test' };
      else if (path === 'checkout/sessions') body = { id: 'cs_test_' + ++sessions, url: 'https://checkout.stripe.com/c/pay/cs_test_' + sessions };
      else if (path.startsWith('checkout/sessions/')) body = { status: sessionStatus, setup_intent: { payment_method: 'pm_test_1' } };
      else if (path === 'payment_intents') {
        if (chargeFails) { code = 402; body = { error: { code: 'authentication_required', message: 'This card needs the guest to approve the payment.' } }; }
        else body = { id: 'pi_test_' + stripeCalls.filter((c) => c.path === 'payment_intents').length, status: 'succeeded' };
      }
      return { getResponseCode: () => code, getContentText: () => JSON.stringify(body) };
    },
  },
  console,
};
vm.createContext(ctx);
// The checks are written against the October board as of 28 Sep 2026; pin "today" there so they
// keep passing as real dates go by. `serve` keeps the real clock.
if (process.argv[2] === 'test') {
  vm.runInContext(`const _D = Date; Date = class extends _D {
    constructor(...a) { if (a.length) super(...a); else super(2026, 8, 28, 12); }
    static now() { return new _D(2026, 8, 28, 12).getTime(); }
  };`, ctx);
}
vm.runInContext(GS, ctx);
SDate = vm.runInContext('Date', ctx);
loadFixture();

const Utilities_iso = (d) => ctx.Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
const post = (b) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(b) } }).body);
const get = () => JSON.parse(ctx.doGet().body);

if (process.argv[2] === 'test') {
  const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  ctx.addWebsiteTabs();
  ctx.refreshAvailability();
  const names = ss.getSheets().map((s) => s.name);
  assert(names.slice(0, 2).join() === 'inbox - new reservations,Availability', 'website tabs added first: ' + names.join(' | '));
  const nights = get().nights;
  const n = (d) => nights.find((x) => x.date === d);
  assert(nights.length > 15 && nights.every((x) => x.date >= '2026-09-28'), `${nights.length} nights from today on`);
  // the weekly schedule (beside the table) opens nights with no planning yet: Mon-Thu and Sat, 60 days ahead
  const sched = (d) => nights.find((x) => x.date === d);
  assert(sched('2026-11-05') && sched('2026-11-05').left === 16 && sched('2026-11-07').left === 14 && !sched('2026-11-06') && !sched('2026-11-08'), 'the schedule opens unplanned nights (Thu 5 and Sat 7 Nov), not Fridays or Sundays');
  assert(!sched('2026-11-27') && sched('2026-11-26'), 'the schedule stops 60 days ahead');
  assert(n('2026-10-05').left === 6, '5 Oct: 16 seats, 10 booked → 6 left (' + n('2026-10-05').left + ')');
  assert(n('2026-10-06').left === 2, '6 Oct: 16 seats, 14 booked → 2 left (' + n('2026-10-06').left + ')');
  assert(n('2026-10-17').left === 14, 'Sat 17 Oct: capacity 14, its weekday read in the sheet\'s time zone (' + n('2026-10-17').left + ')');
  assert(JSON.parse(fs.readFileSync(new URL('../appsscript.json', import.meta.url), 'utf8')).timeZone === 'Asia/Bangkok', 'the script\'s manifest sets Asia/Bangkok');
  const av = ss.getSheetByName('Availability');
  assert(locks === 1 && typeof av.data[1][4] === 'number' && !Object.keys(av.formulas).length, 'refresh holds the lock and writes seats left as numbers with the row');
  assert(!n('2026-10-09') && !n('2026-10-11'), 'no Friday or Sunday nights');
  // a "days ahead" cell formatted as a date (60 shown as 28 Feb 1900) falls back to 60, not to nothing
  av.data[2][9] = new SDate(1900, 1, 28);
  ctx.refreshAvailability();
  assert(get().nights.find((x) => x.date === '2026-11-26'), 'a days-ahead cell holding a date falls back to 60 days');
  av.data[2][9] = '';
  // nights added by hand stay (a Friday outside the schedule, and one beyond 60 days typed as text),
  // a capacity edit is kept, and Open = no closes one scheduled night
  const avRows = av.getLastRow();
  av.data[avRows] = [new SDate(SDate.UTC(2026, 10, 20) - 7 * 36e5), 'yes', 12];
  av.data[avRows + 1] = ['24/12/2026', '', ''];
  const tue = av.data.findIndex((row) => row[0] instanceof SDate && Utilities_iso(row[0]) === '2026-11-10');
  av.data[tue][1] = 'no';
  ctx.onEdit({ range: { getSheet: () => ({ getName: () => 'Availability' }) } });
  const after = get().nights;
  const m1 = after.find((x) => x.date === '2026-11-20'), m2 = after.find((x) => x.date === '2026-12-24');
  assert(m1 && m1.left === 12 && m2 && m2.left === 16 && after.length === nights.length + 1, 'hand-added nights kept (a Friday, and one typed as text), one scheduled night closed: ' + JSON.stringify([m1, m2]));
  assert(!after.find((x) => x.date === '2026-11-10'), 'Open = no takes a scheduled night off the website');
  assert(av.data.slice(1).every((row) => row[0] instanceof SDate) && av.data.some((row) => row[5] === 'not planned yet'), 'a night typed as text becomes a date, marked "not planned yet"');

  let r = post({ type: 'booking', date: '2026-10-06', seats: 3, name: 'Test Guest', whatsapp: '+66 81 234 5678' });
  assert(!r.ok && r.reason === 'not_enough' && r.left === 2, 'too many seats refused: ' + JSON.stringify(r));
  r = post({ type: 'booking', date: '2026-10-06', seats: 2, name: 'Test Guest', whatsapp: '+66 81 234 5678', occasion: 'birthday', cake: true });
  assert(r.ok && r.type === 'booking' && /^DAO-/.test(r.id) && !('cardUrl' in r), 'booking accepted, no card asked for: ' + JSON.stringify(r));
  const rq = ss.getSheetByName('inbox - new reservations');
  const row = rq.data[rq.getLastRow() - 1];
  assert(row.length === 19 && row[1] === 'Booking' && row[2] === 'New' && row[3] === 'not needed' && row[7] === 2 && row[11] === 'birthday' && row[12] === 'yes' && row[14] === r.id, 'request row written in the inbox, no card needed for 2: ' + JSON.stringify(row.slice(1, 16)));
  assert(get().nights.find((x) => x.date === '2026-10-06').left === 2, 'a New request does not take seats');
  r = post({ type: 'booking', date: '2026-10-05', seats: 1, name: 'X', whatsapp: '123' });
  assert(!r.ok && r.reason === 'bad_name', 'validation: ' + r.reason);
  r = post({ type: 'waitlist', date: '2026-10-21', seats: 12, name: 'Big Party', whatsapp: '+66 81 000 0012' });
  assert(!r.ok && r.reason === 'bad_seats', 'more than the online maximum (11) refused: ' + r.reason);
  // a double press is the same request
  const card = post({ type: 'booking', date: '2026-10-06', seats: 2, name: 'Test Guest', whatsapp: '+66812345678' });
  assert(card.ok && card.id === rq.data[1][14] && rq.getLastRow() === 2, 'a repeat gets the same request, nothing new written: ' + JSON.stringify(card));
  r = post({ type: 'booking', date: '2026-10-06', seats: 1, name: 'Test Guest', whatsapp: '+66 81 234 5678' });
  assert(r.ok && r.id !== card.id && rq.getLastRow() === 3, 'other seats on the same night are a new request');
  r = post({ type: 'waitlist', date: '2026-10-17', seats: 4, name: 'Wait Lister', whatsapp: '+972 50 000 0000' });
  assert(r.ok && r.type === 'waitlist' && !r.cardUrl, 'waitlist accepted without a card');
  r = post({ type: 'booking', date: '2026-10-09', seats: 2, name: 'Test Guest', whatsapp: '+66 81 234 5678' });
  assert(!r.ok && r.reason === 'closed', 'closed night refused');
  r = post({ website: 'spam', date: '2026-10-05' });
  assert(r.ok && rq.getLastRow() === 4, 'honeypot: fake OK, nothing written');
  const rows0 = rq.getLastRow();
  // the team places the guests on the board → seats count
  ss.getSheetByName('5-10/10').data[21][2] = 2; // a table on 6 Oct gets 2 guests
  ctx.onEdit({ range: { getSheet: () => ({ getName: () => '5-10/10' }) } });
  assert(get().nights.find((x) => x.date === '2026-10-06').left === 0, 'placed on the board → 6 Oct now full');
  // a booking for a night that has just filled becomes a waitlist request, without a card
  r = post({ type: 'booking', date: '2026-10-06', seats: 2, name: 'Late Guest', whatsapp: '+66 81 999 0000' });
  assert(r.ok && r.type === 'waitlist' && /^WL-/.test(r.id) && !r.cardUrl && rq.getLastRow() === rows0 + 1, 'a booking for a full night comes back as a waitlist request: ' + JSON.stringify(r));
  const late = post({ type: 'booking', date: '2026-10-06', seats: 2, name: 'Late Guest', whatsapp: '+66 81 999 0000' });
  assert(late.id === r.id && late.type === 'waitlist', 'its repeat says waitlist too');
  // abuse: guest text never becomes a formula, a repeat is the same request, a flood is refused
  r = post({ type: 'waitlist', date: '2026-10-05', seats: 1, name: '=HYPERLINK("https://evil.example","x")', whatsapp: '+1 555 0100', note: '-no nuts\n=IMAGE("x")' });
  const inj = rq.data[rq.getLastRow() - 1];
  assert(r.ok && inj[8].startsWith("'=") && inj[13].startsWith("'-"), 'formula-like text stored as text: ' + JSON.stringify([inj[8], inj[13]]));
  const rows = rq.getLastRow();
  const again = post({ type: 'waitlist', date: '2026-10-05', seats: 1, name: 'Again', whatsapp: '+1 (555) 0100' });
  assert(again.ok && again.id === r.id && rq.getLastRow() === rows, 'the same number for the same night is the same request');
  r = post({ type: 'waitlist', date: '2026-10-05', seats: 1, name: 'Bad\r\nBcc: x@y.z', whatsapp: '+1 555 0199' });
  const hdr = rq.data[rq.getLastRow() - 1][7];
  assert(r.ok && !/[\r\n]/.test(hdr), 'line breaks taken out of one-line fields: ' + JSON.stringify(hdr));
  // ten minutes counted in fixed blocks; a repeat is answered before it is counted
  const bucket = vm.runInContext("'posts:' + Math.floor(Date.now() / 6e5)", ctx);
  cache.set(bucket, '30');
  r = post({ type: 'waitlist', date: '2026-10-05', seats: 1, name: 'Flood', whatsapp: '+1 555 0142' });
  assert(!r.ok && r.reason === 'busy' && rq.getLastRow() === rows + 1, 'a flood is refused: ' + JSON.stringify(r));
  r = post({ type: 'waitlist', date: '2026-10-05', seats: 1, name: 'Again', whatsapp: '+1 555 0100' });
  assert(r.ok && r.id === again.id && cache.get(bucket) === '30', 'a repeat still gets its answer during a flood, and is not counted');
  cache.delete(bucket);
  assert(!stripeCalls.length, 'no Stripe call for bookings of 1 or 2 seats, or waitlists');

  // ---- cards: 3 seats or more save a card; the fee is charged from the inbox status
  const C = (name) => ['Received', 'Type', 'Status', 'Card', 'Fee', 'Missing guests', 'Night', 'Seats', 'Name', 'WhatsApp', 'Email', 'Special occasion', 'Cake', 'Note', 'Request ID', 'Team notes', 'Stripe customer', 'Stripe card', 'Stripe session'].indexOf(name);
  const rowOf = (id) => rq.data.find((x) => x && x[C('Request ID')] === id);
  // without a Stripe key the booking still arrives, marked for the team
  r = post({ type: 'booking', date: '2026-10-05', seats: 3, name: 'No Key', whatsapp: '+66 80 000 0003' });
  assert(r.ok && !r.cardUrl && rowOf(r.id)[C('Card')] === 'missing' && /not set up/.test(rowOf(r.id)[C('Team notes')]) && !stripeCalls.length, 'without a Stripe key: request saved, Card = missing, no card page');
  props.STRIPE_SECRET_KEY = 'rk_test_fake'; props.SITE_URL = 'https://dao.example/';
  const three = post({ type: 'booking', date: '2026-10-19', seats: 3, name: 'Three Guests', whatsapp: '+66 80 000 0033' });
  const t = rowOf(three.id);
  const sess = stripeCalls.find((c) => c.path === 'checkout/sessions');
  assert(three.ok && /^https:\/\/checkout\.stripe\.com\//.test(three.cardUrl) && t[C('Card')] === 'pending' && t[C('Stripe customer')] === 'cus_test' && t[C('Stripe session')] === 'cs_test_1', '3 seats: card page returned, row pending with the Stripe customer and session: ' + JSON.stringify(three));
  assert(sess.payload.mode === 'setup' && sess.payload.success_url === `https://dao.example/reserve?request=${three.id}&card=1` && sess.payload.cancel_url.endsWith('&card=0') && /THB 1,000 per guest/.test(sess.payload['custom_text[submit][message]']) && sess.key === 'card-' + three.id, 'the card page saves a card (setup mode), comes back to /reserve, states the fee, has an idempotency key');
  assert(!stripeCalls.some((c) => c.path === 'payment_intents'), 'nothing is charged when the card is saved');
  const again3 = post({ type: 'booking', date: '2026-10-19', seats: 3, name: 'Three Guests', whatsapp: '+66 80 000 0033' });
  assert(again3.id === three.id && again3.cardUrl === three.cardUrl && stripeCalls.filter((c) => c.path === 'checkout/sessions').length === 1, 'a repeat while the card page is open gets the same page, no new customer');
  const asked = () => stripeCalls.filter((c) => c.path.startsWith('checkout/sessions/')).length;
  for (let i = 0; i < 20; i++) post({ type: 'booking', date: '2026-10-19', seats: 3, name: 'Three Guests', whatsapp: '+66 80 000 0033' });
  assert(asked() === 1, 'twenty more repeats ask Stripe about the card page once, not twenty times (it spends the daily quota): ' + asked());
  sessionStatus = 'complete';
  ctx.processCards();
  assert(rowOf(three.id)[C('Card')] === 'saved' && rowOf(three.id)[C('Stripe card')] === 'pm_test_1', 'processCards: a finished card page marks the card saved and keeps its payment method');
  // the team sets No Show: the next run charges THB 1,000 per guest (3 seats → 3,000), once
  rowOf(three.id)[C('Status')] = 'No Show';
  ctx.processCards();
  const charge = stripeCalls.filter((c) => c.path === 'payment_intents');
  assert(charge.length === 1 && charge[0].payload.amount === '300000' && charge[0].payload.currency === 'thb' && charge[0].payload.off_session === 'true' && charge[0].payload.confirm === 'true' && charge[0].payload.payment_method === 'pm_test_1' && charge[0].key === 'fee-' + three.id, 'No Show charges THB 1,000 per guest (3 × 100000 satang) off-session to the saved card, keyed on the request: ' + JSON.stringify(charge[0] && charge[0].payload));
  assert(/^charged THB 3,000 for 3 guests \(pi_test_1\)$/.test(rowOf(three.id)[C('Fee')]), 'Fee says what was charged: ' + rowOf(three.id)[C('Fee')]);
  ctx.processCards();
  assert(stripeCalls.filter((c) => c.path === 'payment_intents').length === 1, 'the next runs never charge the same row again');
  // Late Cancel on a booking with no card (2 seats): nothing charged, the team is told
  rq.data[1][C('Status')] = 'Late Cancel';
  ctx.processCards();
  assert(rq.data[1][C('Fee')] === 'no card saved' && stripeCalls.filter((c) => c.path === 'payment_intents').length === 1, 'Late Cancel without a saved card: Fee = no card saved, no charge');
  // a pending card page that expires becomes missing
  sessionStatus = 'open';
  const four = post({ type: 'booking', date: '2026-10-19', seats: 4, name: 'Four Guests', whatsapp: '+66 80 000 0044' });
  sessionStatus = 'expired';
  ctx.processCards();
  assert(rowOf(four.id)[C('Card')] === 'missing', 'an expired card page marks the card missing');
  // a charge the bank refuses (needs the guest's approval) is reported, not retried every run
  sessionStatus = 'complete';
  const five = post({ type: 'booking', date: '2026-10-19', seats: 5, name: 'Five Guests', whatsapp: '+66 80 000 0055' });
  ctx.processCards();
  chargeFails = true;
  rowOf(five.id)[C('Status')] = 'Late Cancel';
  ctx.processCards();
  const failed = rowOf(five.id)[C('Fee')];
  ctx.processCards();
  assert(/^failed: authentication_required/.test(failed) && stripeCalls.filter((c) => c.path === 'payment_intents').length === 2, 'a refused charge is written in Fee and not tried again: ' + failed);
  // partial no-show: 6 booked, 4 came → the team enters 2 in Missing guests → THB 2,000
  chargeFails = false;
  const six = post({ type: 'booking', date: '2026-10-19', seats: 6, name: 'Six Guests', whatsapp: '+66 80 000 0066' });
  ctx.processCards();
  rowOf(six.id)[C('Missing guests')] = 9;
  rowOf(six.id)[C('Status')] = 'No Show';
  ctx.processCards();
  assert(/^failed: Missing guests must be a number from 1 to 6/.test(rowOf(six.id)[C('Fee')]) && stripeCalls.filter((c) => c.path === 'payment_intents').length === 2, 'more missing guests than seats: nothing charged, the team is told: ' + rowOf(six.id)[C('Fee')]);
  rowOf(six.id)[C('Missing guests')] = 2;
  rowOf(six.id)[C('Fee')] = '';
  ctx.processCards();
  const part = stripeCalls.filter((c) => c.path === 'payment_intents');
  assert(part.length === 3 && part[2].payload.amount === '200000' && /^charged THB 2,000 for 2 guests/.test(rowOf(six.id)[C('Fee')]), 'Missing guests = 2 of 6: THB 2,000 charged: ' + rowOf(six.id)[C('Fee')]);
  console.log(log.map((l) => l.join(' ')).join('\n'));
}

if (process.argv[2] === 'serve') {
  ctx.addWebsiteTabs();
  ctx.refreshAvailability();
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  http.createServer((req, res) => {
    if (req.method === 'POST') {
      let b = ''; req.on('data', (c) => (b += c));
      req.on('end', () => { const out = ctx.doPost({ postData: { contents: b } }).body; console.log('POST', b, '→', out); res.writeHead(200, cors); res.end(out); });
      return;
    }
    res.writeHead(200, cors); res.end(ctx.doGet().body);
  }).listen(4323, '127.0.0.1', () => console.log('fake Apps Script on 127.0.0.1:4323'));
}
