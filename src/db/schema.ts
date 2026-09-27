/**
 * The shop's Postgres schema (Drizzle).
 *
 * This is the database the storefront reads through `src/lib/catalog.ts` in
 * production. `src/data/merch.ts` remains the seed source and the fallback
 * used when there is no database to talk to (see `catalog.ts`), so a change
 * to a product's copy still starts in `merch.ts` — `src/db/seed.ts` is what
 * carries it into these tables.
 *
 * Phase 3 adds the order/reservation layer (`orders`, `order_items`,
 * `stripe_events`, `store_settings`) and the `editions.order_id` foreign
 * key — see `src/lib/orders.ts` for the module that reads and writes it.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const productStatusEnum = pgEnum("product_status", ["draft", "published", "archived"]);
export const productImageKindEnum = pgEnum("product_image_kind", [
  "view",
  "certificate",
  "sticker",
]);
/** `set_aside`: a number from the run that isn't for sale online — sold at
 * the location, given away or kept back by the owner. It still counts
 * towards the run ("only 50 made") but never towards what's left to buy. */
export const editionStatusEnum = pgEnum("edition_status", [
  "available",
  "reserved",
  "sold",
  "set_aside",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "fulfilled",
  "ready_for_pickup",
  "picked_up",
  "refunded",
  "cancelled",
]);
export const fulfilmentEnum = pgEnum("fulfilment", ["ship", "pickup"]);

/** One label/value pair, e.g. `{ label: "Capsule", value: "CNE-01" }`. */
export type AuthenticityFact = { label: string; value: string };

/** A shipping address snapshot, stored as-is on the order at payment time. */
export type ShipTo = {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

/**
 * Backs `orders.number` (e.g. `CNE-1001`) — a plain Postgres sequence so
 * concurrent checkouts never race for the same number. `nextOrderNumber`
 * in `src/lib/orders.ts` reads it with `nextval`.
 */
export const orderNumberSeq = pgSequence("order_number_seq", {
  startWith: 1001,
  increment: 1,
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  displayName1: text("display_name_1").notNull(),
  displayName2: text("display_name_2").notNull(),
  eyebrow: text("eyebrow").notNull(),
  description: text("description").notNull(),
  metaDescription: text("meta_description").notNull(),
  limitedNote: text("limited_note").notNull(),
  priceCents: integer("price_cents").notNull(),
  oneSize: boolean("one_size").notNull().default(true),
  perOrderLimit: integer("per_order_limit").notNull().default(6),
  status: productStatusEnum("status").notNull().default("draft"),
  /** Shop/admin display order, 0-based and contiguous. `reorderProducts` in
   * `src/lib/catalogAdmin.ts` renumbers every product's position in one
   * transaction on a drag; `createDraft` appends at the end (max + 1). */
  position: integer("position").notNull().default(0),
  capColor: text("cap_color"),
  details: jsonb("details").$type<string[]>(),
  fit: text("fit"),
  limitedCopy: text("limited_copy"),
  why: text("why"),
  authenticityCopy: text("authenticity_copy"),
  authenticityFacts: jsonb("authenticity_facts").$type<AuthenticityFact[]>(),
  metaTitle: text("meta_title"),
  metaKeywords: text("meta_keywords"),
  socialImageUrl: text("social_image_url"),
  socialImageAlt: text("social_image_alt"),
  photoDir: text("photo_dir"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
});

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    viewId: text("view_id").notNull(),
    label: text("label").notNull(),
    alt: text("alt").notNull(),
    src: text("src").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    kind: productImageKindEnum("kind").notNull().default("view"),
    /**
     * Set once this image was uploaded through /admin (`POST
     * /api/admin/upload`) rather than seeded from `photo_dir` + `src`. Both
     * null for a seeded image; both set for an uploaded one — `src/lib/
     * catalog.ts` prefers these when present.
     */
    urlFull: text("url_full"),
    urlThumb: text("url_thumb"),
    /** A 400px-wide WebP cut, alongside the 720px full and 200px thumb —
     * added for issue #151 so the thumbnail strip isn't pulling the full
     * 720px image at 2x for an 80px on-screen tile. Null for every row
     * uploaded before this shipped (no backfill) and for seeded images;
     * `src/components/shop/ProductShot.tsx` falls back to the 200w/720w
     * srcSet when it's absent. */
    urlMid: text("url_mid"),
    ...timestamps,
  },
  (t) => [unique("product_images_product_view_unique").on(t.productId, t.viewId)],
);

export const variants = pgTable("variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),
  label: text("label").notNull(),
  priceCents: integer("price_cents"),
  inventoryQuantity: integer("inventory_quantity"),
  editionSize: integer("edition_size"),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

export const editions = pgTable(
  "editions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    status: editionStatusEnum("status").notNull().default("available"),
    reservedUntil: timestamp("reserved_until", { withTimezone: true }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    unique("editions_variant_number_unique").on(t.variantId, t.number),
    index("editions_variant_status_idx").on(t.variantId, t.status),
  ],
);

/**
 * Better Auth's four core tables (Drizzle adapter, `provider: "pg"`), added
 * so Drizzle owns them like every other table — see
 * `docs/superpowers/specs/2026-09-14-better-auth-owner-sign-in-design.md`.
 * Field names and requiredness here mirror Better Auth's own
 * `getAuthTables()` (`@better-auth/core/db/get-tables`) exactly; Better Auth
 * generates its own string ids (not `uuid`), so `id` is `text` here, unlike
 * every other table in this file.
 *
 * `user` replaces the old `owners` allowlist table (dropped in migration
 * `0007`).
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  /** Only ever set for the email/password provider's own `account` row. */
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Better Auth's passkey plugin table (`@better-auth/passkey`, issue #51) —
 * one row per registered WebAuthn credential. Field names mirror the
 * plugin's own `schema` export (`node_modules/@better-auth/passkey/dist/
 * index.mjs`) exactly, the same way `user`/`session`/`account`/
 * `verification` above mirror Better Auth's core `getAuthTables()` — see
 * that block's comment. `credentialID` keeps the plugin's own casing
 * (capital ID) since the Drizzle adapter matches on this exact JS property
 * name, not the column name.
 */
export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    /** Owner-supplied label ("MacBook", "iPhone") — optional; the UI falls
     * back to `getAuthenticatorName(aaguid)` (`@better-auth/passkey`) or
     * "Passkey" when neither is set. */
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Authenticator model id (never a per-device or per-user identifier) —
     * `null` for authenticators that report the all-zero AAGUID. */
    aaguid: text("aaguid"),
  },
  (t) => [
    index("passkey_user_id_idx").on(t.userId),
    index("passkey_credential_id_idx").on(t.credentialID),
  ],
);

/**
 * Every throttled attempt (success or failure), for the throttle in
 * `src/lib/signInThrottle.ts` — before verifying a password (or looking up
 * an order) it counts recent failures for both the email and the IP and
 * refuses once either hits the limit. `kind` separates independent throttles
 * that share this table (`"sign_in"` for `src/lib/auth.ts`, `"order_lookup"`
 * for `src/app/(site)/shop/order/actions.ts`) so failures on one never lock
 * out the other. Rows older than 24h are pruned opportunistically
 * (`pruneSignInAttempts`) rather than on a schedule.
 */
export const signInAttempts = pgTable(
  "sign_in_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    ip: text("ip").notNull(),
    succeeded: boolean("succeeded").notNull(),
    kind: text("kind").notNull().default("sign_in"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sign_in_attempts_email_attempted_at_idx").on(t.email, t.attemptedAt),
    index("sign_in_attempts_ip_attempted_at_idx").on(t.ip, t.attemptedAt),
  ],
);

/** Single-row (`id = 'default'`) shop-wide configuration. */
export const storeSettings = pgTable("store_settings", {
  id: text("id").primaryKey().default("default"),
  storeName: text("store_name").notNull(),
  supportEmail: text("support_email").notNull(),
  pickupEnabled: boolean("pickup_enabled").notNull().default(true),
  pickupAddress: text("pickup_address")
    .notNull()
    .default("5539 W. Sunset Blvd, Los Angeles, CA 90028"),
  shippingFlatCents: integer("shipping_flat_cents").notNull().default(600),
  shippingFreeOverCents: integer("shipping_free_over_cents"),
  shipCountries: jsonb("ship_countries").$type<string[]>().notNull().default(["US"]),
  returnsPolicy: text("returns_policy"),
  termsText: text("terms_text"),
  /** The customer-facing "ships within" clause (e.g. "3 business days") —
   * optional, folded into `shopCopy.ts`'s `shippingReturnsNote` sentence
   * only when set. `null` (not empty) means the owner hasn't said, so the
   * storefront sentence reads exactly as it always has, with no dangling
   * "Ships within ." */
  shipsWithin: text("ships_within"),
  /**
   * A deliberate, temporary "the counter's closed" switch the owner flips
   * from `/admin/settings` once the shop has already opened — separate from
   * `isShopOpenFor`'s pre-launch gate (`src/lib/shopStatus.ts`), which is a
   * one-way readiness check with no stored flag of its own. Pre-launch and
   * paused are different failure modes with different customer-facing
   * copy (see `shopCopy.ts`'s `pauseNotice`/`pauseCheckoutMessage` versus
   * `TERMS_PENDING`), so they get separate booleans rather than one
   * "shop open" flag standing in for both.
   */
  shopPaused: boolean("shop_paused").notNull().default(false),
  /** The optional short line customers see while paused, e.g. "Back
   * Thursday" — `null` (not just empty) when the owner hasn't set one, so
   * `shopCopy.ts` can tell "no note" apart from "an empty string was saved". */
  pauseNote: text("pause_note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** `CNE-1001`, `CNE-1002`, … — see `orderNumberSeq` / `nextOrderNumber`. */
    number: text("number").notNull().unique(),
    status: orderStatusEnum("status").notNull().default("pending"),
    fulfilment: fulfilmentEnum("fulfilment").notNull(),
    /**
     * Null until known. `createPendingOrder` may not have an email yet (the
     * cart hasn't reached Stripe Checkout); `markPaid` always fills both this
     * and `name` in from Stripe.
     */
    email: text("email"),
    name: text("name"),
    phone: text("phone"),
    shipTo: jsonb("ship_to").$type<ShipTo>(),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    /** Set on creation for a pending order, cleared on payment. Reservations
     * with an `expires_at` in the past are fair game for `releaseExpiredReservations`. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    /**
     * Issue #36 phase 7 (Customers): a customer is a *projection* over
     * `orders`, grouped by the normalized (trimmed, lower-cased) email —
     * there is no separate `customers` table (see `src/lib/customersAdmin.ts`
     * for the full reasoning). `email` is only ever non-null from `markPaid`
     * onward, so this index only ever covers orders that were actually paid
     * — a guest mid-checkout (`createPendingOrder`, no email yet) is never
     * in it. Partial on "not null" so a pending/cancelled order with no
     * email never costs this index anything.
     */
    index("orders_email_lower_idx")
      .on(sql`lower(trim(${t.email}))`)
      .where(sql`${t.email} is not null`),
  ],
);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => variants.id),
  /** Snapshots, so a later edit to the product doesn't rewrite history. */
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
  /** Edition products only; null until `markPaid` assigns it. */
  editionNumber: integer("edition_number"),
  ...timestamps,
});

/** Stripe webhook idempotency: one row per event id ever seen. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variant: one(variants, { fields: [orderItems.variantId], references: [variants.id] }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  images: many(productImages),
  variants: many(variants),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const variantsRelations = relations(variants, ({ one, many }) => ({
  product: one(products, { fields: [variants.productId], references: [products.id] }),
  editions: many(editions),
}));

export const editionsRelations = relations(editions, ({ one }) => ({
  variant: one(variants, { fields: [editions.variantId], references: [variants.id] }),
}));

// ---------------------------------------------------------------------------
// Catering (docs/catering-build-plan.md, phase 2)
//
// A separate table family from `orders`/`order_items` above rather than a
// reuse of them: catering orders are quoted from `src/data/menu.ts` (not
// `products`/`variants`), go through a hold → owner-approval → capture flow
// instead of pay-then-fulfil, and carry event, note and pending-change data
// the merch flow has no use for. `src/lib/catering/orders.ts` is the data
// layer; `src/lib/catering/settings.ts` reads/writes `catering_settings`.
// ---------------------------------------------------------------------------

export const cateringOrderStatusEnum = pgEnum("catering_order_status", [
  /** Checkout started; no card action has happened yet. */
  "draft",
  /** Checkout completed — the card is held (authorized, not captured). */
  "requested",
  /** Owner approved — the hold was captured. */
  "booked",
  "declined",
  "expired",
  "cancelled",
  "completed",
]);
export const cateringFulfilmentEnum = pgEnum("catering_fulfilment", ["pickup", "delivery"]);

/**
 * Backs `catering_orders.number` (`CAT-1001`, `CAT-1002`, …) — its own
 * sequence, independent of `order_number_seq`, the same way the merch and
 * catering order tables are otherwise kept apart. See `orderNumberSeq` above
 * for why a Postgres sequence rather than a max()+1 read.
 */
export const cateringOrderNumberSeq = pgSequence("catering_order_number_seq", {
  startWith: 1001,
  increment: 1,
});

/** A pickup/delivery address snapshot on a catering order. */
export type CateringAddress = {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
  instructions: string | null;
};

/** A proposed replacement for a `requested`/`booked` order's lines and
 * totals, awaiting the owner's approve/decline — see `setPendingChange` /
 * `applyPendingChange` / `clearPendingChange` in `src/lib/catering/orders.ts`. */
export type CateringPendingChangeLine = {
  itemId: string;
  itemName: string;
  qty: number;
  wayId: string | null;
  wayLabel: string | null;
  toppings: string[];
  toppingLabels: string[];
  extras: string[];
  extraLabels: string[];
  unitCents: number;
  amountCents: number;
  forName: string | null;
  note: string | null;
};

export type CateringPendingChange = {
  lines: CateringPendingChangeLine[];
  plateSets: number;
  foodCents: number;
  deliveryCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  requestedAt: string;
  /** Set only when the change also asks for a different headcount or time
   * of day (same calendar date — the change request never offers a new
   * date) — `jsonb`, so adding these optional fields needed no migration.
   * `applyPendingChange` (`src/lib/catering/orders.ts`) patches the order's
   * own `headcount`/`eventAt` from these when present. */
  headcount?: number;
  eventAt?: string;
};

export const cateringOrders = pgTable(
  "catering_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** `CAT-1001`, … — see `cateringOrderNumberSeq`. */
    number: text("number").notNull().unique(),
    /** Unguessable (32+ url-safe chars) — backs the customer order link
     * `/catering/o/<token>/`. Never derived from the order id. */
    token: text("token").notNull().unique(),
    status: cateringOrderStatusEnum("status").notNull().default("draft"),
    store: text("store").notNull(),
    fulfilment: cateringFulfilmentEnum("fulfilment").notNull(),
    /** The pickup/delivery time the customer chose. */
    eventAt: timestamp("event_at", { withTimezone: true }).notNull(),
    headcount: integer("headcount").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone").notNull(),
    company: text("company"),
    poNumber: text("po_number"),
    onsiteContactName: text("onsite_contact_name"),
    onsiteContactPhone: text("onsite_contact_phone"),
    /** Delivery only; null for pickup. */
    address: jsonb("address").$type<CateringAddress>(),
    /** Estimated driving miles (ZIP centroid × 1.25) — null when the ZIP
     * wasn't recognized (see `rangeUnknown`) or the order is pickup. */
    distanceMiles: numeric("distance_miles", { precision: 5, scale: 1 }),
    /** Set when the customer's ZIP wasn't in the `zipcodes` table — the
     * order is accepted and flagged for the owner rather than blocked. */
    rangeUnknown: boolean("range_unknown").notNull().default(false),
    plateSets: integer("plate_sets").notNull().default(0),
    foodCents: integer("food_cents").notNull(),
    deliveryCents: integer("delivery_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull(),
    tipCents: integer("tip_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    refundedCents: integer("refunded_cents").notNull().default(0),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeCustomerId: text("stripe_customer_id"),
    stripePaymentMethodId: text("stripe_payment_method_id"),
    requestedAt: timestamp("requested_at", { withTimezone: true }),
    /** `requestedAt` + the settings' reply-hours window — past this with no
     * owner action, the order is fair game for `findExpirable`. */
    respondBy: timestamp("respond_by", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    declineReason: text("decline_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    customerNote: text("customer_note"),
    ownerNote: text("owner_note"),
    /** A customer-submitted change awaiting the owner's approve/decline. */
    pendingChange: jsonb("pending_change").$type<CateringPendingChange>(),
    ...timestamps,
  },
  (t) => [
    index("catering_orders_status_idx").on(t.status),
    index("catering_orders_event_at_idx").on(t.eventAt),
    index("catering_orders_email_idx").on(t.contactEmail),
  ],
);

export const cateringOrderItems = pgTable(
  "catering_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => cateringOrders.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** `src/data/menu.ts` item id — not a foreign key, so a later menu edit
     * never rewrites history (see the snapshot fields below). */
    itemId: text("item_id").notNull(),
    itemName: text("item_name").notNull(),
    qty: integer("qty").notNull(),
    /** A free preset (e.g. "Chris's Way"); null when none was chosen. */
    wayId: text("way_id"),
    wayLabel: text("way_label"),
    /** Free topping ids/labels, in the order the customer picked them. */
    toppings: jsonb("toppings").$type<string[]>().notNull().default([]),
    toppingLabels: jsonb("topping_labels").$type<string[]>().notNull().default([]),
    /** Paid extra ids/labels (e.g. Extra Cheese, Make it Halal). */
    extras: jsonb("extras").$type<string[]>().notNull().default([]),
    extraLabels: jsonb("extra_labels").$type<string[]>().notNull().default([]),
    unitCents: integer("unit_cents").notNull(),
    amountCents: integer("amount_cents").notNull(),
    forName: text("for_name"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [index("catering_order_items_order_id_idx").on(t.orderId)],
);

export const cateringEvents = pgTable(
  "catering_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => cateringOrders.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /** "requested" | "approved" | "declined" | "expired" | "cancelled" |
     * "change_requested" | "change_approved" | "change_declined" | "note" |
     * "email_sent" | "refunded" | "charged" — free text (not an enum) so a
     * new kind never needs a migration. */
    kind: text("kind").notNull(),
    actor: text("actor").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
  },
  (t) => [index("catering_events_order_id_idx").on(t.orderId)],
);

/** One `{open, close}` ("HH:MM", 24h) slot per weekday a store takes
 * catering orders; `hours[store][weekday]` is an array so a store could in
 * principle have more than one slot in a day, though every default is one. */
export type CateringDayHours = { open: string; close: string };
export type CateringStoreHours = Record<string, CateringDayHours[]>;
export type CateringHours = Record<string, CateringStoreHours>;

export type CateringDayOff = { date: string; store: string };

function defaultCateringHours(): CateringHours {
  const week: CateringStoreHours = {};
  for (let day = 0; day <= 6; day++) week[String(day)] = [{ open: "10:00", close: "20:00" }];
  return { hollywood: week, vannuys: { ...week } };
}

/** Single-row (`id = 'default'`) catering-wide configuration — see
 * `src/lib/catering/settings.ts`. */
export const cateringSettings = pgTable("catering_settings", {
  id: text("id").primaryKey().default("default"),
  orderingOn: boolean("ordering_on").notNull().default(false),
  hours: jsonb("hours").$type<CateringHours>().notNull().default(defaultCateringHours()),
  daysOff: jsonb("days_off").$type<CateringDayOff[]>().notNull().default([]),
  deliveryFeeCents: integer("delivery_fee_cents").notNull().default(2500),
  rangeMiles: integer("range_miles").notNull().default(10),
  replyHours: integer("reply_hours").notNull().default(24),
  leadHours: integer("lead_hours").notNull().default(48),
  bigLeadHours: integer("big_lead_hours").notNull().default(72),
  bigHeadcount: integer("big_headcount").notNull().default(50),
  ownerEmail: text("owner_email").notNull().default("chris@chrisneddys.com"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cateringOrdersRelations = relations(cateringOrders, ({ many }) => ({
  items: many(cateringOrderItems),
  events: many(cateringEvents),
}));

export const cateringOrderItemsRelations = relations(cateringOrderItems, ({ one }) => ({
  order: one(cateringOrders, {
    fields: [cateringOrderItems.orderId],
    references: [cateringOrders.id],
  }),
}));

export const cateringEventsRelations = relations(cateringEvents, ({ one }) => ({
  order: one(cateringOrders, { fields: [cateringEvents.orderId], references: [cateringOrders.id] }),
}));
