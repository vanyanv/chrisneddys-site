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
export const editionStatusEnum = pgEnum("edition_status", ["available", "reserved", "sold"]);
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
