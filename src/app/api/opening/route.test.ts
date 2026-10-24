import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));

import { GET } from "./route";

function request(authorization?: string): NextRequest {
  return new Request("https://www.chrisneddys.com/api/opening", {
    headers: authorization ? { authorization } : {},
  }) as unknown as NextRequest;
}

function at(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

beforeEach(() => {
  revalidatePath.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.CRON_SECRET;
});

describe("GET /api/opening", () => {
  it("re-renders every storefront page, llms.txt and the sitemap at Glendale's doors", async () => {
    at("2026-10-30T18:00:20-07:00");
    const res = GET(request());
    expect(await res.json()).toEqual({ revalidated: true, moment: "2026-10-30T18:00:00-07:00" });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/llms.txt");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });

  it("does nothing outside the opening moments", async () => {
    at("2026-10-29T18:00:20-07:00");
    expect(await GET(request()).json()).toEqual({ revalidated: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("checks Vercel's bearer token when CRON_SECRET is set", async () => {
    process.env.CRON_SECRET = "s3cret";
    at("2026-10-30T18:00:20-07:00");
    expect(GET(request()).status).toBe(401);
    expect(GET(request("Bearer wrong")).status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(GET(request("Bearer s3cret")).status).toBe(200);
    expect(revalidatePath).toHaveBeenCalled();
  });
});
