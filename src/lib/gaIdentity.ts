import { GA_MEASUREMENT_ID } from "@/lib/analytics";

export type GaIdentity = { clientId: string; sessionId?: string };

function getField(field: "client_id" | "session_id"): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.gtag) return resolve(undefined);
    const timer = window.setTimeout(() => resolve(undefined), 350);
    window.gtag("get", GA_MEASUREMENT_ID, field, (value: unknown) => {
      window.clearTimeout(timer);
      resolve(typeof value === "string" || typeof value === "number" ? String(value) : undefined);
    });
  });
}

/** Identifiers only: no name, email, cart contents, or payment details. */
export async function getGaIdentity(): Promise<GaIdentity | undefined> {
  const [clientId, sessionId] = await Promise.all([getField("client_id"), getField("session_id")]);
  if (!clientId) return undefined;
  return { clientId, sessionId };
}
