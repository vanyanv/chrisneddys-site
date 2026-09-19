import type { Metadata } from "next";
import "@/styles/check-form.css";
import "@/styles/shop-order.css";
import { OrderLookupForm } from "./OrderLookupForm";

// A lookup form has nothing unique to index — every visitor sees the same
// empty form, and the only real content (an order) sits behind the order
// number and email, exactly like `shop/thanks/` (issue #64).
export const metadata: Metadata = {
  title: "Order status",
  robots: { index: false, follow: false },
};

/** A lookup form has nothing worth prerendering or caching per visitor —
 * every real answer comes back through the server action, never the initial
 * render — so this stays dynamic rather than serving a stale static shell. */
export const dynamic = "force-dynamic";

/**
 * The customer order-lookup page. A plain form — order number, email — into
 * a server action (`./actions.ts`) that returns status and items, or a
 * generic "we couldn't find that order" for anything that isn't a real,
 * paid order with a matching email. No sign-in: the order number plus the
 * email used at checkout is the credential, the same pair a receipt would
 * carry.
 */
export default function OrderLookupPage() {
  return (
    <section className="cne-sec">
      <div className="cne-eyebrow">Shop</div>
      <h1>Order status.</h1>
      <p className="cne-shop-lede">
        Enter your order number (from your confirmation email) and the email you used at checkout.
      </p>
      <OrderLookupForm />
    </section>
  );
}
