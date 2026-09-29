#!/usr/bin/env node
/**
 * Seeds two catering orders in states the customer UI (or a live admin
 * click) can never reach on its own — the same reason `db-warmup.mjs`
 * seeds `foam-trucker-blue` orders and `seed-catering.mjs` seeds CAT-1001,
 * and run the same way: plain `node`, single process, before `next build`/
 * `next start` ever open the e2e PGlite data directory.
 *
 * This replaces an earlier design where `e2e/catering/cancel.spec.ts` and
 * `expired.spec.ts` created their order through the live customer UI and
 * then reached into the database from a *second* `node` process (a
 * `db-mutate.mjs` CLI, since removed) to move it into a state the UI can't
 * produce, while `next start` already had that same PGlite data directory
 * open. `src/db/client.ts`'s own module comment already documents why that
 * doesn't work — "PGlite can't have two live instances on one data
 * directory" — and it showed up here exactly as that comment predicts: the
 * second process's write would eventually land, but only after the two
 * instances fought over the same on-disk files for anywhere from tens of
 * seconds to several minutes, which blew through every Playwright timeout
 * in the suite. Seeding both fixtures here instead is the same fix
 * `db-warmup.mjs`/`seed-catering.mjs` already use for "a state the UI can't
 * reach" — do it in the one process that's allowed to hold the directory
 * open before the server that will hold it next even starts.
 *
 * Both orders' customer tokens are written to `.fixtures.json` (gitignored
 * — see `.gitignore`'s `e2e/catering/.fixtures.json` line) next to this
 * script's caller, for `cancel.spec.ts`/`expired.spec.ts` to `readFileSync`
 * directly — a plain file read, not a second database connection, so it
 * carries none of the multi-process risk above.
 *
 * Skipped (both orders) when `.fixtures.json` already exists, the same
 * idempotency guard `db-warmup.mjs` uses for its own seeds.
 */
import { register } from "node:module";
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./order-seed-resolve-hook.mjs", import.meta.url);

const { createDraftOrder, setStatus, recordEvent } = await import("../src/lib/catering/orders.ts");
const { approveOrder } = await import("../src/lib/catering/service.ts");
const { getDb } = await import("../src/db/client.ts");

const root = dirname(fileURLToPath(import.meta.url));
const fixturesPath = join(root, "catering", ".fixtures.json");

if (existsSync(fixturesPath)) {
  console.log("e2e catering fixtures already present — skipping seed.");
  process.exit(0);
}

const db = await getDb();

/** One plain pickup line, just enough for `createDraftOrder` — same shape
 * `seed-catering.mjs` builds by hand from `src/data/menu.ts`'s own prices. */
function oneLine() {
  const unitCents = 1749; // 2 Sliders and Fries.
  const qty = 4;
  return {
    items: [
      {
        itemId: "2-sliders-and-fries",
        itemName: "2 Sliders and Fries",
        qty,
        wayId: "chris",
        wayLabel: "Chris’s Way",
        toppings: ["lettuce", "tomato", "cne-sauce", "raw-onions"],
        toppingLabels: ["Lettuce", "Tomato", "CNE Sauce", "Raw Onions"],
        extras: [],
        extraLabels: [],
        unitCents,
        amountCents: unitCents * qty,
        forName: null,
        note: null,
      },
    ],
    foodCents: unitCents * qty,
  };
}

async function seedExpired() {
  const { items, foodCents } = oneLine();
  const taxCents = Math.round(foodCents * 0.0975);
  const totalCents = foodCents + taxCents;
  const eventAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  const draft = await createDraftOrder(
    {
      store: "hollywood",
      fulfilment: "pickup",
      eventAt,
      contactName: "Expired Fixture",
      contactEmail: "expired.fixture@example.com",
      contactPhone: "(818) 555-0901",
      items,
      foodCents,
      taxCents,
      totalCents,
    },
    db,
  );

  // Already past its respond-by — `getOrderView`'s lazy expiry check
  // (`src/lib/catering/service.ts`) flips it to `expired` the moment its
  // link is opened, exactly like a real request the owner never answered.
  const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  await setStatus(draft.orderId, "requested", { requestedAt: anHourAgo, respondBy: anHourAgo }, db);
  await recordEvent(draft.orderId, "requested", "customer", { totalCents }, db);

  return draft;
}

async function seedHalfRefund() {
  const { items, foodCents } = oneLine();
  const taxCents = Math.round(foodCents * 0.0975);
  const totalCents = foodCents + taxCents;
  // 30 hours out — inside the 24-48h half-refund window, a slot the
  // builder itself can never offer (it only ever books 48h+ out).
  const eventAt = new Date(Date.now() + 30 * 60 * 60 * 1000);

  const draft = await createDraftOrder(
    {
      store: "hollywood",
      fulfilment: "pickup",
      eventAt,
      contactName: "Half Refund Fixture",
      contactEmail: "half.refund.fixture@example.com",
      contactPhone: "(818) 555-0902",
      items,
      foodCents,
      taxCents,
      totalCents,
    },
    db,
  );

  const now = new Date();
  const respondBy = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await setStatus(draft.orderId, "requested", { requestedAt: now, respondBy }, db);
  await recordEvent(draft.orderId, "requested", "customer", { totalCents }, db);

  // requested -> booked, the same `approveOrder` the real admin "Approve &
  // charge" button calls (capture is a fake-mode no-op per
  // `CATERING_FAKE_PAYMENTS`) — so this fixture starts exactly where
  // `cancel.spec.ts` test 2 needs it, without a live admin click.
  const approved = await approveOrder(db, draft.orderId);
  if (!approved.ok) throw new Error(`seed half-refund fixture approve failed: ${approved.error}`);

  return draft;
}

const expired = await seedExpired();

// `cancel.spec.ts` test 2 cancels its half-refund fixture — a destructive,
// one-time state change (`requested`/`booked` -> `cancelled`) — and the
// same spec file runs once per catering Playwright project
// (`catering-phone`, `catering-desktop`) against this one shared server.
// One fixture shared between them means whichever project's test 2 runs
// second finds an already-cancelled order and 404s/fails, so this seeds
// one half-refund fixture per catering project instead of one for the
// whole suite. `helpers.ts`'s `readCateringFixtures` picks the matching
// one by project name.
const halfRefundByProject = {
  "catering-phone": await seedHalfRefund(),
  "catering-desktop": await seedHalfRefund(),
};

writeFileSync(
  fixturesPath,
  JSON.stringify(
    {
      expired: { token: expired.token, number: expired.number },
      halfRefund: Object.fromEntries(
        Object.entries(halfRefundByProject).map(([project, draft]) => [
          project,
          { token: draft.token, number: draft.number },
        ]),
      ),
    },
    null,
    2,
  ),
);

console.log(
  `Seeded e2e catering fixtures: expired ${expired.number}, half-refund ` +
    Object.entries(halfRefundByProject)
      .map(([project, draft]) => `${project}=${draft.number}`)
      .join(", ") +
    ".",
);
process.exit(0);
