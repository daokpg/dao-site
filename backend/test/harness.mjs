// Runs backend/booking.gs in Node with fake Google services, on the structure of the real October
// board (dates, guests per table and total formulas only: board-october.json holds no guest details).
//   node backend/test/harness.mjs test    → runs the checks
//   node backend/test/harness.mjs serve   → serves doGet/doPost on :4323 (CORS like Apps Script);
//     build the site with PUBLIC_BOOKING_API=http://localhost:4323 to try it end to end
// The checks expect the October 2026 nights to be in the future; refresh the fixture after that.
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
  const evalCell = (r, c) => {
    const f = sh.formulas[`${r},${c}`];
    if (f && f.startsWith('=IF(LOWER(R[0]C[-3])')) {
      const open = String(cell(r, c - 3)).toLowerCase() === 'yes';
      return open ? Math.max(0, Number(cell(r, c - 2)) - Number(cell(r, c - 1))) : 0;
    }
    return cell(r, c);
  };
  const range = (r, c, nr = 1, nc = 1) => { const rg = new Proxy({
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => evalCell(r + i, c + j) ?? '')),
    setValues: (v) => v.forEach((row, i) => row.forEach((x, j) => set(r + i, c + j, x))),
    setValue: (v) => set(r, c, v),
    clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { set(r + i, c + j, ''); delete sh.formulas[`${r + i},${c + j}`]; } return chain; },
    setFormulaR1C1: (f) => { for (let i = 0; i < nr; i++) sh.formulas[`${r + i},${c}`] = f; return chain; },
    getFormula: () => sh.formulas[`${r},${c}`] || '',
    setFormula: (f) => { sh.formulas[`${r},${c}`] = f; },
    getMergedRanges: () => sh.merges.filter(([a, b]) => a <= r + nr - 1 && b >= r).map(([a, b]) => ({ getRow: () => a, getLastRow: () => b })),
  }, { get: (t, k) => { const f = t[k]; if (f) return (...a) => { const out = f(...a); return out === undefined ? rg : out; }; return () => rg; } }); return rg; };
  return Object.assign(sh, {
    getName: () => name,
    getLastRow: () => { if (sh.lastRow) return sh.lastRow; for (let i = sh.data.length; i > 0; i--) if ((sh.data[i - 1] || []).some((v) => v !== '' && v != null)) return i; return 0; },
    getRange: (a, b, c, d) => (typeof a === 'string' ? chain : range(a, b, c, d)),
    appendRow: (v) => { const r = sh.getLastRow() + 1; v.forEach((x, j) => set(r, j + 1, x)); },
    setFrozenRows: () => chain, setRowHeight: () => chain, setColumnWidth: () => chain, setConditionalFormatRules: () => chain,
  });
}
const sheets = [];
let SDate = Date; // replaced by the sandbox's Date below, so instanceof Date holds inside the script
function loadFixture() {
for (const [name, t] of Object.entries(fixture)) {
  const sh = makeSheet(name);
  t.A.forEach((a, i) => { if (a) { const [y, m, d] = a.split('-').map(Number); sh.data[i] = sh.data[i] || []; sh.data[i][0] = new SDate(y, m - 1, d); } });
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
const props = { NOTIFY_EMAIL: 'team@example.com', SITE_URL: 'http://localhost:4321', STRIPE_SECRET_KEY: 'sk_test_fake' };
const cache = new Map();
const pad = (n) => String(n).padStart(2, '0');
const ctx = {
  SpreadsheetApp: { getActive: () => ss, newDataValidation: () => chain, newConditionalFormatRule: () => chain },
  Utilities: {
    formatDate: (d, tz, f) => f.replace('yyyy', d.getFullYear()).replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate())),
    getUuid: () => crypto.randomUUID(),
  },
  CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }) },
  ContentService: { createTextOutput: (s) => ({ body: s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
  MailApp: { sendEmail: (o) => log.push(['mail', o.subject]) },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => chain },
  UrlFetchApp: {
    fetch: (url, o) => {
      log.push(['stripe', o.method, url.replace('https://api.stripe.com/v1/', '')]);
      const body = url.endsWith('/customers') ? { id: 'cus_test' }
        : url.endsWith('/checkout/sessions') ? { id: 'cs_test_1', url: `http://localhost:4323/fake-stripe?back=${encodeURIComponent(o.payload.success_url)}` }
        : { id: 'cs_test_1', status: 'complete' };
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(body) };
    },
  },
  console,
};
vm.createContext(ctx);
vm.runInContext(GS, ctx);
SDate = vm.runInContext('Date', ctx);
loadFixture();

const post = (b) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(b) } }).body);
const get = () => JSON.parse(ctx.doGet().body);

if (process.argv[2] === 'test') {
  const assert = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  ctx.setupTestCopy('2026-10');
  const names = ss.getSheets().map((s) => s.name);
  assert(names.slice(0, 3).join() === 'Website requests,Availability,How it works', 'website tabs added first: ' + names.join(' | '));
  const f = ss.getSheetByName('12-17/10').formulas['36,3'];
  assert(f === '=SUM(C20:C35)', 'Tuesday total fixed on the copy: ' + f);
  const nights = get().nights;
  const n = (d) => nights.find((x) => x.date === d);
  assert(nights.length > 15 && nights.every((x) => x.date >= '2026-09-28'), `${nights.length} nights from today on`);
  assert(n('2026-10-05').left === 6, '5 Oct: 16 seats, 10 booked → 6 left (' + n('2026-10-05').left + ')');
  assert(n('2026-10-06').left === 2, '6 Oct: 16 seats, 14 booked → 2 left (' + n('2026-10-06').left + ')');
  assert(n('2026-10-17').left === 14, 'Sat 17 Oct: capacity 14 (' + n('2026-10-17').left + ')');
  assert(!n('2026-10-09') && !n('2026-10-11'), 'no Friday or Sunday nights');

  let r = post({ type: 'booking', date: '2026-10-06', seats: 3, name: 'Test Guest', whatsapp: '+66 81 234 5678' });
  assert(!r.ok && r.reason === 'not_enough' && r.left === 2, 'too many seats refused: ' + JSON.stringify(r));
  r = post({ type: 'booking', date: '2026-10-06', seats: 2, name: 'Test Guest', whatsapp: '+66 81 234 5678', occasion: 'birthday', cake: true });
  assert(r.ok && r.type === 'booking' && /fake-stripe/.test(r.cardUrl), 'booking accepted with a card link: ' + JSON.stringify(r));
  const rq = ss.getSheetByName('Website requests');
  const row = rq.data[rq.getLastRow() - 1];
  assert(row[1] === 'Booking' && row[2] === 'New' && row[4] === 2 && row[8] === 'birthday' && row[9] === 'yes' && row[11] === 'pending' && row[13] === 'cus_test', 'request row written: ' + JSON.stringify(row.slice(1, 15)));
  assert(get().nights.find((x) => x.date === '2026-10-06').left === 2, 'a New request does not take seats');
  r = post({ type: 'booking', date: '2026-10-05', seats: 1, name: 'X', whatsapp: '123' });
  assert(!r.ok && r.reason === 'bad_name', 'validation: ' + r.reason);
  r = post({ type: 'waitlist', date: '2026-10-17', seats: 4, name: 'Wait Lister', whatsapp: '+972 50 000 0000' });
  assert(r.ok && r.type === 'waitlist' && !r.cardUrl, 'waitlist accepted without a card');
  r = post({ type: 'booking', date: '2026-10-09', seats: 2, name: 'Test Guest', whatsapp: '+66 81 234 5678' });
  assert(!r.ok && r.reason === 'closed', 'closed night refused');
  r = post({ website: 'spam', date: '2026-10-05' });
  assert(r.ok && rq.getLastRow() === 3, 'honeypot: fake OK, nothing written');
  ctx.checkCards();
  assert(rq.data[1][11] === 'saved', 'checkCards marks the card saved');
  // the team places the guests on the board → seats count
  ss.getSheetByName('5-10/10').data[21][2] = 2; // a table on 6 Oct gets 2 guests
  ctx.onEdit({ range: { getSheet: () => ({ getName: () => '5-10/10' }) } });
  assert(get().nights.find((x) => x.date === '2026-10-06').left === 0, 'placed on the board → 6 Oct now full');
  console.log(log.map((l) => l.join(' ')).join('\n'));
}

if (process.argv[2] === 'serve') {
  ctx.setupTestCopy('2026-10');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  http.createServer((req, res) => {
    if (req.url.startsWith('/fake-stripe')) {
      const back = new URL(req.url, 'http://x').searchParams.get('back');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(`<h1>Fake Stripe: save a card</h1><a id="save" href="${back}">Save card</a> <a id="cancel" href="${back.replace('card=1', 'card=0')}">Cancel</a>`);
    }
    if (req.method === 'POST') {
      let b = ''; req.on('data', (c) => (b += c));
      req.on('end', () => { const out = ctx.doPost({ postData: { contents: b } }).body; console.log('POST', b, '→', out); res.writeHead(200, cors); res.end(out); });
      return;
    }
    res.writeHead(200, cors); res.end(ctx.doGet().body);
  }).listen(4323, () => console.log('fake Apps Script on :4323'));
}
