# Reservations & deposits

How booking and payment work on the Dao site: what exists today, what we decided, and the planned setup.
Last updated 2026-09-28. Status: **planned, not built**.

---

## 1. Where things stand today

- The site is Astro (the `astro-port` branch; all work happens there). The reservation page (`/reserve`) is front-end only. **Nothing is saved and nothing is charged.**
- Availability is placeholder data: `months` in `src/content/reserve.ts` (seats left per night). The table size is `TABLE = 16` in `src/lib/booking.ts`.
- Prices and the deposit rule are in `src/content/site.ts` (`pricing`: `menu`, `pairingFour`, `pairingFive`, `depositShare: 0.5`).
- "Hold the seats" only shows the confirmation. The booking logic is in `src/lib/booking.ts` (shared by the server render and the browser), the browser behaviour in `src/scripts/systems/booking.ts`, and the markup in `src/components/reserve/Booking.astro`.
- The site builds to static files, so live availability has to be loaded **in the browser** when the page opens (in `src/scripts/systems/booking.ts`), not at build time.
- The client's current site is on **Wix**, which also takes their payments. The goal of the migration is to drop the Wix subscription.

### What the form collects today

| Field | Values | Required |
|---|---|---|
| Night | a date from the calendar | yes |
| Seats | 1 to the seats left that night | yes |
| Menu | `meat` or `fish` | yes |
| Wine pairing | `0` (none), `4` glasses, `5` glasses | yes |
| Name | text | yes |
| Email | valid email | yes |
| Phone | text | no |
| Note | free text (allergies, occasion…) | no |

### Prices used by the page (placeholders, not client-confirmed)

| Item | THB |
|---|---|
| Menu, per guest | 3,900 |
| Pairing, 4 glasses | 2,200 |
| Pairing, 5 glasses | 2,700 |
| **Deposit, per seat** | **1,950** (half the menu price) |
| Rest | paid at the table |

Other rules stated in the site copy: 16 seats, one seating at 19:30, full refund if cancelled more than 48 hours before, and 12+ guests should write in rather than book online.

---

## 2. Decisions

1. **The client's Google Sheet is the booking system.** The site reads availability from it and writes bookings to it. Bookings the team takes by phone or WhatsApp go straight into the sheet and count against availability.
2. **A booking is saved even if the deposit fails.** Payment status is a column, not a gate. The team follows up personally on unpaid deposits.
3. **The client owns every account**: Google, Stripe, hosting, domain, and ideally the code on GitHub. Nobody outside the business (Ran, Matteo) should be needed to keep bookings running.
4. **Keep it simple.** No separate server. The website stays static files.

---

## 3. The setup

```
 Guest's browser                  Client's Google account               Client's Stripe account
 ───────────────                  ───────────────────────               ───────────────────────
 /reserve page  ── get nights ──▶  Apps Script (inside the Sheet)
                ◀─ seats left ──   reads the Bookings + Nights tabs

 "Hold the seats" ─ booking ────▶  1. lock the sheet
                                   2. re-check seats left
                                   3. add a row (deposit: pending)
                                   4. email the restaurant
                                   5. create a Checkout session  ─────▶  Stripe Checkout page
                ◀─ payment link ─                                        (amount = seats × 1,950)
 redirect to Stripe ────────────────────────────────────────────────────▶ guest pays (or doesn't)
                                                                          │
                                   Every 10 min: check pending rows ◀────┘
                                   → mark paid / unpaid / expired
```

| Piece | Lives in | Owned by | Cost |
|---|---|---|---|
| Bookings sheet | Google Sheets | Client's Google account | Free |
| Booking script | Apps Script attached to that sheet | Client's Google account | Free |
| Payments | Stripe | Client's Stripe account (Thai business, Thai bank account) | Per payment only (§6) |
| Website | Static files on Cloudflare | Client's Cloudflare account (free plan) | Free |

The only secret is the Stripe secret key. It is stored in the script's settings (Script Properties), never in the website code.

---

## 4. The flows

### 4.1 Showing availability

1. The page loads and asks the script for the upcoming nights.
2. The script reads the **Nights** tab (which nights are open, capacity per night) and adds up the seats in the **Bookings** tab for each night.
   - Status `cancelled` → does not count.
   - All other statuses count, including `pending` and `unpaid`. A seat is held until the team cancels the booking.
3. The script returns `[{ date, seatsLeft }]`, cached for about 60 seconds.
4. The page shows "Full" for nights with 0 seats left and limits the seat picker to what's left.

### 4.2 Making a booking

1. The guest fills in the form and presses "Hold the seats". The page shows a "Holding your seats…" state, because the script takes 1 to 3 seconds.
2. The page sends the booking to the script.
3. The script:
   1. **Locks the sheet**, so two guests can't take the last seat at the same moment.
   2. Re-checks seats left for that night. If there aren't enough, it answers "no longer available" and the page asks the guest to pick again.
   3. Checks the fields (same rules as the form) and a hidden anti-spam field.
   4. Adds the row with a new booking ID and deposit status `pending`.
   5. Unlocks the sheet.
   6. Emails the restaurant: "New booking: 2 seats, Tue 14 Oct…".
   7. Creates a Stripe Checkout session: seats × ฿1,950, guest's email prefilled, and the booking ID attached so the payment can be matched to the row.
   8. Returns the payment link.
4. The page sends the guest to Stripe's payment page.
5. **If creating the payment fails** (for example, Stripe is down), the booking is still saved. The guest sees a confirmation saying the team will be in touch about the deposit, and the row is marked `unpaid`.

### 4.3 After payment

- Success → Stripe sends the guest back to `/reserve?booking=<id>&paid=1`, and the page shows the confirmation. Stripe emails the guest a receipt.
- Cancelled or abandoned → Stripe sends them back to `/reserve?booking=<id>&paid=0`. The page shows "Your seats are held. We'll contact you about the deposit".
- **Every 10 minutes** a timer in the script checks Stripe for each `pending` row:
  - paid → `paid`, with the payment reference
  - Checkout expired (24 h) or failed → `unpaid`, so the team follows up
- We deliberately don't rely on Stripe calling the script directly (webhooks). Apps Script handles incoming webhooks badly, and checking every 10 minutes is simpler and reliable.

### 4.4 What the team does in the sheet

| Situation | Action |
|---|---|
| Phone or walk-in booking | Add a row by hand; source `manual`; deposit status as appropriate |
| Unpaid deposit | Contact the guest; mark `paid (manual)` if they pay another way, or `cancelled` |
| Cancellation more than 48 h before | Refund in the Stripe dashboard, set status `cancelled` |
| Close a night or change capacity | Edit the **Nights** tab |

---

## 5. Sheet layout (proposed; to be matched to the client's real sheet)

**Bookings** tab: one row per booking

| Column | Example | Filled by |
|---|---|---|
| Booking ID | `DAO-7K3F` | script |
| Created | 2026-10-02 14:31 | script |
| Night | 2026-10-14 | script / team |
| Seats | 2 | script / team |
| Menu | meat / fish | script / team |
| Pairing | 0 / 4 / 5 | script / team |
| Name, Email, Phone, Note | … | script / team |
| Source | `website` / `manual` | script / team |
| Status | `confirmed` / `cancelled` | script / team |
| Deposit | `pending` / `paid` / `unpaid` / `paid (manual)` / `refunded` | script / team |
| Deposit amount (THB) | 3,900 | script |
| Stripe reference | `cs_…` / `pi_…` | script |

**Nights** tab: one row per night that can be booked

| Night | Open | Capacity |
|---|---|---|
| 2026-10-14 | yes | 16 |
| 2026-10-18 | no | 16 |

---

## 6. Payment provider

**Stripe** is the pick: available for Thai businesses, no monthly fee, and simple to connect from Apps Script.

| | Fee per payment |
|---|---|
| Thai cards | 3.65% + ฿10 |
| Foreign cards | 4.75% + ฿10 (plus up to 2% if Stripe converts currency) |
| PromptPay | 1.65% |
| Disputes | ฿500 each |

- About ฿100 in fees per ฿1,950 deposit on a foreign card.
- Stripe keeps its fee when a deposit is refunded.
- Payouts go to the client's Thai bank account in THB.
- Alternative: **Opn Payments** (formerly Omise, Thai): cards 3.65%, PromptPay 1.65%, plus 7% VAT on the fees.
- **Check first:** which provider is connected to the client's Wix site today. If it's Stripe or Opn, they can keep the same account after leaving Wix.

Sources: [Stripe Thailand pricing](https://stripe.com/th/pricing) · [Omise pricing, Thailand](https://www.omise.co/en/pricing/thailand)

---

## 7. Known limits

- **Speed**: the script takes 1 to 3 seconds per request, so the page needs clear loading states.
- **Email limits**: about 100 emails a day from a free Gmail account, 1,500 on Google Workspace. That's plenty at 16 seats a night.
- **Public web address**: the script is reachable by anyone who finds it. The anti-spam field, field checks and the seat re-check limit abuse. If spam becomes a problem, add Cloudflare Turnstile (a free CAPTCHA alternative).
- **Seats are held until the team cancels them**: an unpaid booking keeps its seats. That's intentional (decision 2), but the team needs to review unpaid rows.

---

## 8. Client setup checklist (about 30 minutes, done together)

1. [ ] Client creates a Stripe account with their Thai business details and bank account (or confirms the one behind Wix).
2. [ ] Client makes a copy of the booking sheet template (or we adapt their sheet to §5).
3. [ ] Paste the script into the sheet: Extensions → Apps Script.
4. [ ] Add `STRIPE_SECRET_KEY` and `NOTIFY_EMAIL` in the script's settings (Script Properties).
5. [ ] Deploy as a web app, running as the client, accessible to anyone. Copy the web app address.
6. [ ] Put that address into the site's settings, then rebuild and deploy.
7. [ ] Turn on the 10-minute timer (a time-driven trigger) for the payment check.
8. [ ] Test end to end with Stripe test keys, then switch to live keys.
9. [ ] Hosting: move the site to the client's Cloudflare account and the code to their GitHub (Ran and Matteo as collaborators). Domain in the client's name.

---

## 9. Open questions

- [ ] **Client:** the real sheet's layout, or approval of §5.
- [ ] **Client:** which payment provider is behind the Wix site.
- [ ] **Client:** confirm prices, deposit rule, capacity, 19:30 seating and the cancellation policy (all placeholders from design).
- [ ] **Client:** the seat picker allows up to 16 seats, but the copy says 12 or more should write in. Should the online maximum be 11?
- [ ] **Client:** deposit up front (this plan), or save the card and charge only for no-shows?
- [x] **Matteo:** build on `astro-port` (confirmed 2026-09-28).
