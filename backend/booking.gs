/**
 * @OnlyCurrentDoc  (the script may only touch the spreadsheet it lives in)
 *
 * Dao reservations: the website's backend, living inside the reservations spreadsheet.
 * Paste into the sheet via Extensions → Apps Script. Plan and setup steps: docs/booking.md.
 *
 * What it does
 *   GET  (doGet)   → the nights the website shows, with seats left, from the "Availability" tab.
 *   POST (doPost)  → adds a booking or waitlist request to "inbox - new reservations" and emails
 *                    the restaurant.
 *   refreshAvailability() → counts booked seats per night from the weekly plannings (the Pax column)
 *                    into "Availability". Runs on every edit and every 5 minutes.
 *
 * The weekly plannings are only ever read, never written. A website request never takes a seat by
 * itself: seats count once the team has placed the guests in the week's planning.
 *
 * Cards (Stripe) are not connected yet: no card is asked for and nothing is charged. The earlier
 * card step (Stripe Checkout in setup mode) is in git history, backend/booking.gs at commit d96b6fa,
 * for when it returns.
 *
 * Script properties (Project settings → Script properties):
 *   NOTIFY_EMAIL       where new requests are emailed (optional)
 *
 * Time zone: appsscript.json (paste it in with this file) sets the script to Asia/Bangkok, and every
 * date is read through the sheet's time zone, so a night is never taken for the day before.
 *
 * Abuse: the web app address is public, so doPost refuses more than POSTS_PER_10_MIN requests in
 * ten minutes, treats a repeat of the same WhatsApp number for the same night and seats as the same request,
 * writes guest text into the sheet as text (never as a formula), and keeps working when the daily
 * email quota runs out.
 */

const TABS = { requests: 'inbox - new reservations', availability: 'Availability' };
const OWN_TABS = Object.values(TABS);
/** Default seats per night by weekday (1 = Monday … 7 = Sunday). Editable per night in the Availability tab. */
const CAPACITY = { 1: 16, 2: 16, 3: 16, 4: 16, 6: 14 };
/**
 * The weekly schedule, in two cells beside the Availability table (the team can change them):
 * which weekdays are open, and how many days ahead those nights are opened for booking.
 */
const SETTINGS = { label: 'I1:J3', openDays: 'J2', daysAhead: 'J3' };
const DEFAULT_OPEN_DAYS = 'Mon, Tue, Wed, Thu, Sat';
const DEFAULT_DAYS_AHEAD = 60;
const WEEKDAY_NUMBER = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
/** Requests accepted per ten minutes, all guests together, before the endpoint says it is busy. */
const POSTS_PER_10_MIN = 30;
/** The most seats one online request can take. Keep in step with the website (src/content/reserve.ts, onlineMax). */
const ONLINE_MAX = 11;

const REQUEST_COLS = ['Received', 'Type', 'Status', 'Night', 'Seats', 'Name', 'WhatsApp', 'Email', 'Special occasion', 'Cake', 'Note', 'Request ID', 'Team notes'];
const AVAIL_COLS = ['Night', 'Open', 'Capacity', 'Booked (from the planning)', 'Seats left', 'Planning tab', 'Updated'];

// ---------------------------------------------------------------- web endpoints

function doGet() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('nights');
  if (hit) return json_(JSON.parse(hit));
  const out = { nights: readNights_() };
  cache.put('nights', JSON.stringify(out), 60);
  return json_(out);
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, reason: 'bad_request' }); }
  if (body.website) return json_({ ok: true, id: 'OK' }); // honeypot: bots fill the hidden field

  const r = clean_(body);
  if (r.error) return json_({ ok: false, reason: r.error });

  const cache = CacheService.getScriptCache();
  // the same number for the same night and seats again (a double press, a retry) is the same request
  const dupKey = 'dup:' + r.whatsapp.replace(/\D/g, '') + ':' + r.date + ':' + r.seats + ':' + r.type;
  const dup = cache.get(dupKey);
  if (dup) { const d = JSON.parse(dup); return json_({ ok: true, id: d.id, type: d.type }); }
  // a flood (someone posting to this address directly) is refused before it costs anything;
  // counted per fixed ten minutes, so a steady trickle can't keep the count from ever running out
  const bucket = 'posts:' + Math.floor(Date.now() / 6e5);
  const recent = Number(cache.get(bucket) || 0);
  if (recent >= POSTS_PER_10_MIN) return json_({ ok: false, reason: 'busy' });
  cache.put(bucket, String(recent + 1), 600);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ ok: false, reason: 'busy' });
  let id;
  try {
    const night = readNights_().find((n) => n.date === r.date);
    if (!night) return json_({ ok: false, reason: 'closed' });
    // a full night turns a booking into a waitlist request; a night with too few seats is refused
    if (r.type === 'booking' && night.left === 0) r.type = 'waitlist';
    if (r.type === 'booking' && r.seats > night.left) return json_({ ok: false, reason: 'not_enough', left: night.left });

    id = (r.type === 'booking' ? 'DAO-' : 'WL-') + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
    const sh = sheet_(TABS.requests);
    sh.appendRow([
      new Date(), r.type === 'booking' ? 'Booking' : 'Waitlist', 'New', parseDate_(r.date), r.seats, text_(r.name), text_(r.whatsapp),
      text_(r.email), r.occasion, r.cake ? 'yes' : '', text_(r.note), id, '',
    ]);
    cache.put(dupKey, JSON.stringify({ id, type: r.type }), 6 * 60 * 60);
  } finally {
    lock.releaseLock();
  }

  try { notify_(r, id); } catch (err) { /* the request is saved; a missing email must not fail the guest */ }
  return json_({ ok: true, id, type: r.type });
}

// ---------------------------------------------------------------- availability

/** Nights from today on, open, with seats left. Full nights are included (the site offers the waitlist). */
function readNights_() {
  const sh = sheet_(TABS.availability);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  return sh.getRange(2, 1, last - 1, 5).getValues()
    .filter((v) => v[0] instanceof Date && String(v[1]).toLowerCase() === 'yes')
    .map((v) => ({ date: Utilities.formatDate(v[0], tz, 'yyyy-MM-dd'), left: Math.max(0, Number(v[4]) || 0), capacity: Number(v[2]) || 16 }))
    .filter((n) => n.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Reads every weekly tab: each night is a date merged down column A, and the guests per table
 * are in column C (Pax). Booked = the sum of column C within the night, so a wrong total formula
 * in a planning can't mislead the website. Also opens every night of the weekly schedule for the
 * days ahead set beside the table, keeps nights the team adds by hand (a special date), and keeps the
 * team's Open/Capacity edits (Open = no closes a single night). A night with no planning yet counts
 * nothing booked ("not planned yet") until its week's planning exists.
 */
function refreshAvailability() {
  // one refresh at a time (the 5-minute trigger and an edit can overlap), and never mid-request
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { refresh_(); } finally { lock.releaseLock(); }
}

function refresh_() {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const found = {};
  ss.getSheets().forEach((sh) => {
    if (OWN_TABS.includes(sh.getName())) return;
    const last = sh.getLastRow();
    if (last < 2) return;
    const dates = sh.getRange(1, 1, last, 1).getValues();
    const pax = sh.getRange(1, 3, last, 1).getValues();
    nightBlocks_(sh, dates).forEach(([r0, r1, date]) => {
      let booked = 0;
      for (let r = r0; r <= r1; r++) if (typeof pax[r - 1][0] === 'number') booked += pax[r - 1][0];
      found[Utilities.formatDate(date, tz, 'yyyy-MM-dd')] = { date, booked, tab: sh.getName() };
    });
  });

  const av = sheet_(TABS.availability);
  const keep = {};
  if (av.getLastRow() > 1) {
    av.getRange(2, 1, av.getLastRow() - 1, 3).getValues().forEach((v) => {
      const date = toDate_(v[0], tz);
      if (date) keep[Utilities.formatDate(date, tz, 'yyyy-MM-dd')] = { date, open: v[1], cap: v[2] };
    });
  }
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const now = new Date();
  const scheduled = scheduledNights_(av, tz);
  const keys = Object.keys(Object.assign({}, scheduled, keep, found)).filter((k) => k >= today).sort();
  const rows = keys.map((k) => {
    const n = found[k] || { date: (keep[k] || scheduled[k]).date, booked: 0, tab: 'not planned yet' }, prev = keep[k] || {};
    const open = String(prev.open || 'yes').trim().toLowerCase() === 'no' ? 'no' : 'yes';
    const cap = Number(prev.cap) || CAPACITY[Utilities.formatDate(n.date, tz, 'u')] || 16;
    // seats left are written with the rest of the row, so a reader never meets a half-written night
    const left = open === 'yes' ? Math.max(0, cap - n.booked) : 0;
    return [n.date, open, cap, n.booked, left, n.tab, now];
  });
  // rows are overwritten in place; only rows left over from nights now gone are cleared
  const stale = av.getLastRow() - 1 - rows.length;
  if (stale > 0) av.getRange(2 + rows.length, 1, stale, AVAIL_COLS.length).clearContent();
  if (rows.length) {
    av.getRange(2, 1, rows.length, AVAIL_COLS.length).setValues(rows);
    av.getRange(2, 1, rows.length, 1).setNumberFormat('ddd d mmm yyyy');
    av.getRange(2, 7, rows.length, 1).setNumberFormat('d mmm hh:mm');
  }
  CacheService.getScriptCache().remove('nights');
}

/** The schedule's nights from today for the days ahead, keyed yyyy-MM-dd, read from the cells beside the table. */
function scheduledNights_(av, tz) {
  const [[days], [ahead]] = [av.getRange(SETTINGS.openDays).getValues()[0], av.getRange(SETTINGS.daysAhead).getValues()[0]];
  const open = String(days || DEFAULT_OPEN_DAYS).toLowerCase().split(/[^a-z]+/)
    .map((w) => WEEKDAY_NUMBER[w.slice(0, 3)]).filter(Boolean);
  // a plain number of days; anything else (empty, a date from the cell's format, "abc") means the default
  const n = ahead instanceof Date ? NaN : parseInt(String(ahead), 10);
  const count = Math.min(n >= 0 ? n : DEFAULT_DAYS_AHEAD, 400);
  const out = {};
  const [y, m, d] = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd').split('-').map(Number);
  for (let i = 0; i < count; i++) {
    const date = new Date(y, m - 1, d + i);
    if (open.includes(Number(Utilities.formatDate(date, tz, 'u')))) out[Utilities.formatDate(date, tz, 'yyyy-MM-dd')] = { date };
  }
  return out;
}

/** A night typed into Availability: a real date, or text like 16/11/2026, 16/11 or 2026-11-16. */
function toDate_(v, tz) {
  if (v instanceof Date) return v;
  const t = String(v || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?$/.exec(t); // day first, as the plannings write dates
  if (!m) return null;
  const year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : +Utilities.formatDate(new Date(), tz, 'yyyy');
  return new Date(year, +m[2] - 1, +m[1]);
}

/** [firstRow, lastRow, date] for each night: a date cell in column A, merged down its tables. */
function nightBlocks_(sh, dates) {
  return sh.getRange(1, 1, dates.length, 1).getMergedRanges()
    .map((m) => [m.getRow(), m.getLastRow(), dates[m.getRow() - 1][0]])
    .filter((b) => b[2] instanceof Date);
}

/** Simple trigger: keep Availability fresh while the team edits a planning, or Open and Capacity. */
function onEdit(e) {
  const name = e && e.range && e.range.getSheet().getName();
  if (name && (name === TABS.availability || !OWN_TABS.includes(name))) refreshAvailability();
}

// ---------------------------------------------------------------- helpers

function clean_(b) {
  // one line: control characters (line breaks included) become spaces, so nothing can break into an email header
  const s = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  // the note keeps its line breaks, nothing else
  const note = String(b.note == null ? '' : b.note).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, 1000);
  const r = {
    type: b.type === 'waitlist' ? 'waitlist' : 'booking',
    date: s(b.date, 10), seats: Math.floor(Number(b.seats)),
    name: s(b.name, 120), whatsapp: s(b.whatsapp, 40), email: s(b.email, 160),
    occasion: ['birthday', 'anniversary', 'engagement'].includes(b.occasion) ? b.occasion : '',
    cake: b.occasion === 'birthday' && !!b.cake, note,
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return { error: 'bad_date' };
  if (!(r.seats >= 1 && r.seats <= ONLINE_MAX)) return { error: 'bad_seats' };
  if (r.name.length < 2) return { error: 'bad_name' };
  if (r.whatsapp.replace(/\D/g, '').length < 7) return { error: 'bad_whatsapp' };
  if (r.email && !/.+@.+\..+/.test(r.email)) return { error: 'bad_email' };
  return r;
}

function notify_(r, id) {
  const to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (!to || MailApp.getRemainingDailyQuota() < 1) return;
  const what = r.type === 'booking' ? 'New request' : 'Waitlist';
  const extra = [r.occasion, r.cake ? 'with cake' : ''].filter(Boolean).join(', ');
  MailApp.sendEmail({
    to,
    subject: `${what}: ${r.seats} on ${r.date}, ${r.name}`,
    body: [
      `${what} from the website (${id})\n`,
      `Night: ${r.date}`, `Seats: ${r.seats}`, `Name: ${r.name}`, `WhatsApp: ${r.whatsapp}`,
      r.email && `Email: ${r.email}`, extra && `Occasion: ${extra}`, r.note && `Note: ${r.note}`,
      `\nOpen the sheet: ${SpreadsheetApp.getActive().getUrl()}`,
    ].filter(Boolean).join('\n'),
  });
}

/** Guest text goes into the sheet as text: a leading = + - @ would otherwise make it a formula. */
function text_(v) { return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }
function parseDate_(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function sheet_(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------------------------------------------------------------- one-time setup (run from the editor)

/**
 * Adds the website's two tabs if they are missing, without touching anything else. The Dao sheet
 * already has them; this is for setting up another copy.
 */
function addWebsiteTabs() {
  const ss = SpreadsheetApp.getActive();
  const make = (name, cols, widths, index) => {
    let sh = ss.getSheetByName(name);
    if (sh) return sh;
    sh = ss.insertSheet(name, index);
    // the plannings' header look: lavender, bold, centred
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#D9D2E9')
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
    sh.setFrozenRows(1);
    sh.setRowHeight(1, 34);
    widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));
    return sh;
  };
  const rq = make(TABS.requests, REQUEST_COLS, [140, 85, 105, 120, 55, 160, 150, 190, 125, 55, 280, 100, 240], 0);
  const list = (values) => SpreadsheetApp.newDataValidation().requireValueInList(values, true).build();
  rq.getRange('B2:B').setDataValidation(list(['Booking', 'Waitlist']));
  rq.getRange('C2:C').setDataValidation(list(['New', 'Approved', 'Declined', 'Waitlisted', 'Cancelled']));
  rq.getRange('A2:A').setNumberFormat('d mmm yyyy hh:mm');
  rq.getRange('D2:D').setNumberFormat('ddd d mmm yyyy');
  rq.getRange('F2:K').setNumberFormat('@'); // guest text stays text
  // New rows stand out until the team has dealt with them
  rq.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$C2="New"').setBackground('#FFF2CC').setRanges([rq.getRange('A2:M')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$C2="Approved"').setBackground('#D9EAD3').setRanges([rq.getRange('A2:M')]).build(),
  ]);
  const av = make(TABS.availability, AVAIL_COLS, [130, 65, 80, 120, 85, 110, 120], 1);
  av.getRange('B2:B').setDataValidation(list(['yes', 'no']));
  av.getRange(SETTINGS.label).setValues([['Weekly schedule', ''], ['Open days', DEFAULT_OPEN_DAYS], ['Book ahead (days)', DEFAULT_DAYS_AHEAD]]);
  av.getRange('I1:J1').setFontWeight('bold').setBackground('#D9D2E9');
}

/** Refreshes Availability every 5 minutes. Run once after pasting the script. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshAvailability').timeBased().everyMinutes(5).create();
}
