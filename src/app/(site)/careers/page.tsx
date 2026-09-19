import type { Metadata } from "next";
import "@/styles/legal.css";
import { brand } from "@/data/brand";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { breadcrumbLd, pageMetadata, ID } from "@/lib/seo";

const title = "Careers";
const description =
  "Chris N Eddy's is hiring across Hollywood, Glendale and Van Nuys. See open roles and apply on Indeed.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/careers/" });

const INDEED_URL = "https://www.indeed.com/cmp/Chris-N-Eddy's";

/**
 * No job data lives in this codebase — Indeed is the system of record for
 * postings, so this page is a pitch and a link, not a listings page. That is
 * also why there is no JobPosting structured data here: that schema promises
 * per-role fields (title, date, employment type) this page does not have and
 * would have no way to keep in sync with what Indeed actually shows.
 */
export default function CareersPage() {
  return (
    <div className="cne-lg">
      <JsonLdScript data={breadcrumbLd([{ name: "Careers", path: "/careers/" }])} />
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${brand.siteUrl}/careers/#page`,
          url: `${brand.siteUrl}/careers/`,
          name: `${title} — ${brand.name}`,
          description,
          inLanguage: "en-US",
          isPartOf: { "@id": ID.website },
          about: { "@id": ID.org },
        }}
      />

      <header className="cne-lg-head">
        <p className="cne-lg-eyebrow">Careers</p>
        <h1>Work the counter.</h1>
      </header>

      <section className="cne-lg-sec">
        <p>
          We&rsquo;re a Hollywood smash-burger spot opening two more counters, in Glendale and Van
          Nuys &mdash; that means more shifts, more kitchens and more people needed to run them.
        </p>
        <p>
          Open roles, pay and how to apply all live on our Indeed page, kept current there rather
          than copied here where it could go stale.
        </p>
      </section>

      <div className="cne-lg-tldr">
        <h2>Open roles</h2>
        <p style={{ marginBottom: 16 }}>
          See what&rsquo;s hiring right now and apply directly through Indeed.
        </p>
        <a className="cne-mini is-red" href={INDEED_URL} target="_blank" rel="noopener noreferrer">
          SEE OPEN ROLES ON INDEED →
        </a>
      </div>

      <section className="cne-lg-sec" aria-labelledby="cr-contact">
        <h2 id="cr-contact">Questions</h2>
        <p>
          Nothing open that fits, or a question before you apply? Reach us through our{" "}
          <a href="/contact/">contact page</a>.
        </p>
      </section>
    </div>
  );
}
