import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "@/styles/catering-order.css";
import { getDb } from "@/db/client";
import { getOrderView } from "@/lib/catering/service";
import { TrackSent } from "./TrackSent";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** C10: the confirmation screen the checkout redirect (real or fake-payments
 * mode) lands on, at `/catering/order/sent/?o=<token>`. */
export default async function CateringOrderSentPage({
  searchParams,
}: {
  searchParams: Promise<{ o?: string }>;
}) {
  const { o: token } = await searchParams;
  if (!token) notFound();

  const db = await getDb();
  const view = await getOrderView(db, token);
  if (!view.ok) notFound();
  const { order } = view;

  return (
    <div className="cor-sent" data-catering-order-sent="">
      <TrackSent number={order.number} />
      <section className="cor-sent-hero">
        <p className="cor-sent-tag">{order.number}</p>
        <h1>Request sent.</h1>
        <p>We&rsquo;ll confirm within 24 hours. Your card is held, not charged.</p>
      </section>
      <div className="cor-sent-timeline">
        <ol>
          <li className="is-done">
            <b>Request sent</b>
            <span>Just now</span>
          </li>
          <li>
            <b>We confirm</b>
            <span>Within 24 hours. The invoice comes by email.</span>
          </li>
          <li>
            <b>We cook and deliver</b>
            <span>At your requested time.</span>
          </li>
        </ol>
        <Link className="cor-btn is-primary" href={`/catering/o/${token}/`}>
          View your order
        </Link>
        <p className="cor-fine">
          Sent to {order.contactEmail}. That email&rsquo;s link lets you change or cancel.
        </p>
      </div>
    </div>
  );
}
