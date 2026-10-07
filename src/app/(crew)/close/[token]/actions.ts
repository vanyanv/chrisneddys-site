"use server";

import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { resolveClientIp } from "@/lib/auth";
import { closingNow } from "@/lib/closing/clock";
import { checkCode, resolveCrew, signCrewToken } from "@/lib/closing/crew";
import { submitCheck, type Answer } from "@/lib/closing/checks";
import { CREW_COOKIE, LANG_COOKIE, normalizeTemp, parseLang } from "@/lib/closing/crewText";
import { getStoreByToken } from "@/lib/closing/store";

const CREW_COOKIE_MAX_AGE = 180 * 24 * 60 * 60;

export type EnterCodeResult =
  | { status: "ok" }
  | { status: "wrong" }
  | { status: "locked"; minutes: number }
  | { status: "gone" };

/** Checks a typed crew code and, if right, remembers the phone. */
export async function enterCode(token: string, code: string): Promise<EnterCodeResult> {
  const db = await getDb();
  const store = await getStoreByToken(db, String(token));
  if (!store) return { status: "gone" };
  const result = await checkCode(db, store.store, String(code), await resolveClientIp());
  if (result.status === "wrong") return { status: "wrong" };
  if (result.status === "locked") {
    return { status: "locked", minutes: Math.max(1, Math.ceil(result.retryAfterSeconds / 60)) };
  }
  (await cookies()).set(CREW_COOKIE, signCrewToken(result.crew.id, result.crew.sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/close",
    maxAge: CREW_COOKIE_MAX_AGE,
  });
  return { status: "ok" };
}

/** "Not you?": this phone forgets who it is. */
export async function forgetCrew(): Promise<void> {
  (await cookies()).delete({ name: CREW_COOKIE, path: "/close" });
}

export type SubmitNightResult =
  | { status: "sent" | "already" | "closed" | "signin" | "gone" }
  | { status: "invalid" };

/** Sends tonight's checklist as the crew member the cookie stands for. */
export async function submitNight(input: {
  token: string;
  answers: Answer[];
  note: string;
  at?: string;
}): Promise<SubmitNightResult> {
  if (!input || typeof input.token !== "string" || !Array.isArray(input.answers)) {
    return { status: "invalid" };
  }
  if (input.answers.length > 200) return { status: "invalid" };
  const answers: Answer[] = [];
  for (const a of input.answers as unknown[]) {
    if (!a || typeof a !== "object") return { status: "invalid" };
    const { itemId, done, value } = a as Record<string, unknown>;
    if (typeof itemId !== "string" || itemId.length > 64 || typeof done !== "boolean") {
      return { status: "invalid" };
    }
    if (value != null && typeof value !== "string") return { status: "invalid" };
    // "38,5" and "38.5" are the same reading; store the plain-decimal form.
    const reading = normalizeTemp(value);
    answers.push({
      itemId,
      done: done && (value == null || reading !== null),
      value: reading,
    });
  }
  if (input.at != null && typeof input.at !== "string") return { status: "invalid" };
  const db = await getDb();
  const store = await getStoreByToken(db, input.token);
  if (!store) return { status: "gone" };
  const jar = await cookies();
  const crew = await resolveCrew(db, store.store, jar.get(CREW_COOKIE)?.value);
  if (!crew) return { status: "signin" };
  const result = await submitCheck(db, {
    store: store.store,
    crew,
    answers,
    note: typeof input.note === "string" ? input.note.slice(0, 500) : "",
    lang: parseLang(jar.get(LANG_COOKIE)?.value),
    now: closingNow({ at: input.at }),
  });
  return { status: result.status };
}
