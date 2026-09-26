import "server-only";
import OpenAI from "openai";
import { brand } from "@/data/brand";
import { formatPrice } from "@/lib/otter";
import {
  DESCRIPTION_LIMIT,
  IMAGE_ALT_LIMIT,
  KEYWORDS_LIMIT,
  TITLE_LIMIT,
  draftStoredSeo,
  type ProductSeoInput,
} from "@/lib/productSeo";

/**
 * GPT writes a product's search-engine fields.
 *
 * The point of this file is that a new product arrives with copy an owner would
 * have written if they knew what a meta description was for — and that nothing
 * anywhere depends on it working. `writeProductSeo` falls back to
 * `draftStoredSeo`, which is derived from the product and always available, when
 * `OPENAI_API_KEY` is unset, when the request fails, when it takes too long or
 * when the model returns something that does not fit the budgets. It never
 * throws and never returns a partial answer, so the worst case of this whole
 * feature being switched off is copy that reads a little flatter.
 *
 * It is never on a customer's path: it runs once, from a server action, at the
 * moment an owner creates a product or presses the button to rewrite the
 * fields. That is also why the timeout is short — an owner is watching a
 * button, and a slower answer is worth less than an immediate one from the
 * fallback.
 */

/** The four fields, as they are stored. */
export type WrittenSeo = {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  socialImageAlt: string;
};

/**
 * Long enough for a slow first token, short enough that an owner never sits in
 * front of a spinner wondering whether the save worked.
 */
const TIMEOUT_MS = 12_000;

/**
 * A small, fast model: this is four short lines of copy from a handful of
 * facts, not a reasoning problem, and it runs while somebody waits. Override
 * with `OPENAI_MODEL` to point it at a different one without a deploy of new
 * code — see DEPLOY.md.
 */
const MODEL = (process.env.OPENAI_MODEL ?? "").trim() || "gpt-5.4-mini";

/**
 * `strict: true` requires every property listed in `required` and
 * `additionalProperties: false`, which is also exactly what this caller wants:
 * four fields, always all four, nothing else to guard against.
 */
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["metaTitle", "metaDescription", "metaKeywords", "socialImageAlt"],
  properties: {
    metaTitle: {
      type: "string",
      description: `The <title>. At most ${TITLE_LIMIT} characters. Lead with the product's name.`,
    },
    metaDescription: {
      type: "string",
      description: `The search snippet. At most ${DESCRIPTION_LIMIT} characters. Lead with the name and the price.`,
    },
    metaKeywords: {
      type: "string",
      description: `Three to six comma-separated search terms, ${KEYWORDS_LIMIT} characters in total at most.`,
    },
    socialImageAlt: {
      type: "string",
      description: `Alt text for the 1200x630 share card, read aloud by a screen reader. At most ${IMAGE_ALT_LIMIT} characters.`,
    },
  },
} as const;

const SYSTEM = [
  `You write search-engine copy for the online shop of ${brand.name}, a Los Angeles smash-burger restaurant that sells a small run of merch alongside the food.`,
  "",
  "Rules, in order of importance:",
  "1. Never state a fact you were not given. No shipping times, no delivery promises, no returns window, no sizes, no materials, no review scores, no discounts, no urgency you were not told about. If a detail is missing, write around it.",
  "2. Stay inside every character budget. A title that gets truncated is worse than a short one.",
  "3. Write the way a person who works there would: plain, concrete, specific. Lead with the name and the price. No adjectives doing the work of facts, no exclamation marks, no words like 'premium', 'exclusive', 'must-have' or 'elevate'.",
  "4. Keywords are terms someone would actually type. Do not repeat the same term in different word order, and do not pad the list.",
  "5. The alt text describes a share card showing the product's name and price, not a photograph. Describe what the card says.",
].join("\n");

/** Only the fields worth spending tokens on, labelled so the model can tell them apart. */
function brief(product: ProductSeoInput): string {
  const price =
    typeof product.price === "number" && product.price > 0 ? formatPrice(product.price) : null;
  const lines: Array<[string, string | null | undefined]> = [
    [
      "Name",
      [product.displayName1, product.displayName2].filter(Boolean).join(" ") || product.name,
    ],
    ["Drop label", product.eyebrow],
    ["Price", price],
    ["Description", product.description],
    ["Scarcity", product.limitedNote],
    ["URL", `${brand.siteUrl}/shop/${product.slug}/`],
  ];
  return lines
    .map(([label, value]) => [label, (value ?? "").trim()] as const)
    .filter(([, value]) => value !== "")
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

/** A field the model left blank or ran over its budget is not used. */
function usable(value: unknown, limit: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length > limit) return null;
  return trimmed;
}

function parseResponse(raw: unknown): Partial<WrittenSeo> {
  if (!raw || typeof raw !== "object") return {};
  const value = raw as Record<string, unknown>;
  return {
    metaTitle: usable(value.metaTitle, TITLE_LIMIT) ?? undefined,
    metaDescription: usable(value.metaDescription, DESCRIPTION_LIMIT) ?? undefined,
    metaKeywords: usable(value.metaKeywords, KEYWORDS_LIMIT) ?? undefined,
    socialImageAlt: usable(value.socialImageAlt, IMAGE_ALT_LIMIT) ?? undefined,
  };
}

/**
 * True when a key is set. The admin uses this to say whether the rewrite
 * button did anything better than the derived copy, rather than claiming it
 * did when there was nothing to call.
 */
export function seoWriterConfigured(): boolean {
  return Boolean((process.env.OPENAI_API_KEY ?? "").trim());
}

/**
 * Writes the four fields for one product. Returns the derived copy with
 * anything the model wrote layered over it, so a partial answer is still an
 * improvement and a failed one is still complete.
 */
export async function writeProductSeo(product: ProductSeoInput): Promise<WrittenSeo> {
  const fallback = draftStoredSeo(product);
  if (!seoWriterConfigured()) return fallback;

  const details = brief(product);
  // Nothing worth asking about: a product with no name yet is what The Rack's
  // "New product" button creates, and the derived copy is the honest answer.
  if (!details.includes("Name:")) return fallback;

  try {
    const client = new OpenAI({ timeout: TIMEOUT_MS, maxRetries: 1 });
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 2000,
      response_format: {
        type: "json_schema",
        json_schema: { name: "product_seo", strict: true, schema: SCHEMA },
      },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Write the search-engine fields for this product.\n\n${details}` },
      ],
    });

    const choice = completion.choices[0];
    // Cut off mid-JSON, or declined: either way there is nothing to read.
    if (!choice || choice.finish_reason === "length" || choice.message.refusal) return fallback;

    const written = parseResponse(readJson(choice.message.content));
    return {
      metaTitle: written.metaTitle ?? fallback.metaTitle,
      metaDescription: written.metaDescription ?? fallback.metaDescription,
      metaKeywords: written.metaKeywords ?? fallback.metaKeywords,
      socialImageAlt: written.socialImageAlt ?? fallback.socialImageAlt,
    };
  } catch (error) {
    // Never surfaced to an owner and never fatal: the fallback is already
    // correct, so a logged line is the whole of the handling this needs.
    console.warn("[seoWriter] falling back to derived copy", describe(error));
    return fallback;
  }
}

/** Structured outputs promise valid JSON; a malformed body is still survivable. */
function readJson(content: string | null | undefined): unknown {
  const text = (content ?? "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Enough to debug from a log line, without putting a key or a body in one. */
function describe(error: unknown): string {
  if (error instanceof OpenAI.AuthenticationError) return "OPENAI_API_KEY was rejected";
  if (error instanceof OpenAI.RateLimitError) return "rate limited";
  if (error instanceof OpenAI.APIConnectionTimeoutError) return `timed out after ${TIMEOUT_MS}ms`;
  if (error instanceof OpenAI.NotFoundError) return `no such model: ${MODEL}`;
  if (error instanceof OpenAI.APIError) return `API error ${error.status}`;
  return error instanceof Error ? error.name : "unknown error";
}
