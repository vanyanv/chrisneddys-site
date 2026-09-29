/** Pure catering domain library — no database, no network, no React. */

export * from "./types";
export * from "./stores";
export {
  EXTRAS,
  type Extra,
  extraById,
  toppingById,
  toppingIdsForWay,
  resolveWay,
  wayLabel,
} from "./menu-adapter";
export {
  MAX_QTY,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  unitPriceCents,
  lineAmountCents,
  lineKey,
  stripControlChars,
  validateLine,
  type LineValidationError,
  type LineValidationResult,
  describeLine,
  type LineDescription,
  quote,
} from "./pricing";
export { LA_ZONE, laDateString, weekdayOf, zonedTimeToUtcMs } from "./timezone";
export {
  READY_BY_MINUTES_BEFORE,
  DRIVER_LEAVES_MINUTES_BEFORE,
  DEFAULT_LEAD_HOURS,
  earliestAllowed,
  slotsForDate,
  dayStatus,
  slotToUtcMs,
  readyByMs,
  driverLeavesMs,
} from "./schedule";
export {
  DRIVING_FUDGE_FACTOR,
  type ZipDistanceLookup,
  defaultZipDistance,
  estimateMiles,
  inRange,
} from "./range";
export { cancellationTier, refundForCancel } from "./cancellation";
export { groupForCrew, stationCounts, formatCrewNames } from "./crew";
export { formatCateringNumber } from "./order-number";
