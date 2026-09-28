#!/usr/bin/env node
/**
 * Seeds one catering order for local/e2e use — the "round-3" wireframe
 * order (`a3-catering-order-new-request-desktop.png` and friends): a
 * Northlight Pictures delivery for 60 people, Van Nuys, Friday at 12:30 PM,
 * with a mix of bulk builds and named lines (including a halal table and a
 * halal individual order).
 *
 * Run directly with plain `node` (no build step, no test runner) the same
 * way `db-warmup.mjs` does — same resolve hook, same "run once against
 * whatever `DATABASE_URL`/`PGLITE_DATA_DIR` the caller already set" shape —
 * so the e2e phase (and anyone poking at `/admin/catering` locally) can
 * reuse it instead of hand-building an order through the UI:
 *
 *   PGLITE_DATA_DIR=.pglite/adm DATABASE_URL= node e2e/seed-catering.mjs
 *
 * Only imports `src/lib/catering/orders.ts` (the data layer, whose own
 * imports are all `@/...`, which `order-seed-resolve-hook.mjs` already
 * resolves) rather than also reaching into `pricing.ts`: that module's
 * *relative*, extension-less imports (`./menu-adapter`) aren't something
 * that hook fixes, and it exists for `db-warmup.mjs`'s needs, not this
 * file's — so amounts and labels here are computed by hand instead, from
 * the same menu prices/ways/toppings `src/data/menu.ts` defines (checked
 * against the wireframe's own numbers in the comments below).
 *
 * Always creates a *new* order (catering order numbers come from their own
 * sequence), so re-running this just adds another `CAT-xxxx` — never a
 * problem for local poking, and the e2e phase calls it once per test that
 * needs a seeded order.
 */
import { register } from "node:module";

// See e2e/order-seed-resolve-hook.mjs: makes `@/...` resolvable to plain
// `node` so `orders.ts` (and the schema/db-client modules it imports) can
// be imported as-is, unbundled.
register("./order-seed-resolve-hook.mjs", import.meta.url);

const { createDraftOrder, setStatus, recordEvent } = await import("../src/lib/catering/orders.ts");

const TAX_RATE_BPS = 975; // 9.75%, out of 10,000 — matches pricing.ts.
const DELIVERY_FEE_CENTS = 2500;
const TIP_PERCENT = 10;

/** One line as the customer's cart would hold it, `unitCents` already
 * resolved by hand from `src/data/menu.ts`'s own prices (dollars × 100)
 * plus any extras' price — the same math `unitPriceCents` (`pricing.ts`)
 * does. */
const LINES = [
  // 30 × 2 Sliders and Fries, Chris's Way — $17.49 × 30 = $524.70.
  {
    itemId: "2-sliders-and-fries",
    itemName: "2 Sliders and Fries",
    qty: 30,
    wayId: "chris",
    wayLabel: "Chris’s Way",
    toppings: ["lettuce", "tomato", "cne-sauce", "raw-onions"],
    toppingLabels: ["Lettuce", "Tomato", "CNE Sauce", "Raw Onions"],
    extras: [],
    extraLabels: [],
    unitCents: 1749,
  },
  // 20 × 2 Sliders and Fries, Eddy's Way — $17.49 × 20 = $349.80.
  {
    itemId: "2-sliders-and-fries",
    itemName: "2 Sliders and Fries",
    qty: 20,
    wayId: "eddy",
    wayLabel: "Eddy’s Way",
    toppings: ["cne-sauce", "grilled-onions"],
    toppingLabels: ["CNE Sauce", "Grilled Onions"],
    extras: [],
    extraLabels: [],
    unitCents: 1749,
  },
  // 6 × 2 Sliders and Fries, custom (Sauce/Lettuce/Pickles) + Make it Halal,
  // for the halal table — ($17.49 + $2.00) × 6 = $116.94.
  {
    itemId: "2-sliders-and-fries",
    itemName: "2 Sliders and Fries",
    qty: 6,
    wayId: "custom",
    wayLabel: null,
    toppings: ["cne-sauce", "lettuce", "pickles"],
    toppingLabels: ["CNE Sauce", "Lettuce", "Pickles"],
    extras: ["make-it-halal"],
    extraLabels: ["Make it Halal"],
    unitCents: 1949,
    forName: "Halal table",
    note: "Separate tray, label it",
  },
  // 1 Triple Patty Slider, Eddy's Way + Extra Cheese, for Dev Patel —
  // $9.49 + $1.00 = $10.49.
  {
    itemId: "triple-patty-slider",
    itemName: "Triple Patty Slider",
    qty: 1,
    wayId: "eddy",
    wayLabel: "Eddy’s Way",
    toppings: ["cne-sauce", "grilled-onions"],
    toppingLabels: ["CNE Sauce", "Grilled Onions"],
    extras: ["extra-cheese"],
    extraLabels: ["Extra Cheese"],
    unitCents: 1049,
    forName: "Dev Patel",
  },
  // 1 Grilled Cheese (no toppings), for Priya S. — $4.00.
  {
    itemId: "grilled-cheese",
    itemName: "Grilled Cheese",
    qty: 1,
    wayId: null,
    wayLabel: null,
    toppings: [],
    toppingLabels: [],
    extras: [],
    extraLabels: [],
    unitCents: 400,
    forName: "Priya S.",
    note: "Vegetarian: clean spot on the griddle",
  },
  // 1 Chris N Eddy's Slider, custom (Lettuce/Tomato/Pickles) + Make it
  // Halal, for Marcus L. — $8.49 + $2.00 = $10.49.
  {
    itemId: "chris-n-eddy-s-slider",
    itemName: "Chris N Eddy's Slider",
    qty: 1,
    wayId: "custom",
    wayLabel: null,
    toppings: ["lettuce", "tomato", "pickles"],
    toppingLabels: ["Lettuce", "Tomato", "Pickles"],
    extras: ["make-it-halal"],
    extraLabels: ["Make it Halal"],
    unitCents: 1049,
    forName: "Marcus L.",
    note: "No sauce, no onion",
  },
  // 1 The Quad, Chris's Way, for Jordan K. — $11.28.
  {
    itemId: "the-quad",
    itemName: "The Quad",
    qty: 1,
    wayId: "chris",
    wayLabel: "Chris’s Way",
    toppings: ["lettuce", "tomato", "cne-sauce", "raw-onions"],
    toppingLabels: ["Lettuce", "Tomato", "CNE Sauce", "Raw Onions"],
    extras: [],
    extraLabels: [],
    unitCents: 1128,
    forName: "Jordan K.",
  },
  // 20 chocolate shakes — $4.49 × 20 = $89.80.
  {
    itemId: "chocolate-shake-20-oz-cup",
    itemName: "Chocolate Shake (20 oz cup)",
    qty: 20,
    wayId: null,
    wayLabel: null,
    toppings: [],
    toppingLabels: [],
    extras: [],
    extraLabels: [],
    unitCents: 449,
  },
  // 20 extra sauce cups — $0.75 × 20 = $15.00.
  {
    itemId: "extra-chris-n-eddy-s-sauce",
    itemName: "Extra Chris N Eddy's Sauce",
    qty: 20,
    wayId: null,
    wayLabel: null,
    toppings: [],
    toppingLabels: [],
    extras: [],
    extraLabels: [],
    unitCents: 75,
  },
];

function roundHalfUpTax(foodCents) {
  return Math.floor((foodCents * TAX_RATE_BPS + 5000) / 10000);
}

const LA_ZONE = "America/Los_Angeles";

const LA_PARTS_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: LA_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function laParts(atMs) {
  const parts = Object.fromEntries(
    LA_PARTS_FORMAT.formatToParts(new Date(atMs)).map((p) => [p.type, p.value]),
  );
  const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAYS[parts.weekday],
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/** The LA UTC offset in effect at `atMs`, in milliseconds (west of UTC is negative). */
function laOffsetMs(atMs) {
  const { year, month, day, hour, minute } = laParts(atMs);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  return asIfUtc - atMs;
}

/** The UTC instant for wall-clock `year-month-day` + `hour:minute` in Los
 * Angeles, correct across the DST transitions (same two-pass trick as
 * `zonedTimeToUtcMs` in `src/lib/catering/timezone.ts` — duplicated here
 * since this script can't import that module's relative imports, per the
 * header comment above). */
function laDateToUtc(year, month, day, hour, minute) {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = laOffsetMs(naiveUtc);
  let utc = naiveUtc - offset;
  const offset2 = laOffsetMs(utc);
  if (offset2 !== offset) utc = naiveUtc - offset2;
  return new Date(utc);
}

/** The next Friday at `hour:minute` America/Los_Angeles wall-clock time, at
 * least `daysOutMin` days out — safely past the 72h big-order lead time no
 * matter what time zone this script runs in (the sandbox runs UTC). */
function nextFridayAt(hour, minute, daysOutMin) {
  const now = new Date();
  const today = laParts(now.getTime());
  const FRIDAY = 5;
  let daysUntilFriday = (FRIDAY - today.weekday + 7) % 7 || 7;
  let date = laDateToUtc(today.year, today.month, today.day + daysUntilFriday, hour, minute);
  while ((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000) < daysOutMin) {
    daysUntilFriday += 7;
    date = laDateToUtc(today.year, today.month, today.day + daysUntilFriday, hour, minute);
  }
  return date;
}

async function main() {
  const items = LINES.map((line) => ({
    itemId: line.itemId,
    itemName: line.itemName,
    qty: line.qty,
    wayId: line.wayId,
    wayLabel: line.wayLabel,
    toppings: line.toppings,
    toppingLabels: line.toppingLabels,
    extras: line.extras,
    extraLabels: line.extraLabels,
    unitCents: line.unitCents,
    amountCents: line.unitCents * line.qty,
    forName: line.forName ?? null,
    note: line.note ?? null,
  }));

  const foodCents = items.reduce((sum, item) => sum + item.amountCents, 0);
  const deliveryCents = DELIVERY_FEE_CENTS;
  const taxCents = roundHalfUpTax(foodCents);
  const tipCents = Math.round((foodCents * TIP_PERCENT) / 100);
  const totalCents = foodCents + deliveryCents + taxCents + tipCents;

  const eventAt = nextFridayAt(12, 30, 10);

  const draft = await createDraftOrder({
    store: "vannuys",
    fulfilment: "delivery",
    eventAt,
    headcount: 60,
    contactName: "Maya Torres",
    contactEmail: "maya@northlightpictures.com",
    contactPhone: "(818) 555-0142",
    company: "Northlight Pictures",
    poNumber: "NL-4471",
    onsiteContactName: "Dev Patel",
    onsiteContactPhone: "(818) 555-0199",
    address: {
      line1: "7120 Hayvenhurst Ave",
      line2: "Stage 4, gate B",
      city: "Van Nuys",
      state: "CA",
      zip: "91406",
      instructions: "Call on arrival, security desk at gate B",
    },
    distanceMiles: 3.4,
    rangeUnknown: false,
    plateSets: 60,
    items,
    foodCents,
    deliveryCents,
    taxCents,
    tipCents,
    totalCents,
  });

  const respondBy = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await setStatus(draft.orderId, "requested", { requestedAt: new Date(), respondBy });
  await recordEvent(draft.orderId, "requested", "customer", { totalCents });

  console.log(
    `Seeded catering order ${draft.number} (${draft.orderId}), token ${draft.token}, total ${(totalCents / 100).toFixed(2)}.`,
  );
  return draft;
}

const draft = await main();
export { draft };
