import { flagship, hasPassed, VAN_NUYS_OPENS_AT } from "@/data/locations";
import { hoursSentence } from "@/lib/hours";

export type FaqEntry = { q: string; a: string };

/**
 * The three answers /order/ and /contact/ both give, in one place. Both pages
 * used to type these out separately — /contact/'s comment claimed they were
 * "lifted from /order/'s FAQ", but nothing imported anything, so the two
 * copies were one edit away from disagreeing. Now there is exactly one string
 * per answer, and the hours line is computed from `flagship`'s data instead of
 * hand-typed, so it can't drift from what the store page and the open/closed
 * pill already say.
 *
 * Order-only and contact-only questions stay defined on their own pages —
 * this is only the overlap.
 */
export const sharedFaq: FaqEntry[] = [
  {
    q: "Do you deliver?",
    a: "Yes — DoorDash, Uber Eats and Grubhub all deliver from the Hollywood location. Ordering direct on our own storefront is pickup only, and it is the cheaper way to buy: the delivery apps set their own prices and add their own fees.",
  },
  {
    q: "Can I order from Glendale or Van Nuys?",
    // A getter, so the answer changes itself when Van Nuys opens.
    get a() {
      return hasPassed(VAN_NUYS_OPENS_AT)
        ? "Van Nuys, yes — it is open, and takes pickup orders on its own page. Glendale has not opened yet."
        : "Not yet — those locations have not opened. Until they do, every order runs through Hollywood.";
    },
  },
  {
    q: "What time do you close?",
    a: `Late. The Hollywood location is open ${hoursSentence(flagship)}.`,
  },
];
