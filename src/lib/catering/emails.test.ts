import { describe, expect, it, vi } from "vitest";

// See the note in src/app/api/checkout/route.test.ts — `server-only` throws
// outside a real Next.js server build.
vi.mock("server-only", () => ({}));

import {
  buildBookedEmail,
  buildCancelledEmail,
  buildChangeApprovedEmail,
  buildChangeDeclinedEmail,
  buildChangeReceivedEmail,
  buildDeclinedEmail,
  buildExpiredEmail,
  buildFindMyOrdersEmail,
  buildOwnerNewRequestEmail,
  buildRequestReceivedEmail,
  buildThankYouEmail,
  renderCateringEmailPreviews,
} from "./emails";
import type { CateringOrderItem, CateringOrderWithItems } from "./orders";

function item(overrides: Partial<CateringOrderItem> = {}): CateringOrderItem {
  const now = new Date();
  return {
    id: "item-1",
    orderId: "order-1",
    position: 0,
    itemId: "sliders-fries",
    itemName: "Sliders and Fries",
    qty: 2,
    wayId: "chriss-way",
    wayLabel: "Chris's Way",
    toppings: ["lettuce"],
    toppingLabels: ["Lettuce"],
    extras: [],
    extraLabels: [],
    unitCents: 500,
    amountCents: 1000,
    forName: null,
    note: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function order(overrides: Partial<CateringOrderWithItems> = {}): CateringOrderWithItems {
  const now = new Date();
  return {
    id: "order-1",
    number: "CAT-1042",
    token: "tok_abc123",
    status: "requested",
    store: "hollywood",
    fulfilment: "pickup",
    eventAt: new Date("2026-10-10T18:00:00-07:00"),
    headcount: null,
    contactName: "Pat Customer",
    contactEmail: "pat@example.com",
    contactPhone: "555-1234",
    company: null,
    poNumber: null,
    onsiteContactName: null,
    onsiteContactPhone: null,
    address: null,
    distanceMiles: null,
    rangeUnknown: false,
    plateSets: 0,
    foodCents: 6000,
    deliveryCents: 0,
    taxCents: 585,
    tipCents: 600,
    totalCents: 7185,
    refundedCents: 0,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripeCustomerId: null,
    stripePaymentMethodId: null,
    requestedAt: now,
    respondBy: new Date("2026-09-29T10:14:00-07:00"),
    approvedAt: null,
    declinedAt: null,
    declineReason: null,
    cancelledAt: null,
    expiresAt: null,
    customerNote: null,
    ownerNote: null,
    pendingChange: null,
    createdAt: now,
    updatedAt: now,
    items: [item()],
    ...overrides,
  };
}

describe("catering email builders", () => {
  it("request received names the reply deadline and hold amount", () => {
    const { subject, html, text } = buildRequestReceivedEmail(order());
    expect(subject).toContain("CAT-1042");
    expect(text).toContain("$71.85");
    expect(html).toContain("VIEW OR CHANGE");
    expect(html).toContain("tok_abc123");
  });

  it("booked states the charge and the free-cancel deadline", () => {
    const { text } = buildBookedEmail(order());
    expect(text).toContain("Charged $71.85");
    expect(text).toMatch(/Free to cancel until/);
  });

  it("declined includes the reason and a contact link, never a phone link", () => {
    const { text, html } = buildDeclinedEmail(order(), "We're fully booked that day.");
    expect(text).toContain("We're fully booked that day.");
    expect(html).toContain("/contact/");
    expect(html).not.toContain("tel:");
  });

  it("expired states no charge was made", () => {
    const { text } = buildExpiredEmail(order());
    expect(text).toMatch(/weren't charged/);
  });

  it("cancelled states the refund amount, or that nothing is refunded", () => {
    expect(buildCancelledEmail(order(), 3592).text).toContain("$35.92");
    expect(buildCancelledEmail(order(), 0).text).toMatch(/nothing is being refunded/);
  });

  it("change received/approved/declined name the right state", () => {
    expect(buildChangeReceivedEmail(order()).text).toMatch(/card hasn't been touched/);
    expect(buildChangeApprovedEmail(order()).text).toContain("$71.85");
    expect(buildChangeDeclinedEmail(order(), "No availability.").text).toContain(
      "No availability.",
    );
    expect(buildChangeDeclinedEmail(order()).text).toMatch(/stays as it was/);
  });

  it("find my orders always resolves the same shape whether or not there are orders", () => {
    const withOrders = buildFindMyOrdersEmail([
      { number: "CAT-1001", token: "tok1", eventAt: new Date("2026-10-01T18:00:00-07:00") },
    ]);
    expect(withOrders.text).toContain("CAT-1001");

    const withNone = buildFindMyOrdersEmail([]);
    expect(withNone.subject).toBe(withOrders.subject);
    expect(withNone.text).toMatch(/didn't find any/);
  });

  it("thank you includes a review link", () => {
    const { html, text } = buildThankYouEmail(order());
    expect(text).toMatch(/https:\/\//);
    expect(html).toContain("LEAVE A REVIEW");
  });

  it("owner new-request email is itemized: name, note and extras all appear, HTML-escaped", () => {
    const withNamedLine = order({
      items: [
        item({
          forName: "Dev <Patel>",
          note: 'Separate tray & label it "please"',
          extras: ["make-it-halal"],
          extraLabels: ["Make it Halal"],
        }),
      ],
    });
    const { text, html } = buildOwnerNewRequestEmail(withNamedLine);
    expect(text).toContain("for Dev <Patel>");
    expect(text).toContain("Make it Halal");
    expect(text).toContain("Separate tray & label it");
    // The HTML body must escape the name and note rather than injecting them raw.
    expect(html).not.toContain("<Patel>");
    expect(html).toContain("Dev &lt;Patel&gt;");
    expect(html).toContain("&quot;please&quot;");
    expect(html).toContain("/admin/catering/order-1/");
    expect(html).toContain("/crew-ticket/");
    expect(html).toContain("/invoice/");
  });

  it("owner email flags an unrecognized delivery ZIP", () => {
    const flagged = order({
      fulfilment: "delivery",
      rangeUnknown: true,
      address: {
        line1: "123 Main St",
        line2: null,
        city: "Somewhere",
        state: "CA",
        zip: "00000",
        instructions: null,
      },
    });
    const { text } = buildOwnerNewRequestEmail(flagged);
    expect(text).toMatch(/not recognized/);
  });
});

describe("renderCateringEmailPreviews", () => {
  it("returns every catering email, each with a subject/html/text", () => {
    const previews = renderCateringEmailPreviews();
    const ids = previews.map((p) => p.id);
    expect(ids).toEqual([
      "request-received",
      "booked",
      "declined",
      "expired",
      "cancelled",
      "change-received",
      "change-approved",
      "change-declined",
      "find-my-orders",
      "thank-you",
      "owner-new-request",
    ]);
    for (const preview of previews) {
      expect(preview.content.subject.length).toBeGreaterThan(0);
      expect(preview.content.html).toContain("<html>");
      expect(preview.content.text.length).toBeGreaterThan(0);
    }
  });
});
