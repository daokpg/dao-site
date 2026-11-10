/**
 * @OnlyCurrentDoc  (the script may only touch the spreadsheet it lives in)
 *
 * Dao reservations: the website's backend, living inside the reservations spreadsheet.
 * Paste into the sheet via Extensions → Apps Script. Plan and setup steps: docs/booking.md.
 *
 * What it does
 *   GET  (doGet)   → the nights the website shows, with seats left, from the "Availability" tab.
 *   POST (doPost)  → adds a booking or waitlist request to "inbox - new reservations", emails the
 *                    restaurant, and for a booking of CARD_FROM_SEATS or more returns a Stripe page
 *                    that saves the guest's card (nothing is charged).
 *   refreshAvailability() → counts booked seats per night from the weekly plannings (the Pax column)
 *                    into "Availability". Runs on every edit and every 5 minutes.
 *   processCards() → every 5 minutes: marks pending cards saved or missing, and charges the
 *                    no-show fee once to the saved card of every row the team set to "Late Cancel"
 *                    or "No Show": per guest, for every seat or only the Missing guests the team
 *                    enters. Running on a timer, not on the edit, leaves a few minutes to undo
 *                    a status set by mistake; Stripe's idempotency key means a row is never charged twice.
 *
 * The weekly plannings are only ever read, never written. A website request never takes a seat by
 * itself: seats count once the team has placed the guests in the week's planning.
 *
 * Script properties (Project settings → Script properties):
 *   NOTIFY_EMAIL       where new requests are emailed (optional)
 *   SITE_URL           the website's address, e.g. https://dao.example.com (Stripe sends guests back there)
 *   STRIPE_SECRET_KEY  the client's Stripe *restricted* key (rk_test_… / rk_live_…) with only:
 *                      Customers: Write, Checkout Sessions: Write, SetupIntents: Read,
 *                      PaymentIntents: Write. Anyone who can edit the sheet can read script
 *                      properties, so never a full sk_ key. Without it (or SITE_URL) no card is asked
 *                      for and bookings still arrive.
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
/** Bookings of this many seats or more save a card. Keep in step with the website (site.pricing.cardFrom). */
const CARD_FROM_SEATS = 3;
/** The fee for a no-show or a same-day cancellation, in THB, per guest. Keep in step with site.pricing.noShowFee. */
const NO_SHOW_FEE_THB = 1000;
/** What the guest reads on Stripe's card page, above the button. */
const CARD_POLICY = 'You won’t be charged now. THB 1,000 per guest is charged to this card only if you cancel on the day of the dinner or don’t come.';
/** The two statuses that charge the fee. */
const FEE_STATUSES = ['Late Cancel', 'No Show'];
const STATUSES = ['New', 'Approved', 'Declined', 'Waitlisted', 'Cancelled', 'Late Cancel', 'No Show'];

const REQUEST_COLS = ['Received', 'Type', 'Status', 'Card', 'Fee', 'Missing guests', 'Night', 'Seats', 'Name', 'WhatsApp', 'Email', 'Special occasion', 'Cake', 'Note', 'Request ID', 'Team notes', 'Stripe customer', 'Stripe card', 'Stripe session'];
const COL = REQUEST_COLS.reduce((o, c, i) => ((o[c] = i + 1), o), {});
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
  let id, row, needsCard;
  try {
    const night = readNights_().find((n) => n.date === r.date);
    if (!night) return json_({ ok: false, reason: 'closed' });
    // a full night turns a booking into a waitlist request; a night with too few seats is refused
    if (r.type === 'booking' && night.left === 0) r.type = 'waitlist';
    if (r.type === 'booking' && r.seats > night.left) return json_({ ok: false, reason: 'not_enough', left: night.left });

    id = (r.type === 'booking' ? 'DAO-' : 'WL-') + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
    const sh = sheet_(TABS.requests);
    needsCard = r.type === 'booking' && r.seats >= CARD_FROM_SEATS;
    sh.appendRow([
      new Date(), r.type === 'booking' ? 'Booking' : 'Waitlist', 'New', needsCard ? 'pending' : 'not needed', '', '',
      parseDate_(r.date), r.seats, text_(r.name), text_(r.whatsapp), text_(r.email), r.occasion, r.cake ? 'yes' : '',
      text_(r.note), id, '', '', '', '',
    ]);
    row = sh.getLastRow();
    cache.put(dupKey, JSON.stringify({ id, type: r.type }), 6 * 60 * 60);
  } finally {
    lock.releaseLock();
  }

  try { notify_(r, id); } catch (err) { /* the request is saved; a missing email must not fail the guest */ }

  if (!needsCard) return json_({ ok: true, id, type: r.type });
  const card = startCard_(r, id, row);
  if (card) cache.put(dupKey, JSON.stringify({ id, type: r.type, cardUrl: card.url, session: card.session }), 6 * 60 * 60);
  return json_({ ok: true, id, type: r.type, cardUrl: card ? card.url : null });
}

/**
 * The answer to a repeat: the first request's, with its card page only while Stripe still has it open.
 * Repeats are answered even during a flood, so Stripe is asked about a card page at most once a minute
 * (the answer is kept in between): repeating one request can't spend the script's daily quota of calls.
 */
function repeat_(d) {
  let cardUrl = null;
  if (d.cardUrl) {
    const cache = CacheService.getScriptCache(), key = 'open:' + d.session;
    let open = cache.get(key);
    if (open === null) {
      try { open = stripe_('get', 'checkout/sessions/' + d.session).status === 'open' ? 'yes' : 'no'; } catch (err) { open = 'no'; /* no link; the team sorts the card out on WhatsApp */ }
      cache.put(key, open, 60);
    }
    if (open === 'yes') cardUrl = d.cardUrl;
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

// ---------------------------------------------------------------- Stripe: save a card, charge only the fee

/** Creates the guest as a Stripe customer and a card page that saves a card without charging it. */
function startCard_(r, id, row) {
  const props = PropertiesService.getScriptProperties();
  const sh = sheet_(TABS.requests);
  if (!props.getProperty('STRIPE_SECRET_KEY') || !props.getProperty('SITE_URL')) {
    sh.getRange(row, COL['Card']).setValue('missing');
    sh.getRange(row, COL['Team notes']).setValue('Cards are not set up yet (no Stripe key in the script).');
    return null;
  }
  const site = props.getProperty('SITE_URL').replace(/\/+$/, '');
  try {
    const customer = stripe_('post', 'customers', {
      name: r.name, phone: r.whatsapp, email: r.email || undefined,
      'metadata[request_id]': id, 'metadata[night]': r.date, 'metadata[seats]': String(r.seats),
    });
    const session = stripe_('post', 'checkout/sessions', {
      mode: 'setup', customer: customer.id, 'payment_method_types[0]': 'card',
      success_url: `${site}/reserve?request=${id}&card=1`, cancel_url: `${site}/reserve?request=${id}&card=0`,
      'metadata[request_id]': id, 'setup_intent_data[metadata][request_id]': id,
      'custom_text[submit][message]': CARD_POLICY,
    }, 'card-' + id);
    sh.getRange(row, COL['Stripe customer']).setValue(customer.id);
    sh.getRange(row, COL['Stripe session']).setValue(session.id);
    return { url: session.url, session: session.id };
  } catch (err) {
    sh.getRange(row, COL['Card']).setValue('missing');
    sh.getRange(row, COL['Team notes']).setValue('Card page failed: ' + err.message);
    return null;
  }
}

/**
 * Every 5 minutes (installTriggers): first, pending cards become saved (the guest finished; the card is
 * kept for the fee) or missing (the page expired after 24 hours, or the guest left). Then every row set
 * to Late Cancel or No Show with nothing in Fee is charged the fee once.
 */
function processCards() {
  const sh = sheet_(TABS.requests);
  if (!PropertiesService.getScriptProperties().getProperty('STRIPE_SECRET_KEY') || sh.getLastRow() < 2) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return; // the next run picks up where this one would have
  try {
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, REQUEST_COLS.length).getValues();
    rows.forEach((v, i) => {
      const at = (name) => v[COL[name] - 1];
      const set = (name, value) => sh.getRange(i + 2, COL[name]).setValue(value);
      try {
        if (at('Card') === 'pending' && at('Stripe session')) {
          const sess = stripe_('get', 'checkout/sessions/' + at('Stripe session'), { 'expand[]': 'setup_intent' });
          if (sess.status === 'complete' && sess.setup_intent && sess.setup_intent.payment_method) {
            set('Stripe card', sess.setup_intent.payment_method);
            set('Card', 'saved');
            v[COL['Card'] - 1] = 'saved';
            v[COL['Stripe card'] - 1] = sess.setup_intent.payment_method;
          } else if (sess.status === 'expired') {
            set('Card', 'missing');
          }
        }
        if (FEE_STATUSES.includes(String(at('Status')).trim()) && !String(at('Fee')).trim()) set('Fee', chargeFee_(v));
      } catch (err) { /* one failing row must not stop the others; it is tried again next run */ }
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Charges the fee to a row's saved card, once (the request ID is the idempotency key). The fee is per
 * guest: every seat booked, or only "Missing guests" when the team fills it in (6 booked, 4 came → 2).
 * Returns what goes in Fee.
 */
function chargeFee_(v) {
  const at = (name) => v[COL[name] - 1];
  if (at('Card') !== 'saved' || !at('Stripe card') || !at('Stripe customer')) return 'no card saved';
  const seats = Number(at('Seats')) || 0;
  const typed = String(at('Missing guests')).trim();
  const guests = typed === '' ? seats : Number(typed);
  if (!(Number.isInteger(guests) && guests >= 1 && guests <= seats)) return `failed: Missing guests must be a number from 1 to ${seats} (clear Fee to try again)`;
  const thb = NO_SHOW_FEE_THB * guests;
  try {
    const pi = stripe_('post', 'payment_intents', {
      amount: String(thb * 100), currency: 'thb', // THB counts in satang
      customer: at('Stripe customer'), payment_method: at('Stripe card'),
      off_session: 'true', confirm: 'true',
      description: `Dao ${String(at('Status')).toLowerCase()} fee, ${guests} of ${seats} guests, ${at('Request ID')}`,
      'metadata[request_id]': at('Request ID'), 'metadata[reason]': at('Status'), 'metadata[guests]': String(guests),
    }, 'fee-' + at('Request ID'));
    const what = `THB ${thb.toLocaleString('en-US')} for ${guests} guest${guests === 1 ? '' : 's'}`;
    if (pi.status === 'succeeded') return `charged ${what} (${pi.id})`;
    if (pi.status === 'processing') return `processing ${what} (${pi.id})`;
    return `failed: ${pi.status} (${pi.id})`;
  } catch (err) {
    // a card that needs the guest's approval can't be charged while they're away: send them a payment link
    return 'failed: ' + err.message;
  }
}

/** A call to Stripe. GET params go in the address; a POST can carry an idempotency key. */
function stripe_(method, path, params, idempotencyKey) {
  const clean = {};
  Object.keys(params || {}).forEach((k) => { if (params[k] !== undefined && params[k] !== '') clean[k] = params[k]; });
  const query = method === 'get' && Object.keys(clean).length
    ? '?' + Object.keys(clean).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(clean[k])).join('&') : '';
  const headers = { Authorization: 'Bearer ' + PropertiesService.getScriptProperties().getProperty('STRIPE_SECRET_KEY') };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = UrlFetchApp.fetch('https://api.stripe.com/v1/' + path + query, {
    method, payload: method === 'post' ? clean : undefined, muteHttpExceptions: true, headers,
  });
  const out = JSON.parse(res.getContentText());
  if (res.getResponseCode() >= 300) throw new Error((out.error && (out.error.decline_code || out.error.code) ? `${out.error.decline_code || out.error.code}: ` : '') + ((out.error && out.error.message) || 'Stripe error'));
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
  const rq = make(TABS.requests, REQUEST_COLS, [140, 85, 105, 95, 220, 80, 120, 55, 160, 150, 190, 125, 55, 280, 100, 240, 150, 150, 150], 0);
  const list = (values) => SpreadsheetApp.newDataValidation().requireValueInList(values, true).build();
  rq.getRange('B2:B').setDataValidation(list(['Booking', 'Waitlist']));
  rq.getRange('C2:C').setDataValidation(list(STATUSES));
  rq.getRange('A2:A').setNumberFormat('d mmm yyyy hh:mm');
  rq.getRange('G2:G').setNumberFormat('ddd d mmm yyyy');
  rq.getRange('I2:N').setNumberFormat('@'); // guest text stays text
  // New rows stand out until the team has dealt with them
  rq.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$C2="New"').setBackground('#FFF2CC').setRanges([rq.getRange('A2:S')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$C2="Approved"').setBackground('#D9EAD3').setRanges([rq.getRange('A2:S')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=OR($C2="Late Cancel",$C2="No Show")').setBackground('#F4CCCC').setRanges([rq.getRange('A2:S')]).build(),
  ]);
  const av = make(TABS.availability, AVAIL_COLS, [130, 65, 80, 120, 85, 110, 120], 1);
  av.getRange('B2:B').setDataValidation(list(['yes', 'no']));
  av.getRange(SETTINGS.label).setValues([['Weekly schedule', ''], ['Open days', DEFAULT_OPEN_DAYS], ['Book ahead (days)', DEFAULT_DAYS_AHEAD]]);
  av.getRange('I1:J1').setFontWeight('bold').setBackground('#D9D2E9');
}

/**
 * Run once from the editor after adding the Stripe key: Google asks to allow outside connections
 * (the card step needs them), and the log says whether the key works.
 */
function checkStripe() {
  stripe_('get', 'customers', { limit: '1' });
  Logger.log('Stripe key works.');
}

/** Refreshes Availability and processes cards and fees, every 5 minutes each. Run once after pasting the script. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshAvailability').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('processCards').timeBased().everyMinutes(5).create();
}
