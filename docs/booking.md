# Reservations & payment

How booking works on the Dao site, how it connects to the restaurant's reservations sheet, and how to set it up.
Last updated 2026-10-22. Status: **built and tested locally; not yet deployed** (§8).

---

## 1. The short version

- Guests request seats on `/reserve`. The request lands in a **"Website requests" tab** inside the restaurant's own reservations sheet, and the team gets an email.
- The team talks to the guest on WhatsApp, puts them on the **weekly board** as they always have, and sets the request to **Approved**.
- **Seats only count once guests are on the weekly board.** A new request never takes a seat by itself.
- The website's calendar reads **seats left per night from the weekly board** (the Pax column), through an **"Availability" tab** the script keeps up to date.
- The script never writes to the weekly board.
- Every booking saves a card with Stripe (nothing charged). The team charges it only for a no-show or a cancellation inside 48 hours.

---

## 2. The restaurant's sheet today ("Reservations board")

Reviewed 2026-09-28. The file has 123 tabs, from August 2024 to October 2026.

- **One tab per week**, e.g. "5-10/10". Nights run **Monday to Thursday, plus Saturday**; closed Friday and Sunday.
- **Each night is a block.** The date is merged down column A; then tables in column B: Table 1 with 4 seat rows, Tables 2–7 with 2 each, so 16 seats (Saturdays have 6 tables, 14 seats). Column C (**Pax**) holds the number of guests per table. The row under each night holds its total, `=SUM(C…)`, and the first night of the week also shows the start time, **20:30**.
- **One row per guest**, with a menu dropdown (options, meat&fish, fish&meat&seafood, fish&seafood, fish only, vegetarian, vegan). Empty seats are template rows reading "Name / options".
- Status columns: **info message sent → menus confirmed → day before confirmation**, then menu comments, **special event**, comments.
- Other tabs: an old "waiting list" (2024), "want to reserve, need to contact back" lists on month tabs, and **gift cards** (several paid via Stripe, so they probably already have an account).

**Found while reviewing:**
- **A formula bug in their template.** On Tuesdays in the weeks of 12, 19 and 26 October, the night total is `=SUM(C32:C35)` instead of `=SUM(C20:C35)`, so it misses Tables 1 to 5. The website doesn't rely on that cell (the script adds up the Pax column itself), but the team's own total is wrong on those Tuesdays. It's fixed in the test copy; the live board needs the same fix.
- Email is almost never filled in. Phone numbers are mostly Israeli (+972), typed in many formats.

---

## 3. The setup

```
 Website /reserve                     Reservations sheet (client's Google account)         Stripe (client's)
 ────────────────                     ────────────────────────────────────────────         ─────────────────
 calendar ──── GET ─────────────▶  Apps Script  ◀── reads ── "Availability" tab
          ◀─ nights, seats left ──                            ▲  refreshed from the weekly board
                                                              │  (Pax per night) on every edit + every 5 min
 "Request the seats" ── POST ──▶  1. re-check the night (refuse if too few seats left)
                                  2. add a row to "Website requests" (Status = New)
                                  3. email the restaurant
                                  4. booking only: create a Stripe customer + card page ──▶ card page (saves a card,
          ◀── card page link ────                                                          charges nothing)
 guest saves a card ───────────────────────────────────────────────────────────────────────▶
          ◀── back to /reserve?request=…&card=1 (or card=0 if they left) ───────────────────
                                  every 10 min: card status pending → saved / missing

 Team: WhatsApp the guest → place them on the weekly board → Status = Approved
       No-show / late cancellation → charge the saved card in the Stripe dashboard
```

| Piece | Where | Owned by | Cost |
|---|---|---|---|
| Weekly board, "Website requests", "Availability" | the reservations spreadsheet | client's Google account | free |
| Booking script (`backend/booking.gs`) | Apps Script attached to that spreadsheet | client's Google account | free |
| Cards | Stripe | client's Stripe account | fees only on no-show charges (§7) |
| Website | static files on Cloudflare | client's Cloudflare account | free |

The only secret, the Stripe key, lives in the script's properties, never in the website. Anyone who can
edit the spreadsheet can read those properties, so use a Stripe **restricted key** (`rk_…`) allowed only
Customers: write, Checkout Sessions: write and SetupIntents: read, never the full secret key.

**Abuse protection in the script** (the web app's address is public): more than 30 requests in a ten-minute
block are refused ("busy"); the same WhatsApp number for the same night and seats is treated as the same request
(answered before it is counted, and given the same card page while that is still open on Stripe);
guest text is written into the sheet as text, never as a formula (a note starting with `=` or `+`);
line breaks are taken out of one-line fields; more than 11 seats (the online maximum) are refused; a failed or
over-quota email never fails the guest; and the
script may only touch its own spreadsheet (`@OnlyCurrentDoc`). Still recommended before going live: Cloudflare
Turnstile on `/reserve` (verified in `doPost`) and Stripe Radar rules for setup intents. Keep both
spreadsheets shared as "Restricted".

---

## 4. The flows

### 4.1 The calendar
1. `/reserve` loads, fades the calendar while it asks the script for nights (`GET`).
2. The script reads "Availability": nights from today on, `Open = yes`, with seats left = capacity − booked.
3. The page groups them into months and shows them. A night with 0 seats left shows "Waitlist".
4. **A night appears once its week is laid out on the board.** How far ahead guests can book = how far ahead the team prepares weekly tabs (currently to 31 October).

"Availability" is rebuilt by `refreshAvailability()`: for every weekly tab, each date merged down column A is a night; **booked = the sum of column C (Pax) within the night**. Capacity defaults to 16 (14 on Saturdays, the weekday read in Bangkok time) and, like Open, can be edited per night: those edits are kept when it refreshes, and an edit there refreshes the tab. Seats left are worked out by the script and written with the rest of each row, one refresh at a time (it holds the script's lock), so the website never reads a half-written night.

### 4.2 A booking request
1. Guest picks a night and seats, fills in name, WhatsApp (required), email, occasion (+ cake for a birthday) and a note, presses "Request the seats".
2. The page sends it (`POST`, as plain text so Apps Script accepts it from another site). A hidden field catches bots.
3. The script, holding a lock:
   - refuses if the night isn't open (`closed`) or has fewer seats left than asked (`not_enough`, with the number left, shown to the guest);
   - turns a booking for a night that has just filled into a waitlist request (the page then thanks the guest for joining the waitlist);
   - adds the row to "Website requests" with Status `New` (yellow), and a request ID (`DAO-…`);
   - emails the restaurant.
4. For a booking, the script creates a Stripe customer and a card page in **setup mode** (saves a card, charges nothing, shows the no-show policy), and the guest goes there.
5. Stripe sends them back to `/reserve?request=…&card=1`, which shows "Requested. Two seats on …". If they left without a card (`card=0`), the page adds that the team will sort it out on WhatsApp.
6. If Stripe isn't set up or fails, the request is still saved (card `missing`), and the guest sees the thank-you message.

### 4.3 A waitlist request
Same form for a full night; no card. The row gets Type `Waitlist` and ID `WL-…`. The page says the team messages them on WhatsApp first if seats open.

### 4.4 What the team does

| Situation | In the sheet |
|---|---|
| New request (yellow) | WhatsApp the guest: menus, dietary needs, occasion. If it works, add them to the weekly board like any booking and set Status = **Approved** (green). If not, **Declined**, or **Waitlisted** to keep them in mind |
| Card `missing` | Ask on WhatsApp; send a Stripe card link from the dashboard, or hold the seats without one |
| Cancellation more than 48 h before | Remove them from the board, Status = Cancelled. Nothing to refund |
| No-show / cancellation inside 48 h | In Stripe, open the customer from the request row, charge the no-show fee, set Card = `charged` |
| Close a night | "Availability" → Open = `no` |
| Seats open on a full night | Work down that night's Waitlist rows in order on WhatsApp |

---

## 5. The new tabs

**Website requests** (one row per request; the script adds rows, the team edits Status, Card, Team notes)

Received · Type (Booking / Waitlist) · Status (New / Approved / Declined / Waitlisted / Cancelled) · Night · Seats · Name · WhatsApp · Email · Special occasion · Cake · Note · Card (pending / saved / missing / charged / charge failed) · Request ID · Stripe customer · Stripe session · Team notes

**Availability** (one row per night; rebuilt by the script, Open and Capacity editable)

Night · Open · Capacity · Booked (from the board) · Seats left (worked out by the script) · Board tab · Updated

**How it works**: the team's instructions, in the sheet itself.

---

## 6. The website side

- Form: night → seats → name, WhatsApp, email, special occasion (dropdown: birthday, anniversary, engagement; a birthday offers a cake, THB 400) and a note. No menu or wine: dietary needs go in the note and on WhatsApp; wine is chosen on the night.
- The panel beside the form shows only the night, the seats and "Request the seats". No price, no card note.
- Code: `src/lib/booking.ts` (logic, `monthsFromNights()`), `src/scripts/systems/booking.ts` (loading nights, sending, the Stripe return), `src/components/reserve/Booking.astro`, copy in `src/content/reserve.ts`, prices in `src/content/site.ts` (`noShowFee`, `cake`).
- **`PUBLIC_BOOKING_API`**: the script's web app address, set at build time. Without it the page runs on the placeholder nights in `src/content/reserve.ts` and "Request the seats" only shows the thank-you message (handy for design work).

---

## 7. Stripe

Card page in setup mode: saves a card, moves no money. The team charges no-shows from the dashboard.

| | Fee per charge |
|---|---|
| Thai cards | 3.65% + ฿10 |
| Foreign cards | 4.75% + ฿10 (plus up to 2% conversion) |
| Disputes | ฿500 each |

- No fee on guests who come. Worth confirming on Stripe's Thailand pricing that saving a card is free.
- A card hold was rejected: holds expire after about 7 days (5 for some Visa), and bookings are made weeks ahead.
- A no-show charge can fail (card cancelled, bank asks the guest to approve). The team follows up on WhatsApp.
- The no-show policy shown on the card page is the evidence against disputes.

Sources: [Stripe Thailand pricing](https://stripe.com/th/pricing) · [Stripe: place a hold](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method) · [Stripe: extended authorizations](https://docs.stripe.com/payments/extended-authorization)

---

## 8. Setting it up

**Test copy (done so far):** [Reservations board – website test (October)](https://docs.google.com/spreadsheets/d/1j6hgpGMNAZs41UMs9tKcCYcaY_Q7OEcLtreN33FUUQk/edit), a full copy of the live board in Ran's Drive. The live board is untouched.

1. [ ] In the test copy: Extensions → Apps Script, paste `backend/booking.gs`. Then Project settings → tick "Show appsscript.json manifest file in editor", open `appsscript.json` and paste `backend/appsscript.json` (it sets the script's time zone to Asia/Bangkok). Save.
2. [ ] Run `setupTestCopy` once (approve Google's permission prompt). It keeps only the weekly tabs with October nights, fixes the Tuesday totals, adds the three tabs and fills "Availability". It refuses to run on the live board.
3. [ ] Project settings → Script properties: `NOTIFY_EMAIL`, `SITE_URL` (the site's address), `STRIPE_SECRET_KEY` (a **restricted test** key, `rk_test_…`, with only the permissions in §3; never a full `sk_` key).
4. [ ] Run `installTriggers` once (refresh every 5 min, card check every 10 min).
5. [ ] Deploy → New deployment → Web app: execute as **me**, access **anyone**. Copy the web app URL.
   After any later change to the script: Deploy → **Manage deployments** → edit (pencil) → Version: **New version** → Deploy. This keeps the same URL; a *new deployment* would get a new URL, and the site would still call the old code.
6. [ ] Set `PUBLIC_BOOKING_API` to that URL in the site's build settings (Cloudflare) and redeploy; or locally, `PUBLIC_BOOKING_API=… npm run build`.
7. [ ] Try it: request seats, save Stripe's test card `4242 4242 4242 4242`, check the row, approve it, place the guests on the board and watch the night's seats drop.

**Going live, on the real board (with the client, in their accounts):**
1. [ ] Fix the Tuesday total formula in their weekly template.
2. [ ] Paste the script and its manifest into the live board, run **`addWebsiteTabs`** (not `setupTestCopy`), then `refreshAvailability`, `installTriggers`, deploy, set properties with a **restricted live** Stripe key (`rk_live_…`).
3. [ ] Point `PUBLIC_BOOKING_API` at the live deployment.
4. [ ] Hosting: the site on the client's Cloudflare, code on their GitHub (Ran and Matteo as collaborators), domain in their name.

**Checks:** `node backend/test/harness.mjs test` runs `booking.gs` against the October board's structure with fake Google services, the script in UTC and the sheet in Bangkok (30 checks: setup, availability, time zone, booking, waitlist and a booking turned waitlist, refusals, the online maximum, repeats and their card page, spam and floods, cards, seats counting once placed). `serve` runs it as a local backend for the site.

---

## 9. Open questions

- [ ] **Start time:** the board says 20:30; the site says arrival at 19:30.
- [ ] **Same-day bookings:** today's night is bookable online. Should online booking close earlier (e.g. the day before)?
- [ ] **Email:** the board almost never has one and no email is sent. The site still requires it; the script already treats it as optional. Make it optional?
- [ ] **Occasions:** add "Honeymoon" and "Other"? Both appear on the board.
- [ ] **Vegetarian / vegan:** the menu dropdown offers both; the FAQ says fully plant-based menus aren't offered. Which is right?
- [ ] **No-show fee:** THB 1,950 a seat is carried over from the old deposit idea (in `site.ts` and the FAQ text).
- [x] **Online maximum:** 11 seats per online request (`onlineMax` in `src/content/reserve.ts`, checked again by the script); 12 or more write in, as the copy says.
- [ ] **Stripe:** confirm their existing account (gift cards were paid via Stripe) and use it.
- [ ] Approve the new copy: booking page, waitlist, card wording on the home page and FAQ.
- [x] No deposit; a saved card holds every booking (2026-09-28).
- [x] WhatsApp required; special occasion with birthday cake; no confirmation email (2026-09-28).
- [x] Menu and wine removed from the form (2026-09-28).
- [x] Build on `astro-port` (Matteo, 2026-09-28).
