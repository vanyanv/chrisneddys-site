import { hasPassed, VAN_NUYS_OPENS_AT } from "@/data/locations";
import { deliverySentence, openHoursAnswer } from "@/lib/openLocations";

export type FaqEntry = { q: string; a: string };

/**
 * The three answers /order/ and /contact/ both give, in one place. Both pages
 * used to type these out separately — /contact/'s comment claimed they were
 * "lifted from /order/'s FAQ", but nothing imported anything, so the two
 * copies were one edit away from disagreeing. Now there is exactly one string
 * per answer, and the hours and delivery lines are built from the open stores'
 * data (`src/lib/openLocations.ts`) instead of hand-typed, so they can't drift
 * from what the store pages and the open/closed pill already say, and they
 * name every open store rather than just Hollywood.
 *
 * Order-only and contact-only questions stay defined on their own pages —
 * this is only the overlap.
 */
export const sharedFaq: FaqEntry[] = [
  {
    q: "Do you deliver?",
    // Getters, so a store that opens or joins an app joins the answer.
    get a() {
      return `Yes — ${deliverySentence()}. Ordering direct on our own storefront is pickup only, and it is the cheaper way to buy: the delivery apps set their own prices and add their own fees.`;
    },
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
    get a() {
      return openHoursAnswer();
    },
  },
];
