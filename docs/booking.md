# Reservations & payment

How booking works on the Dao site, how it connects to the restaurant's reservations sheet, and how to set it up.
Last updated 2026-11-10. Status: the sheet and script are live on Ran's test setup (§8). **Card step built (2026-11-10)**: it waits for a Stripe key in the script's properties (§7).

---

## 1. The short version

- The sheet: [Dao Reservations 2026 (Connected to Website)](https://docs.google.com/spreadsheets/d/1-c8PeRZZYSC1qwbJAAHWjDgvQkssz97uFVoVAmHu5FA/edit), with three tabs: **inbox - new reservations**, **Availability**, and the week's planning (**9-14/11**). The 2024-25 archive stays in "Reservations board 24-25".
- Guests request seats on `/reserve`. The request lands in **"inbox - new reservations"** and the team gets an email.
- The team talks to the guest on WhatsApp, places them in the **week's planning** as they always have, and sets the request to **Approved**.
- **Seats only count once guests are in a week's planning.** A new request never takes a seat by itself.
- The website's calendar reads **seats left per night from the weekly plannings** (the Pax column), through the **"Availability" tab** the script keeps up to date.
- The script never writes to the weekly plannings.
- **A card for three guests or more.** After the request, the guest saves a card on a Stripe page; nothing is charged. If the team sets the request to **Late Cancel** or **No Show**, the script charges THB 1,000 per guest to that card within five minutes; if only some didn't come, the team enters how many in **Missing guests** (§7). One or two guests: no card, no fee.

---

## 2. The restaurant's sheet

**2026 sheet (set up 2026-11-04):** a copy of the 24-25 board with the archive weeks, month overviews, the 2024 waiting list and the gift cards tab removed (all still in "Reservations board 24-25"). It holds the inbox, Availability and one clean week, **9-14/11** (Monday 9 to Thursday 12, and Saturday 14 November), built on the standard layout below with empty seats ("Name / options") and a total under each night. To plan the following week, duplicate the tab, rename it and change the five dates.

**The board as reviewed on 2026-09-28** (then 123 tabs, from August 2024 to October 2026):

- **One tab per week**, e.g. "5-10/10". Nights run **Monday to Thursday, plus Saturday**; closed Friday and Sunday.
- **Each night is a block.** The date is merged down column A; then tables in column B: Table 1 with 4 seat rows, Tables 2–7 with 2 each, so 16 seats (Saturdays have 6 tables, 14 seats). Column C (**Pax**) holds the number of guests per table. The row under each night holds its total, `=SUM(C…)`, and the first night of the week also shows the start time, **20:30**.
- **One row per guest**, with a menu dropdown (options, meat&fish, fish&meat&seafood, fish&seafood, fish only, vegetarian, vegan). Empty seats are template rows reading "Name / options".
- Status columns: **info message sent → menus confirmed → day before confirmation**, then menu comments, **special event**, comments.
- Other tabs: an old "waiting list" (2024), "want to reserve, need to contact back" lists on month tabs, and **gift cards** (several paid via Stripe, so they probably already have an account).

**Found while reviewing:**
- **A formula bug in their template.** On Tuesdays in the weeks of 12, 19 and 26 October, the night total is `=SUM(C32:C35)` instead of `=SUM(C20:C35)`, so it misses Tables 1 to 5. The website doesn't rely on that cell (the script adds up the Pax column itself), but the team's own total is wrong on those Tuesdays. The 2026 sheet's week was built with correct totals; if an old template is reused, check them.
- Email is almost never filled in. Phone numbers are mostly Israeli (+972), typed in many formats.

---

## 3. The setup

```
 Website /reserve                     Reservations sheet (client's Google account)
 ────────────────                     ────────────────────────────────────────────
 calendar ──── GET ─────────────▶  Apps Script  ◀── reads ── "Availability" tab
          ◀─ nights, seats left ──                            ▲  refreshed from the weekly plannings
                                                              │  (Pax per night) on every edit + every 5 min
 "Request the seats" ── POST ──▶  1. re-check the night (refuse if too few seats left)
                                  2. add a row to "inbox - new reservations" (Status = New)
                                  3. email the restaurant
          ◀── thank-you ────────

 Team: WhatsApp the guest → place them in the week's planning → Status = Approved
```

| Piece | Where | Owned by | Cost |
|---|---|---|---|
| Weekly plannings, "inbox - new reservations", "Availability" | the reservations spreadsheet | client's Google account | free |
| Booking script (`backend/booking.gs`) | Apps Script attached to that spreadsheet | client's Google account | free |
| Cards | Stripe | client's Stripe account | fees only on fees charged (§7) |
| Website | static files on Cloudflare | client's Cloudflare account | free |

The one secret is the Stripe key. It lives in the script's properties, never in the
website, and it must be a **restricted key** (`rk_…`), since anyone who can edit the spreadsheet can read them (§7).

**Abuse protection in the script** (the web app's address is public): more than 30 requests in a ten-minute
block are refused ("busy"); the same WhatsApp number for the same night and seats is treated as the same request
(answered before it is counted, and asking Stripe about its card page at most once a minute, so repeats can't spend the script's daily quota);
guest text is written into the sheet as text, never as a formula (a note starting with `=` or `+`);
line breaks are taken out of one-line fields; more than 11 seats (the online maximum) are refused; a failed or
over-quota email never fails the guest; and the
script may only touch its own spreadsheet (`@OnlyCurrentDoc`). Still recommended before going live: Cloudflare
Turnstile on `/reserve` (verified in `doPost`), and Stripe Radar rules. Keep the
spreadsheets shared as "Restricted".

---

## 4. The flows

### 4.1 The calendar
1. `/reserve` loads, fades the calendar while it asks the script for nights (`GET`).
2. The script reads "Availability": nights from today on, `Open = yes`, with seats left = capacity − booked.
3. The page groups them into months and shows them. A night with 0 seats left shows "Waitlist".
4. **Nights open by themselves from the weekly schedule**, set in two cells beside the Availability table: **Open days** (J2, default "Mon, Tue, Wed, Thu, Sat") and **Book ahead (days)** (J3, default 60). Every open day from today to that many days ahead gets a row. A night with no planning yet counts nothing booked ("not planned yet"); once its week's planning exists, the planning supplies the booked seats. The team also can add a special date by hand (a new row; "16/11/2026" as text works) and close any single night with Open = `no`. If the days-ahead cell holds anything but a plain number, 60 is used.
5. On a phone the nights are a list, so each night shows its month ("Mon 16 Nov"); on desktop one month shows at a time under its name, with arrows to the next.
6. Days between the first and last open night that aren't open (outside the schedule, or Open = `no`) show as greyed-out **Closed** columns or rows that can't be picked, so a gap reads as a decision rather than a missing night (`monthsFromNights()` in `src/lib/booking.ts` fills them in).

"Availability" is rebuilt by `refreshAvailability()`: for every weekly tab, each date merged down column A is a night; **booked = the sum of column C (Pax) within the night**. Capacity defaults to 16 (14 on Saturdays, the weekday read in Bangkok time) and, like Open, can be edited per night: those edits are kept when it refreshes, and an edit there refreshes the tab. Seats left are worked out by the script and written with the rest of each row, one refresh at a time (it holds the script's lock), so the website never reads a half-written night.

### 4.2 A booking request
1. Guest picks a night and seats, fills in name, WhatsApp (required), email, occasion (+ cake for a birthday) and a note, presses "Request the seats".
2. The page sends it (`POST`, as plain text so Apps Script accepts it from another site). A hidden field catches bots.
3. The script, holding a lock:
   - refuses if the night isn't open (`closed`) or has fewer seats left than asked (`not_enough`, with the number left, shown to the guest);
   - turns a booking for a night that has just filled into a waitlist request (the page then thanks the guest for joining the waitlist);
   - adds the row to "inbox - new reservations" with Status `New` (yellow), and a request ID (`DAO-…`);
   - emails the restaurant;
   - for three seats or more: writes Card = `pending`, creates a Stripe card page for the request and sends the guest to it (§7).
4. The page shows "Requested. Two seats on …" and that the team will be in touch on WhatsApp.

### 4.3 A waitlist request
Same form for a full night. The row gets Type `Waitlist` and ID `WL-…`. The page says the team messages them on WhatsApp first if seats open.

### 4.4 What the team does

| Situation | In the sheet |
|---|---|
| New request (yellow) | WhatsApp the guest: menus, dietary needs, occasion. If it works, add them to the week's planning like any booking and set Status = **Approved** (green). If not, **Declined**, or **Waitlisted** to keep them in mind |
| Cancellation the day before or earlier | Remove them from the planning, Status = Cancelled. No fee |
| Cancellation on the day, or a no-show | Status = **Late Cancel** or **No Show** (red). Leave **Missing guests** empty to charge every seat, or enter how many didn't come (booked 6, came 4 → 2). Within five minutes the script charges THB 1,000 per missing guest to the saved card and writes the result in Fee. Changing your mind within those minutes (set it back) stops the charge |
| Change which weekdays are open, or how far ahead | "Availability" → the cells beside the table (J2, J3) |
| Open a special date | "Availability" → a new row with its date (Open and Capacity fill in by themselves) |
| Close a night | "Availability" → Open = `no` (deleting a scheduled night's row doesn't work: the schedule adds it back) |
| Seats taken | Count only from the **Pax** column (C) of the week's planning: the number next to "Table N". Names alone don't count. An edit there updates Availability at once |
| Seats open on a full night | Work down that night's Waitlist rows in order on WhatsApp |

---

## 5. The new tabs

**inbox - new reservations** (one row per request; the script adds rows, the team edits Status and Team notes)

Received · Type (Booking / Waitlist) · Status (New / Approved / Declined / Waitlisted / Cancelled / Late Cancel / No Show) · Card (`not needed` / `pending` / `saved` / `missing`) · Fee (written by the script) · Missing guests (optional: how many didn't come; empty = all) · Night · Seats · Name · WhatsApp · Email · Special occasion · Cake · Note · Request ID · Team notes · Stripe customer · Stripe card · Stripe session (the last three are the script's; don't edit)

**Availability** (one row per night; rebuilt by the script, Open and Capacity editable)

Night · Open · Capacity · Booked (from the planning) · Seats left (worked out by the script) · Planning tab · Updated

Until the script runs, Availability holds formulas over the 9-14/11 planning; the script's first refresh replaces them with values, as it always writes.

---

## 6. The website side

- Form: night → seats → name, WhatsApp, email, special occasion (dropdown: birthday, anniversary, engagement; a birthday offers a cake, THB 400) and a note. No menu or wine: dietary needs go in the note and on WhatsApp; wine is chosen on the night.
- The panel beside the form shows the night, the seats and "Request the seats". From three seats it adds "Card details required", a line on the fee and a link to the payment policy (`/info#cancel`); on phones the bar shows the title and the link only. The threshold is `pricing.cardFrom` in `src/content/site.ts`, and `CARD_FROM_SEATS` in the script: change both.
- Code: `src/lib/booking.ts` (logic, `monthsFromNights()`), `src/scripts/systems/booking.ts` (loading nights, sending, and the return from the Stripe card page), `src/components/reserve/Booking.astro`, copy in `src/content/reserve.ts`, prices in `src/content/site.ts` (`noShowFee`, `cake`).
- **`PUBLIC_BOOKING_API`**: the script's web app address, set at build time. Without it the page runs on the placeholder nights in `src/content/reserve.ts` and "Request the seats" only shows the thank-you message (handy for design work).

---

## 7. The card step (Stripe)

Decided 2026-11-10: bookings of **three seats or more** save a card; nothing is charged at booking. A **late cancellation (on the day of the dinner) or a no-show costs THB 1,000 per guest**, charged by the script when the team sets the status. Card holds were rejected (they expire after about 7 days).

**How it runs**
1. The request is saved first, always (a failed card step never loses a booking). Card = `pending`.
2. The script creates a Stripe customer and a Checkout page in **setup mode** (saves a card, moves no money), with the policy written above the button. The site sends the guest there; afterwards they come back to `/reserve`.
3. Every five minutes `processCards()` checks the pending card pages: saved → Card = `saved` (card id in Stripe card); expired (24 h) or skipped → Card = `missing`, and the team asks on WhatsApp.
4. A row set to **Late Cancel** or **No Show** with an empty Fee is charged off-session on the saved card: THB 1,000 × Missing guests, or × all seats when Missing guests is empty. Fee shows `charged THB 2,000 for 2 guests (pi_…)`, `failed: …` (card declined, or the bank wants the guest to approve: follow up on WhatsApp) or `no card saved`. A row is charged once: Stripe refuses a second charge for the same request (idempotency key), and a written Fee is never retried. A wrong Missing guests (not a number, or more than the seats) charges nothing and says so in Fee: fix it and clear Fee. A charge the bank declined can't be retried from the sheet the same day (Stripe repeats its first answer for 24 hours): charge it from the dashboard instead (Customers → the guest → Create payment, with the saved card). To change an amount already charged, refund part of it in the dashboard.
5. Without a Stripe key the booking still goes through; Card = `missing` and Team notes says cards aren't set up.

**Refunds** are made in the Stripe dashboard (Payments → the charge → Refund).

| | Fee per charge |
|---|---|
| Thai cards | 3.65% + ฿10 |
| Foreign cards | 4.75% + ฿10 (plus up to 2% conversion) |
| Disputes | ฿500 each |

- No fee on guests who come. Worth confirming on Stripe's Thailand pricing that saving a card is free.
- A card hold was rejected: holds expire after about 7 days (5 for some Visa), and bookings are made weeks ahead.
- The no-show policy shown on the card page is the evidence against disputes.

Sources: [Stripe Thailand pricing](https://stripe.com/th/pricing) · [Stripe: place a hold](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method) · [Stripe: extended authorizations](https://docs.stripe.com/payments/extended-authorization)

---

## 8. Setting it up

**The 2026 sheet (done):** [Dao Reservations 2026 (Connected to Website)](https://docs.google.com/spreadsheets/d/1-c8PeRZZYSC1qwbJAAHWjDgvQkssz97uFVoVAmHu5FA/edit), in Ran's Drive, with the inbox, Availability and the 9-14/11 week.

1. [ ] In the sheet: Extensions → Apps Script, paste `backend/booking.gs`. Then Project settings → tick "Show appsscript.json manifest file in editor", open `appsscript.json` and paste `backend/appsscript.json` (it sets the script's time zone to Asia/Bangkok). Save.
2. [ ] Run `refreshAvailability` once (approve Google's permission prompt). Availability fills from the 9-14/11 planning.
3. [ ] Project settings → Script properties: `NOTIFY_EMAIL` (where new requests are emailed).
4. [ ] Run `installTriggers` once (Availability refresh and `processCards`, every 5 minutes). Run it again after updating to a version with the card step.
5. [ ] Deploy → New deployment → Web app: execute as **me**, access **anyone**. Copy the web app URL.
   After any later change to the script: Deploy → **Manage deployments** → edit (pencil) → Version: **New version** → Deploy. This keeps the same URL; a *new deployment* would get a new URL, and the site would still call the old code.
6. [ ] Set `PUBLIC_BOOKING_API` to that URL in the site's build settings (Cloudflare) and redeploy; or locally, `PUBLIC_BOOKING_API=… npm run build`.
7. [ ] Stripe: in the client's Stripe dashboard → Developers → API keys → **Create restricted key**, with **Customers: Write, Checkout Sessions: Write, SetupIntents: Read, PaymentIntents: Write**, nothing else. Use test mode (`rk_test_…`) first. In Script properties add `STRIPE_SECRET_KEY` (that key) and `SITE_URL` (the site's address, e.g. `http://localhost:4321` for local tests; where guests return after the card page). Then run `checkStripe` once from the editor: Google asks to allow connecting to an external service (Stripe), and the log says "Stripe key works." Running other functions doesn't ask for that permission, and until it is given every card page fails with a "script.external_request" error in Team notes. Test card: 4242 4242 4242 4242, any future date, any CVC.
8. [ ] Try it: request seats for a night in 9-14/11, check the row in the inbox, approve it, put the guests in the planning (their number in the Pax column) and watch the night's seats drop on the site.

**Going live:** move the sheet into the client's Google account (or have them make the copy), paste the script there, and point `PUBLIC_BOOKING_API` at that deployment. Then archive the test deployment in Ran's copy (Deploy → Manage deployments → Archive), so its address stops taking requests into the test sheet. Only the restaurant's team should be editors of the live sheet: an editor can read the Stripe key and, by setting a status, charge a fee. Hosting: the site on the client's Cloudflare, code on their GitHub (Ran and Matteo as collaborators), domain in their name.

**Checks:** `node backend/test/harness.mjs test` runs `booking.gs` against the October board's structure with fake Google services, the script in UTC and the sheet in Bangkok (48 checks: setup, availability, time zone, booking into the inbox, waitlist and a booking turned waitlist, refusals, the online maximum, repeats, spam and floods, seats counting once placed, the weekly schedule and its days-ahead fallback, hand-added and closed nights, and the card step: the card page, saved and expired cards, the fee per guest charged once, a partial no-show, no card, a failed charge). `serve` runs it as a local backend for the site.

---

## 9. Open questions

- [ ] **Start time:** the site uses 19:30 everywhere for now; the board says 20:30. Ran to confirm.
- [ ] **Same-day bookings:** today's night is bookable online. Should online booking close earlier (e.g. the day before)?
- [ ] **Email:** the board almost never has one and no email is sent. The site still requires it; the script already treats it as optional. Make it optional?
- [ ] **Occasions:** add "Honeymoon" and "Other"? Both appear on the board.
- [ ] **Vegetarian / vegan:** the menu dropdown offers both; the FAQ says fully plant-based menus aren't offered. Which is right?
- [x] **No-show fee:** THB 1,000 per guest, for a same-day cancellation or a no-show, for bookings of three or more; partial no-shows via Missing guests (2026-11-10).
- [x] **Online maximum:** 11 seats per online request (`onlineMax` in `src/content/reserve.ts`, checked again by the script); 12 or more write in, as the copy says.
- [ ] **Stripe:** confirm their existing account (gift cards were paid via Stripe) and create the restricted key there (§8.7).
- [ ] Approve the new copy: booking page, waitlist, card wording on the home page and FAQ.
- [x] No deposit; a saved card holds every booking (2026-09-28). Replaced 2026-11-10: a card only from three seats.
- [x] WhatsApp required; special occasion with birthday cake; no confirmation email (2026-09-28).
- [x] Menu and wine removed from the form (2026-09-28).
- [x] Build on `astro-port` (Matteo, 2026-09-28).
