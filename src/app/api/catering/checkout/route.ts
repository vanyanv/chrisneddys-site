/**
 * POST /api/catering/checkout
 *
 * Turns a catering order builder's state into a held card: quotes and
 * re-validates everything server-side (store, lead time, an actually open
 * slot, delivery range, every line against the menu — client-sent prices are
 * never trusted), reserves a `draft` order, then either redirects to a
 * Stripe Checkout Session (`payment_intent_data.capture_method: "manual"`,
 * `setup_future_usage: "off_session"`, a Stripe Customer per email) or, in
 * fake-payments mode, skips Stripe entirely and immediately does what the
 * webhook would once the (nonexistent) session "completed" —
 * `completeCateringCheckout` is the one function both paths call, so the
 * order ends up `requested` with the same emails sent either way.
 *
 * Every rejection short-circuits before `createDraftOrder` — nothing is
 * reserved for a request that was never going to succeed.
 */
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getCateringSettings } from "@/lib/catering/settings";
import {
  attachStripeIds,
  createDraftOrder,
  setStatus,
  type CreateDraftOrderItemInput,
} from "@/lib/catering/orders";
import { completeCateringCheckout } from "@/lib/catering/checkoutComplete";
import { validateLine, quote, describeLine } from "@/lib/catering/pricing";
import { dayStatus, earliestAllowed, slotToUtcMs } from "@/lib/catering/schedule";
import { estimateMiles, inRange } from "@/lib/catering/range";
import { toScheduleDaysOff, toScheduleHours } from "@/lib/catering/hours";
import { isCateringStoreId, type CateringStoreId } from "@/lib/catering/stores";
import type { CartLine, Fulfilment, TipInput } from "@/lib/catering/types";
import {
  findOrCreateCustomer,
  createCateringCheckoutSession,
  fakeCheckoutIds,
  isFakePaymentsMode,
} from "@/lib/catering/payments";
import { itemById } from "@/data/menu";
import { locations } from "@/data/locations";
import { absoluteUrl } from "@/lib/siteOrigin";
import { getDb } from "@/db/client";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

type CheckoutBody = {
  store: CateringStoreId;
  fulfilment: Fulfilment;
  date: string;
  time: string;
  headcount: number;
  lines: CartLine[];
  tip?: TipInput;
  plateSets?: number;
  contact: { name: string; email: string; phone: string };
  company?: string;
  poNumber?: string;
  onsite?: { name: string; phone: string };
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    instructions?: string;
  };
  customerNote?: string;
  /** Not part of the phase 3/4 contract body: an optional stale-quote guard
   * a caller may include if it already showed the customer a total. Omitted
   * entirely, checkout behaves exactly per the contract — prices always come
   * from the server's own recompute. */
  expectedTotalCents?: number;
};

function invalid(fields: Record<string, string>): NextResponse {
  return NextResponse.json({ error: "invalid", fields }, { status: 400 });
}

function conflict(error: "too-soon" | "closed" | "out-of-range" | "price-changed"): NextResponse {
  return NextResponse.json({ error }, { status: 409 });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseCartLine(raw: unknown): CartLine | null {
  if (!isPlainObject(raw)) return null;
  const { itemId, qty, wayId, toppings, extras, forName, note } = raw;
  if (typeof itemId !== "string") return null;
  if (typeof qty !== "number") return null;
  if (wayId !== null && wayId !== undefined && typeof wayId !== "string") return null;
  if (!Array.isArray(toppings) || !toppings.every((t) => typeof t === "string")) return null;
  if (!Array.isArray(extras) || !extras.every((e) => typeof e === "string")) return null;
  if (forName !== undefined && typeof forName !== "string") return null;
  if (note !== undefined && typeof note !== "string") return null;
  return {
    itemId,
    qty,
    wayId: (wayId ?? null) as CartLine["wayId"],
    toppings,
    extras,
    forName,
    note,
  };
}

function parseBody(raw: unknown): CheckoutBody | NextResponse {
  if (!isPlainObject(raw)) return invalid({ body: "Malformed request." });
  const fields: Record<string, string> = {};

  const store = typeof raw.store === "string" ? raw.store : "";
  if (!isCateringStoreId(store)) fields.store = "Choose a store.";

  const fulfilment = raw.fulfilment;
  if (fulfilment !== "pickup" && fulfilment !== "delivery")
    fields.fulfilment = "Choose pickup or delivery.";

  const date = typeof raw.date === "string" ? raw.date : "";
  if (!DATE_PATTERN.test(date)) fields.date = "Choose a date.";

  const time = typeof raw.time === "string" ? raw.time : "";
  if (!TIME_PATTERN.test(time)) fields.time = "Choose a time.";

  const headcount = Math.floor(Number(raw.headcount));
  if (!Number.isInteger(headcount) || headcount < 1) fields.headcount = "Enter how many people.";

  const rawLines = Array.isArray(raw.lines) ? raw.lines : [];
  const lines = rawLines.map(parseCartLine);
  if (rawLines.length === 0 || lines.some((l) => l === null)) fields.lines = "Your order is empty.";

  const contactRaw = isPlainObject(raw.contact) ? raw.contact : {};
  const contactName = typeof contactRaw.name === "string" ? contactRaw.name.trim() : "";
  const contactEmail = typeof contactRaw.email === "string" ? contactRaw.email.trim() : "";
  const contactPhone = typeof contactRaw.phone === "string" ? contactRaw.phone.trim() : "";
  if (!contactName) fields["contact.name"] = "Enter a name.";
  if (!EMAIL_PATTERN.test(contactEmail)) fields["contact.email"] = "Enter a valid email.";
  if (!contactPhone) fields["contact.phone"] = "Enter a phone number.";

  let address: CheckoutBody["address"];
  if (fulfilment === "delivery") {
    const addressRaw = isPlainObject(raw.address) ? raw.address : {};
    const line1 = typeof addressRaw.line1 === "string" ? addressRaw.line1.trim() : "";
    const city = typeof addressRaw.city === "string" ? addressRaw.city.trim() : "";
    const state = typeof addressRaw.state === "string" ? addressRaw.state.trim() : "";
    const zip = typeof addressRaw.zip === "string" ? addressRaw.zip.trim() : "";
    if (!line1 || !city || !state || !zip) fields.address = "Enter a complete delivery address.";
    address = {
      line1,
      line2: typeof addressRaw.line2 === "string" ? addressRaw.line2 : undefined,
      city,
      state,
      zip,
      instructions:
        typeof addressRaw.instructions === "string" ? addressRaw.instructions : undefined,
    };
  }

  const onsiteRaw = isPlainObject(raw.onsite) ? raw.onsite : undefined;
  const onsite = onsiteRaw
    ? {
        name: typeof onsiteRaw.name === "string" ? onsiteRaw.name : "",
        phone: typeof onsiteRaw.phone === "string" ? onsiteRaw.phone : "",
      }
    : undefined;

  let tip: TipInput | undefined;
  if (isPlainObject(raw.tip)) {
    if (typeof raw.tip.percent === "number") tip = { tipPercent: raw.tip.percent };
    else if (typeof raw.tip.cents === "number") tip = { tipCents: raw.tip.cents };
  }

  const plateSets = raw.plateSets !== undefined ? Math.floor(Number(raw.plateSets)) : 0;
  if (raw.plateSets !== undefined && (!Number.isInteger(plateSets) || plateSets < 0)) {
    fields.plateSets = "Plate sets must be a non-negative whole number.";
  }

  if (Object.keys(fields).length > 0) return invalid(fields);

  return {
    store: store as CateringStoreId,
    fulfilment: fulfilment as Fulfilment,
    date,
    time,
    headcount,
    lines: lines as CartLine[],
    tip,
    plateSets,
    contact: { name: contactName, email: contactEmail, phone: contactPhone },
    company: typeof raw.company === "string" ? raw.company : undefined,
    poNumber: typeof raw.poNumber === "string" ? raw.poNumber : undefined,
    onsite,
    address,
    customerNote: typeof raw.customerNote === "string" ? raw.customerNote : undefined,
    expectedTotalCents:
      typeof raw.expectedTotalCents === "number" ? raw.expectedTotalCents : undefined,
  };
}

function storeZip(storeId: string): string {
  return locations.find((l) => l.id === storeId)?.postal ?? "";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const db = await getDb();
  const settings = await getCateringSettings(db);
  if (!settings.orderingOn) {
    return NextResponse.json({ error: "off" }, { status: 503 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = parseBody(raw);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed;

  // Every line against the menu — never trust what the client says a line
  // costs or contains.
  const lineFieldErrors: Record<string, string> = {};
  body.lines.forEach((line, i) => {
    const result = validateLine(line);
    if (!result.ok) lineFieldErrors[`lines.${i}`] = result.errors.join(", ");
  });
  if (Object.keys(lineFieldErrors).length > 0) return invalid(lineFieldErrors);

  const hours = toScheduleHours(settings.hours);
  const daysOff = toScheduleDaysOff(settings.daysOff);
  const status = dayStatus(body.date, body.store, hours, daysOff, Date.now(), body.headcount);
  if (status === "too-soon") return conflict("too-soon");
  if (status !== "open") return conflict("closed");

  const eventAtMs = slotToUtcMs(body.date, body.time);
  if (eventAtMs < earliestAllowed(Date.now(), body.headcount)) return conflict("too-soon");

  let distanceMiles: number | null = null;
  let rangeUnknown = false;
  if (body.fulfilment === "delivery" && body.address) {
    distanceMiles = estimateMiles(storeZip(body.store), body.address.zip);
    if (distanceMiles === null) {
      rangeUnknown = true;
    } else if (!inRange(distanceMiles, settings.rangeMiles)) {
      return conflict("out-of-range");
    }
  }

  const priced = quote(body.lines, {
    fulfilment: body.fulfilment,
    deliveryFeeCents: body.fulfilment === "delivery" ? settings.deliveryFeeCents : undefined,
    tip: body.tip,
    freebies: { plates: body.plateSets, napkins: body.plateSets, utensils: body.plateSets },
  });

  if (body.expectedTotalCents !== undefined && body.expectedTotalCents !== priced.totalCents) {
    return conflict("price-changed");
  }

  const items: CreateDraftOrderItemInput[] = priced.lines.map((line) => {
    const item = itemById(line.itemId);
    const desc = describeLine(line);
    return {
      itemId: line.itemId,
      itemName: item?.name ?? line.itemId,
      qty: line.qty,
      wayId: line.wayId,
      wayLabel: desc.wayLabel,
      toppings: line.toppings,
      toppingLabels: desc.toppingLabels,
      extras: line.extras,
      extraLabels: desc.extraLabels,
      unitCents: line.unitCents,
      amountCents: line.amountCents,
      forName: line.forName ?? null,
      note: line.note ?? null,
    };
  });

  const draft = await createDraftOrder(
    {
      store: body.store,
      fulfilment: body.fulfilment,
      eventAt: new Date(eventAtMs),
      headcount: body.headcount,
      contactName: body.contact.name,
      contactEmail: body.contact.email,
      contactPhone: body.contact.phone,
      company: body.company,
      poNumber: body.poNumber,
      onsiteContactName: body.onsite?.name,
      onsiteContactPhone: body.onsite?.phone,
      address:
        body.fulfilment === "delivery" && body.address
          ? {
              line1: body.address.line1,
              line2: body.address.line2 ?? null,
              city: body.address.city,
              state: body.address.state,
              zip: body.address.zip,
              instructions: body.address.instructions ?? null,
            }
          : null,
      distanceMiles,
      rangeUnknown,
      plateSets: body.plateSets,
      items,
      foodCents: priced.foodCents,
      deliveryCents: priced.deliveryCents,
      taxCents: priced.taxCents,
      tipCents: priced.tipCents,
      totalCents: priced.totalCents,
      customerNote: body.customerNote,
    },
    db,
  );

  if (isFakePaymentsMode()) {
    const fakeIds = fakeCheckoutIds();
    await completeCateringCheckout(db, { orderId: draft.orderId, ...fakeIds });
    return NextResponse.json({ url: `/catering/order/sent/?o=${draft.token}` });
  }

  const customerId = await findOrCreateCustomer(body.contact.email, body.contact.name);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priced.lines.map((line) => {
    const item = itemById(line.itemId);
    const desc = describeLine(line);
    const descriptors = [desc.wayLabel, ...desc.toppingLabels, ...desc.extraLabels]
      .filter(Boolean)
      .join(", ");
    return {
      quantity: line.qty,
      price_data: {
        currency: "usd",
        unit_amount: line.unitCents,
        product_data: {
          name: item?.name ?? line.itemId,
          description: descriptors || undefined,
        },
      },
    };
  });
  if (priced.deliveryCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: priced.deliveryCents,
        product_data: { name: "Delivery" },
      },
    });
  }
  lineItems.push({
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: priced.taxCents,
      product_data: { name: "Sales tax" },
    },
  });
  if (priced.tipCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: priced.tipCents,
        product_data: { name: "Tip for the crew" },
      },
    });
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    customer: customerId,
    line_items: lineItems,
    payment_intent_data: {
      capture_method: "manual",
      setup_future_usage: "off_session",
      metadata: { cateringOrderId: draft.orderId, number: draft.number },
    },
    metadata: { cateringOrderId: draft.orderId, number: draft.number },
    success_url: absoluteUrl(`/catering/order/sent/?o=${draft.token}`),
    cancel_url: absoluteUrl("/catering/order/?step=review&canceled=1"),
  };

  let session: { id: string; url: string };
  try {
    session = await createCateringCheckoutSession(params);
  } catch {
    await setStatus(draft.orderId, "cancelled", { cancelledAt: new Date() }, db);
    return NextResponse.json(
      { error: "Couldn't reach Stripe. Please try again." },
      { status: 502 },
    );
  }

  await attachStripeIds(draft.orderId, { checkoutSessionId: session.id, customerId }, db);

  return NextResponse.json({ url: session.url });
}
