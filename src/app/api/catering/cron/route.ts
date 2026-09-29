/**
 * GET /api/catering/cron
 *
 * Vercel cron (see `vercel.json`), guarded by `Authorization: Bearer
 * ${CRON_SECRET}` — the same bearer-token pattern Vercel's own cron docs
 * recommend, since a cron route has no session or CSRF protection to lean
 * on. Does two things a request can't wait for: expires any `requested`
 * order whose reply window has passed (`expireDue` — also checked lazily on
 * every order-link read, so this is a backstop, not the only path), and
 * sends the day-after "thank you" email for orders whose event happened
 * yesterday.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { expireDue, markCompleted } from "@/lib/catering/service";
import { getOrderById, listOrders } from "@/lib/catering/orders";
import { sendThankYouEmail } from "@/lib/catering/emails";

export const runtime = "nodejs";

/** Every `booked` order whose event happened in the last 24-48 hours and
 * hasn't been marked `completed` yet — the cron runs roughly daily, so this
 * window comfortably covers one run's worth of newly-past events without
 * re-sending a thank-you for an order the previous run already completed
 * (once `completed`, `listOrders`'s "past" tab still finds it, but
 * `markCompleted` only ever moves a `booked` order once). */
const THANK_YOU_WINDOW_HOURS = 48;

async function sendDueThankYous(): Promise<number> {
  const db = await getDb();
  const past = await listOrders({ tab: "past" }, db);
  const now = Date.now();
  let sent = 0;

  for (const order of past) {
    if (order.status !== "booked") continue;
    const hoursSinceEvent = (now - order.eventAt.getTime()) / (60 * 60 * 1000);
    if (hoursSinceEvent < 24 || hoursSinceEvent > THANK_YOU_WINDOW_HOURS) continue;

    const full = await getOrderById(order.id, db);
    if (!full) continue;
    await sendThankYouEmail(full);
    await markCompleted(db, order.id);
    sent += 1;
  }

  return sent;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET isn't configured." }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = await getDb();
  const expired = await expireDue(db);
  const thankYous = await sendDueThankYous();

  return NextResponse.json({ expired: expired.count, thankYous });
}
