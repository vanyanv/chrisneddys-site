/**
 * The read layer behind "All fifty numbers" (`/admin/products/[id]/run`,
 * issue #36 phase 3) — every numbered edition of a product's run, and
 * whichever order currently holds or bought each number.
 *
 * Finding 01 of the "Wiring The Rack" analysis: a numbered run belongs to a
 * VARIANT, not a product — `editions.variantId` references `variants.id`,
 * not `products.id`. Fifty numbered hats are fifty editions of ONE variant,
 * so `getRunForAdmin` below joins `editions` to `orders` keyed on
 * `editions.variantId` — never straight off `productId` — even though a
 * one-size hat's product and variant look interchangeable from the UI
 * (Finding 02: every hat quietly owns exactly one variant, and that's where
 * the run actually lives). Uncached, like `src/lib/catalogAdmin.ts` and
 * `src/lib/ordersAdmin.ts` — an owner looking at this board has to see
 * what's actually in the database right now, including a hold that could
 * lapse in the next few minutes.
 */
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { editions, orders, products } from "@/db/schema";
import { editionCounts, type EditionCellStatus } from "@/lib/catalog";

export type RunOrderRef = {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  /** Null until `markPaid` fills it in — a still-open checkout is a guest
   * nobody has identified yet, exactly as the shop side never pretends to
   * know who's mid-checkout. */
  customerName: string | null;
  customerEmail: string | null;
  paidAt: Date | null;
};

export type RunNumberRow = {
  number: number;
  status: EditionCellStatus;
  /** Set only while `status === "reserved"` — when the hold lapses on its
   * own, nobody is emailed about it (issue #36's decisions: no chasing). */
  reservedUntil: Date | null;
  /** When this hold began: the holding order's `createdAt`, which
   * `createPendingOrder` writes in the same transaction that sets
   * `reservedUntil`. Together they give the hold's real length, so the
   * progress bar beside a held row is measured rather than assumed from
   * `holdMinutes`' 30-minute default — that default is a parameter, not a
   * fact about any particular hold. Null for a number nobody is holding. */
  holdStartedAt: Date | null;
  /** The order currently holding or having bought this number — set for
   * both `reserved` and `sold`, null for `available`. */
  order: RunOrderRef | null;
};

export type RunForAdmin = {
  productId: string;
  productSlug: string;
  productTitle: string;
  /** The product's own eyebrow ("CAPSULE 01"), carried here because the run
   * page shows it and this query already has the product row in hand.
   * Reading it through `getProductForAdmin` instead meant a second
   * relational read materialising every image and all fifty edition rows a
   * second time, for one word of copy. */
  productEyebrow: string | null;
  editionSize: number;
  /** True once anything in the run has sold — the point past which
   * `setInventory`'s `EditionSizeLockedError` refuses to change
   * `editionSize` (`@/lib/catalogAdmin`). */
  locked: boolean;
  counts: { available: number; reserved: number; sold: number; setAside: number };
  numbers: RunNumberRow[];
};

/**
 * Full detail for one product's run board. Undefined when the product
 * doesn't exist, has no variant yet, or isn't running numbered editions at
 * all (`editionSize` null) — there is no run to show.
 */
export async function getRunForAdmin(productId: string): Promise<RunForAdmin | undefined> {
  const db = await getDb();

  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: { variants: true },
  });
  if (!product) return undefined;

  const variant = product.variants[0];
  if (!variant || variant.editionSize === null) return undefined;

  // The join Finding 01 calls for: every edition keyed by `variantId` (never
  // `productId`), left-joined to whichever order currently holds or bought
  // it — `editions.orderId` is set the moment a checkout reserves a number,
  // not only once it's paid (see `createPendingOrder` in `@/lib/orders`),
  // so a still-open checkout's guest details show up here too.
  const rows = await db
    .select({
      number: editions.number,
      status: editions.status,
      reservedUntil: editions.reservedUntil,
      orderId: orders.id,
      orderNumber: orders.number,
      orderStatus: orders.status,
      customerName: orders.name,
      customerEmail: orders.email,
      paidAt: orders.paidAt,
      orderCreatedAt: orders.createdAt,
    })
    .from(editions)
    .leftJoin(orders, eq(editions.orderId, orders.id))
    .where(eq(editions.variantId, variant.id))
    .orderBy(asc(editions.number));

  const numbers: RunNumberRow[] = rows.map((row) => ({
    number: row.number,
    status: row.status,
    reservedUntil: row.reservedUntil,
    holdStartedAt: row.status === "reserved" ? row.orderCreatedAt : null,
    order:
      row.orderId !== null
        ? {
            orderId: row.orderId,
            orderNumber: row.orderNumber ?? "",
            orderStatus: row.orderStatus ?? "",
            customerName: row.customerName,
            customerEmail: row.customerEmail,
            paidAt: row.paidAt,
          }
        : null,
  }));

  const counts = editionCounts(numbers.map((row) => ({ number: row.number, status: row.status })));

  return {
    productId: product.id,
    productSlug: product.slug,
    productTitle: [product.displayName1, product.displayName2].filter(Boolean).join(" ").trim(),
    productEyebrow: product.eyebrow ?? null,
    editionSize: variant.editionSize,
    locked: counts.sold > 0,
    counts,
    numbers,
  };
}
