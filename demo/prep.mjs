/**
 * Offline database steps for the owner demo. PGlite is a single-writer,
 * file-locked database, so every one of these runs with the Next server
 * STOPPED — the same reason `e2e/db-warmup.mjs` runs before `next build`.
 *
 * Phases:
 *   init     seed the owner account and the settings the shop needs to open
 *   photo    attach a photo to the demo product (Vercel Blob is not
 *            connected here, so /admin's upload route correctly refuses;
 *            this uses the same `product_images` row a repo-seeded photo
 *            uses, copying src/width/height off the seeded product so the
 *            path convention is whatever the app actually renders)
 *   purchase complete a real purchase through the app's own code:
 *            `createPendingOrder` (what /api/checkout calls, reserving the
 *            number) then `markPaid` (what the Stripe webhook calls)
 */
import { register } from "node:module";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
register(`file://${REPO}/e2e/order-seed-resolve-hook.mjs`, import.meta.url);

const { getDb } = await import(`${REPO}/src/db/client.ts`);
const { products, productImages, storeSettings, user, account } = await import(
  `${REPO}/src/db/schema.ts`
);
const { createPendingOrder, markPaid } = await import(`${REPO}/src/lib/orders.ts`);
const { hashPassword } = await import(`${REPO}/src/lib/password.ts`);

const OWNER_EMAIL = "owner@example.com";
const OWNER_PASSWORD = "demo-owner-password-123";
const phase = process.argv[2];
const db = await getDb();

if (phase === "init") {
  const existing = await db.select({ id: user.id }).from(user).limit(1);
  if (existing.length === 0) {
    const userId = randomUUID();
    await db.insert(user).values({
      id: userId,
      name: "Chris",
      email: OWNER_EMAIL,
      emailVerified: false,
    });
    await db.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(OWNER_PASSWORD),
    });
    console.log("owner seeded");
  } else {
    console.log("owner already present");
  }

  // `isShopOpenFor` needs a published returns policy and a support email on
  // top of the Stripe keys, or checkout stays closed. Both are real owner
  // settings, set here so the demo starts from an open shop.
  const [row] = await db.select().from(storeSettings).limit(1);
  if (row) {
    await db
      .update(storeSettings)
      .set({
        returnsPolicy: "Returns accepted within 30 days, unworn, with the certificate.",
        supportEmail: "hello@chrisneddys.com",
        updatedAt: new Date(),
      })
      .where(eq(storeSettings.id, row.id));
    console.log("store settings ready");
  }
}

if (phase === "photo") {
  const slug = process.argv[3];
  const [target] = await db.select().from(products).where(eq(products.slug, slug));
  if (!target) throw new Error(`no product with slug ${slug}`);

  // Copy a real, renderable image row off the seeded product rather than
  // inventing a path — whatever convention the app resolves, this matches.
  const [seededImage] = await db
    .select()
    .from(productImages)
    .where(
      eq(
        productImages.productId,
        (await db.select().from(products).where(eq(products.slug, "foam-trucker-blue")))[0].id,
      ),
    )
    .limit(1);
  if (!seededImage) throw new Error("no seeded image to copy from");

  // A seeded image's `src` is a STEM ("angle"), resolved against the
  // product's own `photoDir` — so the row alone is not enough; without the
  // same photoDir the image resolves to nothing and renders broken.
  const [seededProduct] = await db
    .select()
    .from(products)
    .where(eq(products.slug, "foam-trucker-blue"));
  await db
    .update(products)
    .set({ photoDir: seededProduct.photoDir })
    .where(eq(products.id, target.id));

  await db
    .insert(productImages)
    .values({
      productId: target.id,
      position: 0,
      viewId: "front",
      label: "Front",
      alt: "THE DEMO CAP — RED, front view",
      src: seededImage.src,
      width: seededImage.width,
      height: seededImage.height,
      kind: "view",
    })
    .onConflictDoNothing({ target: [productImages.productId, productImages.viewId] });
  console.log(`photo attached to ${slug} (src ${seededImage.src})`);

  // Remove any orphan draft left by an aborted earlier run, so the
  // catalogue in the screenshots shows one demo product, not three.
  const strays = await db.select().from(products).where(eq(products.displayName1, "THE DEMO CAP"));
  for (const stray of strays) {
    if (stray.id !== target.id) {
      await db.delete(products).where(eq(products.id, stray.id));
      console.log(`removed orphan draft ${stray.slug}`);
    }
  }
}

if (phase === "purchase") {
  const slug = process.argv[3];
  // Exactly what POST /api/checkout does before it hands off to Stripe:
  // reserve a number and open a pending order.
  const pending = await createPendingOrder({
    items: [{ slug, quantity: 1 }],
    fulfilment: "ship",
    holdMinutes: 30,
  });
  if ("code" in pending) throw new Error(`createPendingOrder failed: ${pending.code}`);

  // Exactly what the Stripe webhook's `handleSessionPaid` does when the
  // payment succeeds: assign the edition number and record the buyer.
  const paid = await markPaid({
    orderId: pending.orderId,
    paymentIntentId: "pi_demo_0000000000",
    email: "sam.buyer@example.com",
    name: "Sam Buyer",
    phone: null,
    shipTo: {
      line1: "18 Fountain Street",
      line2: null,
      city: "Brooklyn",
      state: "NY",
      postalCode: "11231",
      country: "US",
    },
    amounts: { subtotal: 4200, shipping: 0, tax: 373, total: 4573 },
  });
  console.log(
    JSON.stringify({ orderNumber: paid.number ?? pending.number, orderId: pending.orderId }),
  );
}

process.exit(0);
