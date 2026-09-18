import type { Metadata } from "next";
import "@/styles/legal.css";
import { brand } from "@/data/brand";
import { getStoreSettings } from "@/lib/orders";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { breadcrumbLd, pageMetadata, ID } from "@/lib/seo";

const title = "Terms of Sale";
const description = "The terms of sale for orders placed through the Chris N Eddy's shop.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/terms/" });

/** Re-checked at most once a minute; `saveStoreSettings` (the /admin/settings
 * action) revalidates this path immediately on a save, same as `/shop/`. */
export const revalidate = 60;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** Splits on blank lines into paragraphs — the returns/terms textareas are
 * plain text, not markdown, so this is the only formatting either gets. */
function paragraphsOf(text: string): string[] {
  return text
    .split(/\n{1,}/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * `/terms` — the description of goods and terms of sale Stripe asks a site
 * to show before it can take payment. Renders straight from the owner's
 * `termsText` (`src/lib/orders.ts`'s `StoreSettings`, set at
 * `/admin/settings`); until that's set, this page says so honestly rather
 * than inventing terms nobody has agreed to.
 */
export default async function TermsPage() {
  const settings = await getStoreSettings();
  const terms = settings.termsText?.trim();
  const contactEmail = settings.supportEmail || brand.email;

  return (
    <div className="cne-lg">
      <JsonLdScript data={breadcrumbLd([{ name: "Terms", path: "/terms/" }])} />
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${brand.siteUrl}/terms/#page`,
          url: `${brand.siteUrl}/terms/`,
          name: `${title} — ${brand.name}`,
          description,
          inLanguage: "en-US",
          isPartOf: { "@id": ID.website },
          about: { "@id": ID.org },
          dateModified: settings.updatedAt.toISOString(),
        }}
      />

      <header className="cne-lg-head">
        <p className="cne-lg-eyebrow">Legal</p>
        <h1>Terms of Sale</h1>
        {terms && (
          <p className="cne-lg-date">
            Last updated{" "}
            <time dateTime={settings.updatedAt.toISOString()}>
              {dateFormatter.format(settings.updatedAt)}
            </time>
          </p>
        )}
      </header>

      {terms ? (
        <section className="cne-lg-sec" aria-label="Terms of sale">
          {paragraphsOf(terms).map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </section>
      ) : (
        <section className="cne-lg-sec">
          <p>
            The terms of sale haven&rsquo;t been published yet. Until they are published, checkout
            stays closed. Questions: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </section>
      )}

      <section className="cne-lg-sec" aria-labelledby="tm-contact">
        <h2 id="tm-contact">Contact</h2>
        <p className="cne-lg-contact">
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </p>
      </section>
    </div>
  );
}
