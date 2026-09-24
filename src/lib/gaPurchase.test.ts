import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderWithItems } from "@/lib/orders";

vi.mock("server-only", () => ({}));

import { sendConfirmedPurchase } from "./gaPurchase";

const order = {
  number: "CNE-1001",
  currency: "usd",
  subtotalCents: 9600,
  shippingCents: 500,
  taxCents: 800,
  items: [
    {
      product: { slug: "foam-trucker-blue" },
      productName: "Foam Trucker",
      sku: "FOAM-BLUE",
      unitPriceCents: 4800,
      quantity: 2,
    },
  ],
} as OrderWithItems;

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GA4_API_SECRET;
});

describe("confirmed GA4 purchase", () => {
  it("sends one subtotal-based purchase with stable product ID and checkout identity", async () => {
    process.env.GA4_API_SECRET = "test-secret";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    expect(
      await sendConfirmedPurchase(order, {
        gaClientId: "123456.987654",
        gaSessionId: "1234567890",
      }),
    ).toBe(true);

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url.searchParams.get("measurement_id")).toBe("G-9WECB13653");
    expect(url.searchParams.get("api_secret")).toBe("test-secret");
    expect(JSON.parse(options.body)).toEqual({
      client_id: "123456.987654",
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: "CNE-1001",
            currency: "USD",
            value: 96,
            shipping: 5,
            tax: 8,
            session_id: "1234567890",
            engagement_time_msec: 1,
            items: [
              {
                item_id: "foam-trucker-blue",
                item_name: "Foam Trucker",
                item_variant: "FOAM-BLUE",
                price: 48,
                quantity: 2,
              },
            ],
          },
        },
      ],
    });
  });

  it("does not call GA4 without a secret or a valid client ID", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendConfirmedPurchase(order, { gaClientId: "123456.987654" })).toBe(false);
    process.env.GA4_API_SECRET = "test-secret";
    expect(await sendConfirmedPurchase(order, { gaClientId: "bad" })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
