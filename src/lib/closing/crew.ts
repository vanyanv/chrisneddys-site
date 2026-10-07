/** Crew members, their 4-digit codes, and the "remember this phone" cookie. */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { closingCrew } from "@/db/schema";
import {
  checkIpThrottle,
  pruneSignInAttempts,
  recordSignInAttempt,
  remainingSignInAttempts,
} from "@/lib/signInThrottle";

export type CrewMember = typeof closingCrew.$inferSelect;

export const CREW_CODE_KIND = "crew_code";
const MAX_CODE_ATTEMPTS = 8;

export async function listCrew(db: Db, store: string): Promise<CrewMember[]> {
  return db
    .select()
    .from(closingCrew)
    .where(eq(closingCrew.store, store))
    .orderBy(asc(closingCrew.name));
}

/** A random 4-digit code no one in this store (active or not) already has. */
async function freshCode(db: Db, store: string): Promise<string> {
  const used = new Set((await listCrew(db, store)).map((c) => c.code));
  if (used.size >= 10_000) throw new Error("No 4-digit codes left for this store");
  for (;;) {
    const code = String(randomInt(0, 10_000)).padStart(4, "0");
    if (!used.has(code)) return code;
  }
}

/** True for a Postgres unique violation (23505), however the driver wraps it. */
function isUniqueViolation(err: unknown): boolean {
  for (let e = err as { code?: string; cause?: unknown } | undefined, i = 0; e && i < 5; i++) {
    if (e.code === "23505") return true;
    e = e.cause as typeof e;
  }
  return false;
}

/** Runs `fn`, retrying a few times when two codes were handed out at once. */
async function retryOnCodeClash<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isUniqueViolation(err) || attempt >= 5) throw err;
    }
  }
}

export async function addCrew(db: Db, store: string, name: string): Promise<CrewMember> {
  return retryOnCodeClash(async () => {
    const [row] = await db
      .insert(closingCrew)
      .values({ store, name, code: await freshCode(db, store) })
      .returning();
    return row!;
  });
}

async function getCrew(db: Db, id: string): Promise<CrewMember | null> {
  const [row] = await db.select().from(closingCrew).where(eq(closingCrew.id, id));
  return row ?? null;
}

/** New code, and every phone that remembered the old one is signed out. */
export async function newCode(db: Db, id: string): Promise<CrewMember | null> {
  const member = await getCrew(db, id);
  if (!member) return null;
  return retryOnCodeClash(async () => {
    const [row] = await db
      .update(closingCrew)
      .set({
        code: await freshCode(db, member.store),
        sessionVersion: sql`${closingCrew.sessionVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(closingCrew.id, id))
      .returning();
    return row!;
  });
}

/** Turning someone on issues a fresh code; both directions sign out phones. */
export async function setActive(db: Db, id: string, active: boolean): Promise<CrewMember | null> {
  const member = await getCrew(db, id);
  if (!member) return null;
  return retryOnCodeClash(async () => {
    const [row] = await db
      .update(closingCrew)
      .set({
        active,
        code: active ? await freshCode(db, member.store) : member.code,
        sessionVersion: sql`${closingCrew.sessionVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(closingCrew.id, id))
      .returning();
    return row!;
  });
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

const sign = (payload: string) =>
  createHmac("sha256", secret()).update(`closing-crew:${payload}`).digest("base64url");

/** Cookie value `crewId.version.sig`. */
export function signCrewToken(crewId: string, version: number): string {
  const payload = `${crewId}.${version}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyCrewToken(value: string): { crewId: string; version: number } | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [crewId, version, sig] = parts as [string, string, string];
  const expected = Buffer.from(sign(`${crewId}.${version}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const v = Number(version);
  return Number.isInteger(v) ? { crewId, version: v } : null;
}

/** The crew member a remembered-phone cookie stands for, if still valid. */
export async function resolveCrew(
  db: Db,
  store: string,
  cookieValue: string | undefined,
): Promise<CrewMember | null> {
  if (!cookieValue) return null;
  const token = verifyCrewToken(cookieValue);
  if (!token) return null;
  const [row] = await db
    .select()
    .from(closingCrew)
    .where(and(eq(closingCrew.id, token.crewId), eq(closingCrew.store, store)));
  if (!row || !row.active || row.sessionVersion !== token.version) return null;
  return row;
}

export type CodeResult =
  | { status: "ok"; crew: CrewMember }
  | { status: "wrong"; attemptsLeft: number }
  | { status: "locked"; retryAfterSeconds: number };

/** Checks a typed code. Throttled per IP: 8 failures / 15 minutes. */
export async function checkCode(
  db: Db,
  store: string,
  code: string,
  ip: string,
  now: Date = new Date(),
): Promise<CodeResult> {
  await pruneSignInAttempts(db, now);
  const who = `crew:${store}`;
  const throttle = await checkIpThrottle(db, ip, MAX_CODE_ATTEMPTS, now, CREW_CODE_KIND);
  if (throttle.locked) {
    await recordSignInAttempt(db, who, ip, false, now, CREW_CODE_KIND);
    return { status: "locked", retryAfterSeconds: throttle.retryAfterSeconds };
  }
  const [crew] = /^\d{4}$/.test(code)
    ? await db
        .select()
        .from(closingCrew)
        .where(
          and(
            eq(closingCrew.store, store),
            eq(closingCrew.code, code),
            eq(closingCrew.active, true),
          ),
        )
    : [];
  if (!crew) {
    await recordSignInAttempt(db, who, ip, false, now, CREW_CODE_KIND);
    return {
      status: "wrong",
      attemptsLeft: remainingSignInAttempts(throttle.failures + 1, MAX_CODE_ATTEMPTS),
    };
  }
  await recordSignInAttempt(db, who, ip, true, now, CREW_CODE_KIND);
  return { status: "ok", crew };
}
