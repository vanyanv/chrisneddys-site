import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/shop-order.css";
import { brand } from "@/data/brand";
import { getEditionSizes, getOrderBySessionId, getPublicStoreSettings } from "@/lib/orders";
import { formatPrice } from "@/lib/otter";
import { canShowFullOrderDetails } from "@/lib/orderVisibility";
import { ClearBagOnce } from "@/components/shop/ClearBagOnce";
import { PurchaseOnce } from "@/components/shop/PurchaseOnce";
import { Monster } from "@/components/mascots/Monster";
import { MONSTER_COLORS } from "@/components/mascots/monsterColors";
import { MascotDecor } from "@/components/mascots/MascotDecor";
import { ConfirmingRefresh } from "./ConfirmingRefresh";

/**
 * Reads a live order by a query-string session id and shows whatever the
 * database currently says — never static, never cached across visitors.
 * `?session_id=` alone is enough to load an order (there's no session/email
 * check), so this must never be cached or served from anywhere but this
 * request: `src/proxy.ts` also stamps `Cache-Control: private,
 * no-store` on every response for this route — Server Components can't set
 * response headers themselves, only Route Handlers and Middleware can — and
 * `canShowFullOrderDetails` below limits how long a stale link keeps
 * showing anything beyond the order number.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thanks for your order",
  robots: { index: false, follow: false },
};

/** How many 3-second refreshes `?try=` climbs through before giving up and
 * showing the fallback message instead of refreshing forever. Stripe's
 * webhook usually lands within a second or two of the redirect back here;
 * 5 tries is 15 seconds of grace on top of that. */
const MAX_TRIES = 5;
const REFRESH_SECONDS = 3;

type SearchParams = { session_id?: string; try?: string };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="cne-sec cne-thanks">
      <div className="cne-eyebrow">Shop</div>
      {children}
    </section>
  );
}

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const sessionId = params.session_id;
  const tryCount = Math.max(0, Math.min(MAX_TRIES, Math.floor(Number(params.try)) || 0));

  if (!sessionId) {
    return (
      <Shell>
        <h1>Thanks.</h1>
        <p className="cne-shop-lede">
          We couldn&rsquo;t find that checkout session. If you just paid, check{" "}
          <Link prefetch={false} href="/shop/order/">
            order status
          </Link>{" "}
          with your order number and email.
        </p>
        <Link prefetch={false} href="/shop/" className="cne-btn-ghost">
          Back to the shop
        </Link>
      </Shell>
    );
  }

  const order = await getOrderBySessionId(sessionId);

  // Not yet paid — either the row is still `pending` (Stripe's webhook
  // hasn't landed yet) or it isn't in the database at all yet (the
  // checkout route's write and this read raced, vanishingly briefly).
  // Both look the same from here: keep refreshing until either the order
  // shows up paid, or the tries run out.
  if (!order || order.status === "pending") {
    if (tryCount < MAX_TRIES) {
      const next = `/shop/thanks/?session_id=${encodeURIComponent(sessionId)}&try=${tryCount + 1}`;
      return (
        <Shell>
          {/* Checks again in place rather than reloading the page, so a
              screen reader isn't sent back to the top every few seconds
              (WCAG 2.2.1). With JavaScript off it falls back to a real
              refresh inside <noscript>. */}
          <ConfirmingRefresh href={next} seconds={REFRESH_SECONDS} />
          <h1>Confirming your payment…</h1>
          <p className="cne-shop-lede">
            This usually takes a few seconds. Don&rsquo;t close this tab.
          </p>
        </Shell>
      );
    }

    return (
      <Shell>
        <h1>Still confirming.</h1>
        <p className="cne-shop-lede">
          {order ? `Your order is ${order.number}. ` : "This is taking longer than it should. "}
          Payment can take a minute to confirm. Check{" "}
          <Link prefetch={false} href="/shop/order/">
            order status
          </Link>{" "}
          in a bit, or reach us at <a href={`mailto:${brand.email}`}>{brand.email}</a>.
        </p>
      </Shell>
    );
  }

  if (order.status === "cancelled") {
    return (
      <Shell>
        <h1>Payment not completed.</h1>
        <p className="cne-shop-lede">
          This checkout session was cancelled or expired before payment went through, so nothing was
          charged.{" "}
          <Link prefetch={false} href="/shop/">
            Back to the shop
          </Link>{" "}
          to try again.
        </p>
      </Shell>
    );
  }

  // paid, fulfilled, ready_for_pickup, picked_up, or refunded — every one of
  // these means the payment itself went through. Anyone with this URL can
  // load this order by session id alone, so full details (items, edition
  // number, totals) only show for a couple of hours after payment; past
  // that, a stale/shared link only gets the order number.
  if (!canShowFullOrderDetails(order)) {
    return (
      <Shell>
        <h1>Thanks: order {order.number}</h1>
        <p className="cne-shop-lede">
          Check your confirmation email for the details, or{" "}
          <Link prefetch={false} href="/shop/order/">
            look up your order
          </Link>{" "}
          with your order number and email.
        </p>
      </Shell>
    );
  }

  const [sizes, settings] = await Promise.all([
    getEditionSizes(order.items.map((i) => i.variantId)),
    getPublicStoreSettings(),
  ]);

  const single = order.items.length === 1 ? order.items[0] : undefined;

  return (
    <Shell>
      <ClearBagOnce />
      <PurchaseOnce
        order={{
          id: order.id,
          number: order.number,
          value: order.subtotalCents / 100,
          shipping: order.shippingCents / 100,
          tax: order.taxCents / 100,
          currency: order.currency,
          items: order.items.map((item) => ({
            item_id: item.product.slug,
            item_name: item.productName,
            item_variant: item.sku,
            price: item.unitPriceCents / 100,
            quantity: item.quantity,
          })),
        }}
      />
      <div className="cne-thanks-mascot" aria-hidden="true">
        <Monster
          species="classic"
          bodyColor={MONSTER_COLORS.yellow.body}
          irisColor={MONSTER_COLORS.yellow.iris}
          size={52}
        />
        <MascotDecor kind="drip" colorA="var(--a-red)" size={14} />
      </div>
      <h1>
        Thanks: order {order.number}
        {single?.editionNumber != null ? (
          <>
            {" "}
            <span className="cne-thanks-num">
              Your number is #{single.editionNumber}
              {sizes.get(single.variantId) ? ` of ${sizes.get(single.variantId)}` : ""}.
            </span>
          </>
        ) : (
          "."
        )}
      </h1>

      <div className="cne-ord-result cne-thanks-receipt">
        <ul className="cne-ord-items">
          {order.items.map((item) => (
            <li key={item.id}>
              <span className="cne-ord-item-name">
                {item.productName}
                {item.editionNumber == null && ` × ${item.quantity}`}
              </span>
              <span className="cne-thanks-line-end">
                {item.editionNumber != null && (
                  <span className="cne-ord-numchip">
                    <span className="eyebrow">No.</span>
                    {item.editionNumber}
                    {sizes.get(item.variantId) ? (
                      <span className="of"> / {sizes.get(item.variantId)}</span>
                    ) : null}
                  </span>
                )}
                <span className="cne-price">
                  {formatPrice((item.unitPriceCents * item.quantity) / 100)}
                </span>
              </span>
            </li>
          ))}
          <li className="cne-thanks-total">
            <span>Total</span>
            <span className="cne-price">{formatPrice(order.totalCents / 100)}</span>
          </li>
        </ul>
      </div>

      <p className="cne-shop-lede">
        {order.fulfilment === "pickup"
          ? `Pickup at ${settings.pickupAddress}. Bring your confirmation email. We'll email you again once it's ready.`
          : "We'll email you again with tracking once it ships."}
      </p>

      {settings.returnsPolicy && <p className="cne-shop-lede">{settings.returnsPolicy}</p>}

      <p className="cne-shop-lede">
        Questions about your order?{" "}
        <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>, or{" "}
        <Link prefetch={false} href="/shop/order/">
          look it up
        </Link>{" "}
        any time.
      </p>

      <Link prefetch={false} href="/shop/" className="cne-btn-ghost">
        Back to the shop
      </Link>
    </Shell>
  );
}
