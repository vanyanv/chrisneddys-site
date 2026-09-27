import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

const migrationsFolder = fileURLToPath(new URL("../../../../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

async function post(body: unknown): Promise<Response> {
  const { POST } = await import("./route");
  const request = new NextRequest("http://localhost/api/catering/range", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request);
}

describe("POST /api/catering/range", () => {
  it("returns miles and inRange for a nearby ZIP", async () => {
    const res = await post({ store: "hollywood", zip: "90028" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.miles).toBe(0);
    expect(body.inRange).toBe(true);
    expect(body.unknown).toBe(false);
  });

  it("flags out-of-range for a distant ZIP", async () => {
    const res = await post({ store: "hollywood", zip: "95014" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inRange).toBe(false);
    expect(body.unknown).toBe(false);
    expect(body.miles).toBeGreaterThan(10);
  });

  it("flags an unrecognized ZIP as unknown, not out-of-range", async () => {
    const res = await post({ store: "hollywood", zip: "00000" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.miles).toBeNull();
    expect(body.unknown).toBe(true);
    expect(body.inRange).toBe(false);
  });

  it("400s for an unknown store", async () => {
    const res = await post({ store: "glendale", zip: "90028" });
    expect(res.status).toBe(400);
  });
});
