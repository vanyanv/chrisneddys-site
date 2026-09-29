/** Decline reasons for `OrderActionsPanel`'s dropdown. Split out of
 * `actions.ts`: that file is `"use server"`, and every export of a
 * `"use server"` module has to be an async function — a plain array export
 * living there crashed the whole page with "A 'use server' file can only
 * export async functions, found object." the moment it was imported. */
export const DECLINE_REASONS = [
  "Closed that day",
  "Too big for that time",
  "Too far",
  "Other",
] as const;
