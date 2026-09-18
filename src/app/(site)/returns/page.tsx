import type { Metadata } from "next";
import "@/styles/legal.css";
import { brand } from "@/data/brand";
import { getPublicStoreSettings } from "@/lib/orders";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { breadcrumbLd, pageMetadata, ID } from "@/lib/seo";

const title = "Returns Policy";
const description = "The returns policy for orders placed through the Chris N Eddy's shop.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/returns/" });

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
 * `/returns` — required reading before checkout under California Civil Code
 * §1723 (the refund policy must be shown before purchase) and part of what
 * Stripe asks a site to show before it can take payment. Renders straight
 * from the owner's `returnsPolicy` (`src/lib/orders.ts`'s `StoreSettings`,
 * set at `/admin/settings`); until that's set, this page says so honestly
 * rather than inventing a policy nobody has agreed to.
 */
export default async function ReturnsPage() {
  const settings = await getPublicStoreSettings();
  const policy = settings.returnsPolicy?.trim();
  const contactEmail = settings.supportEmail || brand.email;

  return (
    <div className="cne-lg">
      <JsonLdScript data={breadcrumbLd([{ name: "Returns", path: "/returns/" }])} />
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${brand.siteUrl}/returns/#page`,
          url: `${brand.siteUrl}/returns/`,
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
        <h1>Returns Policy</h1>
        {policy && (
          <p className="cne-lg-date">
            Last updated{" "}
            <time dateTime={settings.updatedAt.toISOString()}>
              {dateFormatter.format(settings.updatedAt)}
            </time>
          </p>
        )}
      </header>

      {policy ? (
        <section className="cne-lg-sec" aria-label="Returns policy">
          {paragraphsOf(policy).map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </section>
      ) : (
        <section className="cne-lg-sec">
          <p>
            The returns policy hasn&rsquo;t been published yet. Until it is published, checkout
            stays closed. Questions: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </section>
      )}

      <section className="cne-lg-sec" aria-labelledby="rt-contact">
        <h2 id="rt-contact">Contact</h2>
        <p className="cne-lg-contact">
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </p>
      </section>
    </div>
  );
}
