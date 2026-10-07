/** The per-store closing row (secret link token) and its starter checklist. */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { closingItems, closingStores } from "@/db/schema";

type StoreRow = typeof closingStores.$inferSelect;

const newToken = () => randomBytes(18).toString("base64url");

/**
 * Starter checklist for Van Nuys. PLACEHOLDERS written by Claude (English and
 * Spanish) — the owner is expected to replace them in /admin. Sections appear
 * in this order.
 */
const STARTER_ITEMS: Record<
  string,
  Array<{
    section: string;
    label: string;
    labelEs: string;
    detail?: string;
    detailEs?: string;
    kind?: "check" | "temp";
    maxValue?: number;
  }>
> = {
  vannuys: [
    ...(
      [
        ["Grill scraped and seasoned", "Parrilla raspada y curada"],
        ["Fryer oil filtered, fryers off", "Aceite de freidoras filtrado, freidoras apagadas"],
        ["Hoods and flat-top off", "Campanas y plancha apagadas"],
      ] as const
    ).map(([label, labelEs]) => ({ section: "Kitchen", label, labelEs })),
    {
      section: "Kitchen",
      label: "Walk-in cooler temperature",
      labelEs: "Temperatura del cuarto frío",
      detail: "41°F or colder",
      detailEs: "41°F o menos",
      kind: "temp" as const,
      maxValue: 41,
    },
    {
      section: "Kitchen",
      label: "All food covered, labeled and dated",
      labelEs: "Toda la comida tapada, etiquetada y con fecha",
    },
    {
      section: "Kitchen",
      label: "Prep line wiped and sanitized",
      labelEs: "Línea de preparación limpia y desinfectada",
    },
    {
      section: "Front and restrooms",
      label: "Floors swept and mopped",
      labelEs: "Pisos barridos y trapeados",
      detail: "Kitchen and dining room",
      detailEs: "Cocina y comedor",
    },
    {
      section: "Front and restrooms",
      label: "Trash and cardboard out, bin lids shut",
      labelEs: "Basura y cartón afuera, tapas de los botes cerradas",
    },
    {
      section: "Front and restrooms",
      label: "Restrooms cleaned and restocked",
      labelEs: "Baños limpios y surtidos",
    },
    {
      section: "Lock-up",
      label: "Cash drawer counted and dropped",
      labelEs: "Caja contada y depositada",
    },
    {
      section: "Lock-up",
      label: "Back door locked",
      labelEs: "Puerta de atrás cerrada con llave",
    },
    {
      section: "Lock-up",
      label: "Lights off, alarm set",
      labelEs: "Luces apagadas, alarma puesta",
    },
  ],
};

/**
 * The closing row for `store`. Created on first call with a random URL-safe
 * token, and (only then) seeded with the starter items for that store.
 */
export async function getOrCreateStore(db: Db, store: string): Promise<StoreRow> {
  const [existing] = await db.select().from(closingStores).where(eq(closingStores.store, store));
  if (existing) return existing;
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(closingStores)
      .values({ store, linkToken: newToken() })
      .onConflictDoNothing()
      .returning();
    if (!created) {
      const [row] = await tx.select().from(closingStores).where(eq(closingStores.store, store));
      return row!;
    }
    const starter = STARTER_ITEMS[store] ?? [];
    if (starter.length > 0) {
      await tx
        .insert(closingItems)
        .values(starter.map((item, position) => ({ store, ...item, position })));
    }
    return created;
  });
}

/** Issues a new link token; the old QR sign stops working. */
export async function rotateLink(db: Db, store: string): Promise<StoreRow> {
  await getOrCreateStore(db, store);
  const [row] = await db
    .update(closingStores)
    .set({ linkToken: newToken(), updatedAt: new Date() })
    .where(eq(closingStores.store, store))
    .returning();
  return row!;
}

export async function getStoreByToken(db: Db, token: string): Promise<StoreRow | null> {
  const [row] = await db.select().from(closingStores).where(eq(closingStores.linkToken, token));
  return row ?? null;
}
