/**
 * @OnlyCurrentDoc  (the script may only touch the spreadsheet it lives in)
 *
 * Dao reservations: the website's backend, living inside the reservations spreadsheet.
 * Paste into the sheet via Extensions → Apps Script. Plan and setup steps: docs/booking.md.
 *
 * What it does
 *   GET  (doGet)   → the nights the website shows, with seats left, from the "Availability" tab.
 *   POST (doPost)  → adds a booking or waitlist request to "Website requests", emails the
 *                    restaurant, and for a booking returns a Stripe page that saves a card.
 *   refreshAvailability() → counts booked seats per night from the weekly board (the Pax column)
 *                    into "Availability". Runs on every edit and every 5 minutes.
 *   checkCards()   → marks each request's card as saved or missing once the guest is done with
 *                    Stripe. Runs every 10 minutes.
 *
 * The weekly board is only ever read, never written. A website request never takes a seat by
 * itself: seats count once the team has placed the guests on the board.
 *
 * Script properties (Project settings → Script properties):
 *   NOTIFY_EMAIL       where new requests are emailed (optional)
 *   SITE_URL           e.g. https://dao.example.com, for Stripe to send guests back (needed for cards)
 *   STRIPE_SECRET_KEY  a *restricted* key (rk_test_… / rk_live_…) allowed only Customers: write,
 *                      Checkout Sessions: write, SetupIntents: read. Anyone who can edit the sheet
 *                      can read script properties, so never a full sk_ key. Optional; without it no
 *                      card is asked for.
 *
 * Time zone: appsscript.json (paste it in with this file) sets the script to Asia/Bangkok, and every
 * date is read through the sheet's time zone, so a night is never taken for the day before.
 *
 * Abuse: the web app address is public, so doPost refuses more than POSTS_PER_10_MIN requests in
 * ten minutes, treats a repeat of the same WhatsApp number for the same night and seats as the same request,
 * writes guest text into the sheet as text (never as a formula), and keeps working when the daily
 * email quota runs out.
 */

const TABS = { requests: 'Website requests', availability: 'Availability', help: 'How it works' };
const OWN_TABS = Object.values(TABS);
/** Default seats per night by weekday (1 = Monday … 7 = Sunday). Editable per night in the Availability tab. */
const CAPACITY = { 1: 16, 2: 16, 3: 16, 4: 16, 6: 14 };
/** The live board. setupTestCopy() refuses to run on it. */
const ORIGINAL_BOARD_ID = '1Z97_kIS8euN2z_sv9QK84RePBss-0SVWqI5Wf4NPYvk';
// Keep the amount in step with the website (src/content/site.ts, pricing.noShowFee).
const NO_SHOW_POLICY = 'Nothing is charged now. Your card holds your seats and is only charged THB 1,950 per seat if you do not come or cancel within 48 hours of the dinner.';
/** Requests accepted per ten minutes, all guests together, before the endpoint says it is busy. */
const POSTS_PER_10_MIN = 30;
/** The most seats one online request can take. Keep in step with the website (src/content/reserve.ts, onlineMax). */
const ONLINE_MAX = 11;

const REQUEST_COLS = ['Received', 'Type', 'Status', 'Night', 'Seats', 'Name', 'WhatsApp', 'Email', 'Special occasion', 'Cake', 'Note', 'Card', 'Request ID', 'Stripe customer', 'Stripe session', 'Team notes'];
const COL = REQUEST_COLS.reduce((o, c, i) => ((o[c] = i + 1), o), {});
const AVAIL_COLS = ['Night', 'Open', 'Capacity', 'Booked (from the board)', 'Seats left', 'Board tab', 'Updated'];

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
  // the same number for the same night and seats again (a double press, a retry, Back from Stripe) is
  // the same request: it gets the same answer, and the same card page while that is still open
  const dupKey = 'dup:' + r.whatsapp.replace(/\D/g, '') + ':' + r.date + ':' + r.seats + ':' + r.type;
  const dup = cache.get(dupKey);
  if (dup) return json_(repeat_(JSON.parse(dup)));
  // a flood (someone posting to this address directly) is refused before it costs anything;
  // counted per fixed ten minutes, so a steady trickle can't keep the count from ever running out
  const bucket = 'posts:' + Math.floor(Date.now() / 6e5);
  const recent = Number(cache.get(bucket) || 0);
  if (recent >= POSTS_PER_10_MIN) return json_({ ok: false, reason: 'busy' });
  cache.put(bucket, String(recent + 1), 600);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ ok: false, reason: 'busy' });
  let id, row;
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
      text_(r.email), r.occasion, r.cake ? 'yes' : '', text_(r.note), '', id, '', '', '',
    ]);
    row = sh.getLastRow();
    cache.put(dupKey, JSON.stringify({ id, type: r.type }), 6 * 60 * 60);
  } finally {
    lock.releaseLock();
  }

  try { notify_(r, id); } catch (err) { /* the request is saved; a missing email must not fail the guest */ }

  if (r.type !== 'booking') return json_({ ok: true, id, type: 'waitlist' });
  const card = startCard_(r, id, row);
  if (card) cache.put(dupKey, JSON.stringify({ id, type: r.type, cardUrl: card.url, session: card.session }), 6 * 60 * 60);
  return json_({ ok: true, id, type: 'booking', cardUrl: card && card.url });
}

/** The answer to a repeat: the first request's, with its card page only while Stripe still has it open. */
function repeat_(d) {
  let cardUrl = null;
  if (d.cardUrl) {
    try { if (stripe_('get', 'checkout/sessions/' + d.session).status === 'open') cardUrl = d.cardUrl; } catch (err) { /* no link; the team sorts the card out on WhatsApp */ }
  }
  return { ok: true, id: d.id, type: d.type, cardUrl };
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
 * on the board can't mislead the website. Keeps the team's Open/Capacity edits.
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
      if (v[0] instanceof Date) keep[Utilities.formatDate(v[0], tz, 'yyyy-MM-dd')] = { open: v[1], cap: v[2] };
    });
  }
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const now = new Date();
  const rows = Object.keys(found).filter((k) => k >= today).sort().map((k) => {
    const n = found[k], prev = keep[k] || {};
    const open = prev.open || 'yes', cap = prev.cap || CAPACITY[Utilities.formatDate(n.date, tz, 'u')] || 16;
    // seats left are written with the rest of the row, so a reader never meets a half-written night
    const left = String(open).toLowerCase() === 'yes' ? Math.max(0, cap - n.booked) : 0;
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

/** [firstRow, lastRow, date] for each night: a date cell in column A, merged down its tables. */
function nightBlocks_(sh, dates) {
  return sh.getRange(1, 1, dates.length, 1).getMergedRanges()
    .map((m) => [m.getRow(), m.getLastRow(), dates[m.getRow() - 1][0]])
    .filter((b) => b[2] instanceof Date);
}

/** Simple trigger: keep Availability fresh while the team edits the board, or Open and Capacity. */
function onEdit(e) {
  const name = e && e.range && e.range.getSheet().getName();
  if (name && (name === TABS.availability || !OWN_TABS.includes(name))) refreshAvailability();
}

// ---------------------------------------------------------------- Stripe: save a card, charge nothing

function startCard_(r, id, row) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('STRIPE_SECRET_KEY'), site = props.getProperty('SITE_URL');
  const sh = sheet_(TABS.requests);
  if (!key || !site) return null; // cards not set up yet: the team handles it on WhatsApp
  try {
    const customer = stripe_('post', 'customers', {
      name: r.name, phone: r.whatsapp, email: r.email || undefined,
      'metadata[request_id]': id, 'metadata[night]': r.date, 'metadata[seats]': String(r.seats),
    });
    const session = stripe_('post', 'checkout/sessions', {
      mode: 'setup', customer: customer.id, 'payment_method_types[0]': 'card',
      success_url: `${site}/reserve?request=${id}&card=1`, cancel_url: `${site}/reserve?request=${id}&card=0`,
      'metadata[request_id]': id, 'setup_intent_data[metadata][request_id]': id,
      'custom_text[submit][message]': NO_SHOW_POLICY,
    });
    sh.getRange(row, COL['Card']).setValue('pending');
    sh.getRange(row, COL['Stripe customer']).setValue(customer.id);
    sh.getRange(row, COL['Stripe session']).setValue(session.id);
    return { url: session.url, session: session.id };
  } catch (err) {
    sh.getRange(row, COL['Card']).setValue('missing');
    sh.getRange(row, COL['Team notes']).setValue('Card link failed: ' + err.message);
    return null;
  }
}

/** Every 10 minutes: pending cards become saved (guest finished) or missing (link expired after 24 h). */
function checkCards() {
  const key = PropertiesService.getScriptProperties().getProperty('STRIPE_SECRET_KEY');
  const sh = sheet_(TABS.requests);
  if (!key || sh.getLastRow() < 2) return;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, REQUEST_COLS.length).getValues();
  vals.forEach((v, i) => {
    if (v[COL['Card'] - 1] !== 'pending' || !v[COL['Stripe session'] - 1]) return;
    try {
      const s = stripe_('get', 'checkout/sessions/' + v[COL['Stripe session'] - 1]);
      const status = s.status === 'complete' ? 'saved' : s.status === 'expired' ? 'missing' : null;
      if (status) sh.getRange(i + 2, COL['Card']).setValue(status);
    } catch (err) { /* one failing row must not stop the others; it is tried again next time */ }
  });
}

function stripe_(method, path, params) {
  const payload = {};
  Object.keys(params || {}).forEach((k) => { if (params[k] !== undefined && params[k] !== '') payload[k] = params[k]; });
  const res = UrlFetchApp.fetch('https://api.stripe.com/v1/' + path, {
    method, payload: method === 'post' ? payload : undefined, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + PropertiesService.getScriptProperties().getProperty('STRIPE_SECRET_KEY') },
  });
  const out = JSON.parse(res.getContentText());
  if (res.getResponseCode() >= 300) throw new Error((out.error && out.error.message) || 'Stripe error');
  return out;
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

/** Adds the website's tabs to a sheet without touching anything else. Safe on the live board. */
function addWebsiteTabs() {
  const ss = SpreadsheetApp.getActive();
  const make = (name, cols, widths, index) => {
    let sh = ss.getSheetByName(name);
    if (sh) return sh;
    sh = ss.insertSheet(name, index);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1C1A17').setWrap(true).setVerticalAlignment('middle');
    sh.setFrozenRows(1);
    sh.setRowHeight(1, 34);
    widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));
    return sh;
  };
  const rq = make(TABS.requests, REQUEST_COLS, [130, 80, 100, 100, 50, 150, 140, 180, 120, 50, 260, 90, 90, 150, 150, 220], 0);
  const list = (values) => SpreadsheetApp.newDataValidation().requireValueInList(values, true).build();
  rq.getRange('B2:B').setDataValidation(list(['Booking', 'Waitlist']));
  rq.getRange('C2:C').setDataValidation(list(['New', 'Approved', 'Declined', 'Waitlisted', 'Cancelled']));
  rq.getRange('L2:L').setDataValidation(list(['pending', 'saved', 'missing', 'charged', 'charge failed']));
  rq.getRange('A2:A').setNumberFormat('d mmm yyyy hh:mm');
  rq.getRange('D2:D').setNumberFormat('ddd d mmm yyyy');
  rq.getRange('F2:K').setNumberFormat('@'); // guest text stays text
  // New rows stand out until the team has dealt with them
  rq.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$C2="New"').setBackground('#FFF2CC').setRanges([rq.getRange('A2:P')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$C2="Approved"').setBackground('#D9EAD3').setRanges([rq.getRange('A2:P')]).build(),
  ]);

  const av = make(TABS.availability, AVAIL_COLS, [120, 60, 80, 110, 80, 90, 110], 1);
  av.getRange('B2:B').setDataValidation(list(['yes', 'no']));

  const hw = make(TABS.help, ['How the website works with this sheet'], [900], 2);
  const help = [
    '1. A guest requests seats on the website. A row appears in "Website requests" with Status = New (yellow), and an email is sent.',
    '2. Message the guest on WhatsApp as usual: menus, dietary needs, the occasion.',
    '3. If it works: add them to the weekly board like any other booking, then set Status = Approved (green).',
    '   If not: set Status = Declined, or Waitlisted to keep them in mind for another night.',
    '4. Seats only count once the guests are on the weekly board. A New request never takes a seat by itself.',
    '',
    '"Availability" is what the website shows. It updates itself from the weekly board (the Pax column of each night).',
    '   Open = no hides a night. Capacity is 16 (14 on Saturdays) and can be changed per night; Seats left follows.',
    '   A night appears on the website once its week is laid out on the board.',
    '',
    'Card: every booking saves a card with Stripe (Card = saved). It is only charged for a no-show or a cancellation inside',
    '   48 hours: find the Stripe customer from the request row in the Stripe dashboard and charge it there.',
    '',
    'Waitlist: requests for a full night arrive with Type = Waitlist. No card is asked for.',
  ];
  hw.getRange(2, 1, help.length, 1).setValues(help.map((l) => [l]));
}

/** Runs every 5 minutes and every 10 minutes. Run once after pasting the script. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshAvailability').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('checkCards').timeBased().everyMinutes(10).create();
}

/**
 * For the test copy only: keeps the weekly tabs that have a night in the given month, deletes
 * the rest, fixes night totals that don't cover the whole night, and adds the website tabs.
 * Refuses to run on the live board.
 */
function setupTestCopy(month) {
  const ss = SpreadsheetApp.getActive();
  if (ss.getId() === ORIGINAL_BOARD_ID) throw new Error('This is the live board. setupTestCopy only runs on a copy.');
  const keepMonth = typeof month === 'string' ? month : '2026-10';
  const tz = ss.getSpreadsheetTimeZone();
  ss.getSheets().forEach((sh) => {
    if (OWN_TABS.includes(sh.getName())) return;
    const last = sh.getLastRow();
    const blocks = last > 1 ? nightBlocks_(sh, sh.getRange(1, 1, last, 1).getValues()) : [];
    const inMonth = blocks.some((b) => Utilities.formatDate(b[2], tz, 'yyyy-MM') === keepMonth);
    if (!inMonth) { if (ss.getSheets().length > 1) ss.deleteSheet(sh); return; }
    blocks.forEach(([r0, r1]) => {
      const total = sh.getRange(r1 + 1, 3);
      if (/^=sum\(/i.test(total.getFormula()) && total.getFormula().toUpperCase() !== `=SUM(C${r0}:C${r1})`) total.setFormula(`=SUM(C${r0}:C${r1})`);
    });
  });
  addWebsiteTabs();
  refreshAvailability();
}
