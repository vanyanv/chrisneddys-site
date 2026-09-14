/**
 * The shop's Postgres schema (Drizzle).
 *
 * This is the database the storefront reads through `src/lib/catalog.ts` in
 * production. `src/data/merch.ts` remains the seed source and the fallback
 * used when there is no database to talk to (see `catalog.ts`), so a change
 * to a product's copy still starts in `merch.ts` — `src/db/seed.ts` is what
 * carries it into these tables.
 *
 * Phase 1 is catalogue-only: no orders table yet, so `editions.order_id` is a
 * bare `uuid` with no foreign key. Phase 3 adds `orders` and the constraint.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
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

/** One label/value pair, e.g. `{ label: "Capsule", value: "CNE-01" }`. */
export type AuthenticityFact = { label: string; value: string };

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
    // No FK yet: orders arrive in phase 3.
    orderId: uuid("order_id"),
    ...timestamps,
  },
  (t) => [
    unique("editions_variant_number_unique").on(t.variantId, t.number),
    index("editions_variant_status_idx").on(t.variantId, t.status),
  ],
);

export const owners = pgTable("owners", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
