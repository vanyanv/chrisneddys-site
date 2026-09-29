/**
 * The one read the customer UI needs to build the whole `/catering/order/`
 * flow client-side: settings plus each catering store's public address
 * details, with the database's hours/days-off shapes already converted to
 * the library's (see `hours.ts`). Safe to pass straight into a client
 * component — nothing here is a secret, and nothing here is a Drizzle row.
 */
import type { Db } from "@/db/client";
import { locations } from "@/data/locations";
import { getCateringSettings } from "./settings";
import { toScheduleDaysOff, toScheduleHours } from "./hours";
import { CATERING_STORES, type CateringStoreId } from "./stores";
import type { CateringHours, DaysOff } from "./types";

export type PublicCateringStore = {
  id: CateringStoreId;
  name: string;
  address: string;
  city: string;
  zip: string;
  phone: string;
};

export type PublicCateringConfig = {
  orderingOn: boolean;
  stores: PublicCateringStore[];
  hours: CateringHours;
  daysOff: DaysOff;
  deliveryFeeCents: number;
  rangeMiles: number;
  replyHours: number;
  leadHours: number;
};

function publicStore(id: CateringStoreId): PublicCateringStore {
  const location = locations.find((l) => l.id === id);
  const fallbackName = CATERING_STORES.find((s) => s.id === id)?.name ?? id;
  return {
    id,
    name: location?.name ?? fallbackName,
    address: location?.address ?? "",
    city: location?.city ?? "",
    zip: location?.postal ?? "",
    phone: location?.phone ?? "",
  };
}

export async function getPublicCateringConfig(db?: Db): Promise<PublicCateringConfig> {
  const settings = await getCateringSettings(db);
  return {
    orderingOn: settings.orderingOn,
    stores: CATERING_STORES.map((s) => publicStore(s.id)),
    hours: toScheduleHours(settings.hours),
    daysOff: toScheduleDaysOff(settings.daysOff),
    deliveryFeeCents: settings.deliveryFeeCents,
    rangeMiles: settings.rangeMiles,
    replyHours: settings.replyHours,
    leadHours: settings.leadHours,
  };
}
