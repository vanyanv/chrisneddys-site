import type { WayId } from "@/data/menu";
import type { CateringStoreId } from "./stores";

/** How the order leaves the store. */
export type Fulfilment = "pickup" | "delivery";

/**
 * One line in a catering cart.
 *
 * `wayId` is one of the menu's named presets, `null` for an item that takes
 * no toppings (or took none of the preset ways) with nothing else picked,
 * or `"custom"` once the topping selection no longer matches either preset
 * exactly — see `resolveWay` in `pricing.ts`.
 */
export type CartLine = {
  itemId: string;
  qty: number;
  wayId: WayId | "custom" | null;
  /** Topping ids from `src/data/menu.ts`'s `toppings`, free. */
  toppings: string[];
  /** Extra ids from `EXTRAS` in `menu-adapter.ts`, paid. */
  extras: string[];
  /** Who this line is for, e.g. "Dev Patel". */
  forName?: string;
  note?: string;
};

/** A `CartLine` with its computed per-unit and line pricing. */
export type PricedLine = CartLine & {
  unitCents: number;
  amountCents: number;
};

/** Free disposables, counted rather than priced. */
export type Freebies = {
  plates: number;
  napkins: number;
  utensils: number;
};

export type TipInput = { tipPercent: number } | { tipCents: number };

export type QuoteInput = {
  fulfilment: Fulfilment;
  /** Ignored for pickup. */
  deliveryFeeCents?: number;
  /** Defaults to 10% of food when omitted. */
  tip?: TipInput;
  freebies?: Partial<Freebies>;
};

export type Quote = {
  lines: PricedLine[];
  foodCents: number;
  deliveryCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  freebies: Freebies;
};

/** One open window on a given weekday, in 24-hour "HH:MM" wall-clock time. */
export type HoursWindow = { open: string; close: string };

export type DaySchedule = { closed: true } | { closed?: false; windows: HoursWindow[] };

/** 0 = Sunday … 6 = Saturday, same as `Date#getDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Owner-set catering hours, per store, per weekday. */
export type CateringHours = Record<CateringStoreId, Record<Weekday, DaySchedule>>;

/** Days the whole business is off, plus days a single store is off. */
export type DaysOff = {
  all: string[];
  byStore: Partial<Record<CateringStoreId, string[]>>;
};

export type DayStatus = "open" | "closed" | "too-soon" | "past";

export type CancellationTier = "free" | "half" | "none";

export type CancellationQuote = {
  tier: CancellationTier;
  refundCents: number;
};

/** One exact build (item + way/toppings/extras) as it will be made. */
export type CrewBuild = {
  wayId: WayId | "custom" | null;
  toppingLabels: string[];
  extraLabels: string[];
  /** Names of everyone who ordered this exact build, one entry per named line's qty. */
  names: string[];
  /** Free-text notes carried by any line folded into this build. */
  notes: string[];
  halal: boolean;
  count: number;
};

/** One menu item's worth of builds for the crew ticket's make list. */
export type CrewItemGroup = {
  itemId: string;
  itemName: string;
  totalCount: number;
  builds: CrewBuild[];
};

/** Griddle/fryer/topping station totals for the crew ticket's summary. */
export type StationCounts = {
  patties: number;
  halalPatties: number;
  cheeseSlices: number;
  rolls: number;
  /** Keyed by topping id from `src/data/menu.ts`. */
  toppings: Record<string, number>;
  fries: number;
  shakes: number;
  sauceCups: number;
};
