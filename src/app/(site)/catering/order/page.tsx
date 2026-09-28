import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/catering-order.css";
import { getPublicCateringConfig } from "@/lib/catering/public";
import { getDb } from "@/db/client";
import { CATERING_HREF } from "@/data/catering";
import { pageMetadata } from "@/lib/seo";
import { OrderBuilder } from "@/components/catering-order/OrderBuilder";

const title = "Catering Order";
const description =
  "Order Chris N Eddy's catering online: pick a time, build the order, we confirm within 24 hours.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/catering/order/" });

/**
 * The catering order builder. While `cateringOrderingOn` is off, this is
 * just the existing "ask about catering" card — see the build plan's
 * ground rules and `CateringCard`.
 */
export default async function CateringOrderPage() {
  const db = await getDb();
  const config = await getPublicCateringConfig(db);

  if (!config.orderingOn) {
    return (
      <div className="cor-off-page">
        <div className="cor-off-card">
          <h1>Catering</h1>
          <p>
            Online ordering isn&rsquo;t open yet. Tell us about your event and we&rsquo;ll set it
            up.
          </p>
          <Link className="cor-btn is-primary" href={CATERING_HREF} data-catering="">
            Ask about catering &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return <OrderBuilder config={config} />;
}
