# Catering ordering: build plan

Issue #190. Design: `/mnt/project-files/catering-design/` (`design-doc.md`,
`3-wireframes.html`, one PNG per wireframe frame in `shots/`, named by screen
id: `c1-…` customer ordering, `o1-…` order link pages, `e1/e2-…` emails,
`a1-…` admin, `d1/d2-…` desktop ordering). The PNGs are the spec for layout
and copy; match them. Copy in them is a Claude draft the owner has seen.

## Ground rules

- Ships dark: catering ordering is off until an owner turns it on in
  Admin → Catering → Settings (`/admin/catering/settings/`, `cateringOrderingOn`, default false; catering and the shop are switched on separately and never read each other's state). While
  off, `/catering/order/` shows the existing "ask about catering" card that
  links to `/contact/`, and every catering button keeps `CATERING_HREF`
  (`/contact/`). While on, catering buttons go to `/catering/order/`.
- Owner preview: while ordering is off, a signed-in owner (`getOwnerSession()`, read only on the dynamic `/catering/order/` page and in `POST /api/catering/checkout`, never on the static `/catering/`, `/order/` or `/menu/`) sees the real builder under an "Owner preview" banner and may place orders; everyone else still gets the ask card and a 503.
- Confirm on return: real-Stripe `success_url` is `/catering/order/sent/?o=<token>&session_id={CHECKOUT_SESSION_ID}`, and the sent page runs `confirmFromReturn` (src/lib/catering/confirmFromReturn.ts): a still-`draft` order whose Checkout Session is `complete` with `metadata.cateringOrderId` equal to the order goes through `completeCateringCheckout`, which is idempotent with the webhook, so emails never send twice.
- Menu and prices come from `src/data/menu.ts` (the Otter mirror) — never a
  second price list. Every item is caterable. Toppings (`toppings`) are free,
  `ways` are free presets, `extras` are paid (Extra Cheese $1, Make it Halal
  $2) and only on items with `takesToppings`. Extra sauce is the menu's own
  sauce item. Plates, napkins and utensil sets are free, asked by count.
- Stores: Hollywood and Van Nuys only (ids from `src/data/locations.ts`).
  Glendale later: drive it from a list, not ifs.
- Money is integer cents everywhere. Tax 9.75% on food (subtotal of lines),
  not on delivery or tip. Delivery flat $25 (setting). Tip 0/10/15/20% of food
  or a custom amount, default 10%.
- Lead time: 48 h before the chosen time (the `leadHours` setting), for every
  order whatever its size; there is no headcount rule. Anything
  sooner shows the "Too soon" state linking to `/contact/` (never a phone
  link). Times come from owner-set catering hours per store per weekday, in
  30-minute slots, minus days off. No capacity limits. All times are
  America/Los_Angeles.
- Delivery range: 10 driving miles (setting). There is no maps API. Estimate
  from ZIP centroid distance (the `zipcodes` npm package, server-only) × 1.25,
  rounded to 0.1 mi; show "about X mi". Unknown ZIP: accept and flag the
  order for the owner.
- Payment: Stripe Checkout Session, `mode: "payment"`,
  `payment_intent_data.capture_method: "manual"`, `setup_future_usage:
"off_session"`, a Stripe Customer per email, line items built from our own
  quote (food lines, delivery, tax, tip as price_data). On
  `checkout.session.completed` the order becomes `requested` (card held).
  Owner Approve → capture → `booked`. Decline → cancel the PaymentIntent →
  `declined`. No owner action within 24 h of the request → cancel →
  `expired` (a Vercel cron route plus a lazy check on every read).
- Test mode: when `CATERING_FAKE_PAYMENTS=1` locally or on Vercel Preview, the
  payment adapter skips Stripe: checkout redirects straight to the success
  page and marks the order held; capture/cancel/refund are no-ops that
  record fake ids. Playwright sets it. Preview requires an isolated test
  database. Production and other Vercel environments reject the flag. While it is on, the review step and the sent page show "Test mode: no card is
  charged."
- Cancellation (customer, from the order link): free until 48 h before the
  time, 50% back from 48 h to 24 h, nothing inside 24 h. Before approval,
  cancelling releases the hold. After capture, refund the tier's share.
- Changes (customer, from the order link, while `requested` or `booked` and
  at least 48 h out): reopen the builder with the order, send the change; the
  owner approves or declines it. Approved change: if more, charge the saved
  card off-session for the difference; if less, refund the difference.
  Before capture, re-authorize instead.
- No accounts. Each order has an unguessable token; the order link is
  `/catering/o/<token>/`. "Find my orders" emails links to every order for
  that email (always answers "sent", never reveals whether an email exists).
- Order numbers `CAT-1001…` from their own sequence.
- Names and notes: any line may carry "for" (a person's name, ≤ 40 chars) and
  a note (≤ 140 chars). Identical lines merge in the cart only when item,
  way, toppings, extras, name and note all match.
- Emails (in `src/lib/email.ts` style, dark-mode aware): customer "Request
  received", "You're booked", "Declined", "Expired", "Cancelled", "Change
  received/approved/declined", "Find my orders", "Thank you" (the day after,
  with the Google review ask); owner "New catering request" (itemized, to
  `CATERING_OWNER_EMAIL`, default `chris@chrisneddys.com`) with links to the
  admin order, crew ticket and invoice. Customer emails are drafts: the owner
  approves previews before ordering is turned on.
- Admin: a "Catering" nav entry on every admin page; `/admin/catering/` list
  (tabs: Needs you / Upcoming / Past, search), `/admin/catering/[id]/` order
  page (approve, decline with reason, timeline, notes), print pages
  `/admin/catering/[id]/crew-ticket/`, `/labels/`, `/invoice/`; Overview gets
  a catering card; Catering gets its own Settings page (on/off, hours per store
  per weekday, days off, delivery fee, range, reply hours, owner email).
- Crew ticket (owner's latest ask): lead with times (day, ready by = 30 min
  before, driver leaves = 20 min before for delivery, deliver/pickup at), who
  and where. Then a MAKE LIST grouped by item, then by exact build: e.g.
  "2 Sliders and Fries × 12 — 2 Chris's Way · 10 Lettuce, Sauce, Grilled
  Onion", each build with its count, checkbox, halal in black, and the name
  for any named line. Multiple pages are fine (print CSS page breaks between
  sections, repeat the order number and page x of y). Station totals go last
  as a small summary, not first.
- Invoice: as `o4-invoice-letter-size.png`; the customer gets it from the
  order link, the owner from admin.

## Phases (each lands as its own commit on `claude/catering-ordering-design-llyjtb`)

1. Core library `src/lib/catering/` (pure, unit tested): menu pricing and
   line keys, quote, slots and lead time, range estimate, cancellation
   refund, crew make-list grouping and station counts, order number format.
2. Database: tables `catering_orders`, `catering_order_items`,
   `catering_events` (timeline), `catering_settings` (singleton), sequence;
   migration via `pnpm db:generate`; data layer `src/lib/catering/orders.ts`.
3. Payments + server: adapter (Stripe/fake), `/api/catering/checkout`,
   webhook handling, approve/decline/cancel/change/expire, cron route,
   emails.
4. Customer UI: `/catering/order/` steps C1–C11 (phone first, desktop D1–D2),
   cart in `localStorage`, item sheet with per-topping picks, Feed my crew,
   `/catering/order/sent/`, `/catering/o/[token]/` O1–O5, invoice.
5. Admin: nav, list, order page, print pages, overview card, settings.
6. Playwright: every flow step by step at 390×844 (iPhone) and 1280×800,
   with fake payments: pickup order, delivery order with named lines,
   too far, too soon, 48 h notice for any order size, closed day, approve, decline, expire,
   cancel tiers, change, find my orders, admin settings, print pages.

## Contracts between phases 3, 4 and 5

Already built: `src/lib/catering/` pure library (index.ts barrel) and
`orders.ts` / `settings.ts` data layer. Note two hours shapes exist: the
database stores `CateringHours` from `src/db/schema.ts` (store → weekday
string → windows, empty = closed); the library uses `CateringHours` from
`types.ts`. `hours.ts` converts.

Phase 3 (server) owns and exports:

- `src/lib/catering/hours.ts`: `toScheduleHours(dbHours)`, `toScheduleDaysOff(dbDaysOff)`.
- `src/lib/catering/public.ts`: `getPublicCateringConfig(db)` →
  `{ orderingOn, stores: {id, name, address, city, zip, phone}[], hours, daysOff,
deliveryFeeCents, rangeMiles, replyHours, leadHours }`
  (hours/daysOff in the library shape). Safe to pass to client components.
- `POST /api/catering/range` `{store, zip}` → `{miles: number|null, inRange: boolean, unknown: boolean}`.
- `POST /api/catering/checkout` body
  `{store, fulfilment, date:"YYYY-MM-DD", time:"HH:MM", lines: CartLine[],
tip: {percent}|{cents}, plateSets, contact:{name,email,phone}, company?, poNumber?,
onsite?:{name,phone}, address?:{line1,line2?,city,state,zip,instructions?}, customerNote?}`
  → `200 {url}` (Stripe Checkout, or `/catering/order/sent/?o=<token>` in fake mode) |
  `409 {error:"too-soon"|"closed"|"out-of-range"|"price-changed"}` |
  `400 {error:"invalid", fields: Record<string,string>}` | `503 {error:"off"}`.
  Stripe cancel URL: `/catering/order/?step=review&canceled=1`.
- `src/lib/catering/service.ts` (server-only, takes `db`):
  `getOrderView(db, token)` (lazily expires overdue requests; returns order, items,
  events, cancellation quote, whether change/cancel allowed) ·
  `cancelByCustomer(db, token)` · `requestChange(db, token, {lines, time?, tip?})` ·
  `findMyOrders(db, email)` (emails links; always resolves) ·
  `approveOrder(db, id)` · `declineOrder(db, id, reason)` · `approveChange(db, id)` ·
  `declineChange(db, id, reason?)` · `markCompleted(db, id)` · `expireDue(db, now)` ·
  `addNote(db, id, text)`. Each returns `{ok:true} | {ok:false, error}` and
  records a `catering_events` row and sends its email.
- `src/lib/catering/emails.ts`: one builder per email returning `{subject, html, text}`
  plus senders; `renderCateringEmailPreviews()` returning every email for a
  sample order (for the admin preview page).
- `GET /api/catering/cron` (Vercel cron, `CRON_SECRET` bearer): `expireDue`, and the
  day-after thank-you email for completed orders.

Phase 4 (customer UI) owns `src/app/(site)/catering/order/**`,
`src/app/(site)/catering/o/**`, `src/components/catering-order/**`,
`src/styles/catering-order.css`, and the catering buttons switching to
`/catering/order/` when ordering is on. Its server actions call `service.ts`.

Phase 5 (admin) owns `src/app/(admin)/admin/catering/**`, the Catering nav
entry, the settings section, the overview card, and
`/admin/catering/emails/` (preview of every catering email for the owner's OK).
