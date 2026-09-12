import type { Metadata } from "next";
import { brand } from "@/data/brand";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { breadcrumbLd, openGraphFor, twitterFor, ID } from "@/lib/seo";

const title = "Privacy Policy";
const description =
  "What Chris N Eddy’s collects when you use this site, who it goes to, and how to get it deleted. No accounts, no payments, no data sold.";

/**
 * Bumped by hand when the policy text changes, and only then. It is printed on
 * the page and is the `lastmod` this URL reports in the sitemap, so the two
 * cannot disagree about when the terms someone agreed to last moved.
 */
export const PRIVACY_UPDATED = "2026-09-12";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy/" },
  openGraph: openGraphFor({ title: `${title} · ${brand.name}`, description, path: "/privacy/" }),
  twitter: twitterFor({ title: `${title} · ${brand.name}`, description }),
};

const UPDATED_HUMAN = "12 September 2026";

/**
 * The privacy policy.
 *
 * Written against what the code actually does rather than from a template, so
 * every claim here is checkable in this repo: the two forms are
 * `GuestCheck.tsx` and `OpeningNotify.tsx`, the analytics are `Analytics.tsx`
 * (GA4) and the Plausible tag in `layout.tsx`, the event list is the
 * `TrackEvent` union in `lib/track.ts`, and the only thing written to the
 * browser is `cne.bag.v1` in `shop/bagStore.ts`.
 *
 * If any of those change, this page is part of the change.
 */
export default function PrivacyPage() {
  const policyLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${brand.siteUrl}/privacy/#page`,
    url: `${brand.siteUrl}/privacy/`,
    name: `${title} — ${brand.name}`,
    description,
    inLanguage: "en-US",
    isPartOf: { "@id": ID.website },
    about: { "@id": ID.org },
    dateModified: PRIVACY_UPDATED,
  };

  return (
    <>
      <JsonLdScript data={breadcrumbLd([{ name: "Privacy", path: "/privacy/" }])} />
      <JsonLdScript data={policyLd} />

      <div className="cne-lg">
        <header className="cne-lg-head">
          <p className="cne-lg-eyebrow">Legal</p>
          <h1>Privacy Policy</h1>
          <p className="cne-lg-date">
            Last updated <time dateTime={PRIVACY_UPDATED}>{UPDATED_HUMAN}</time>
          </p>
        </header>

        <div className="cne-lg-tldr">
          <h2>The short version</h2>
          <p>
            This site has no accounts, takes no payments and sells nothing about you. Two forms
            collect what you type into them and email it to us. Two analytics tools count pages and
            taps. A hat you put in the bag stays in your own browser. That is the whole list.
          </p>
        </div>

        <section className="cne-lg-sec" aria-labelledby="p-send">
          <h2 id="p-send">What you send us on purpose</h2>
          <p>Two forms on this site send us anything, and both only when you submit them.</p>
          <p>
            The <a href="/contact/">contact form</a> collects your <strong>name</strong>,{" "}
            <strong>email address</strong>, a{" "}
            <strong>phone number if you choose to give one</strong>, the <strong>topic</strong> you
            picked, and your <strong>message</strong>. The opening list on a location page that has
            not opened yet collects your <strong>email address</strong> and{" "}
            <strong>which neighbourhood</strong> you asked about.
          </p>
          <p>
            Both are delivered by <strong>Web3Forms</strong>, a form-relay service that turns the
            submission into an email and sends it to us. It is a pass-through: the message lands in
            our inbox at <a href={`mailto:${brand.email}`}>{brand.email}</a>, and we answer it from
            there. We keep that correspondence for as long as it is useful to have answered you, and
            you can ask us to delete it at any time.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-auto">
          <h2 id="p-auto">What gets measured automatically</h2>
          <p>
            We use two analytics tools to understand which pages people read and which buttons they
            press — how many, not who.
          </p>
          <ul>
            <li>
              <strong>Google Analytics 4</strong>, which sets cookies and records the pages you
              visit, roughly where in the world you are, and the kind of device and browser you
              used.
            </li>
            <li>
              <strong>Plausible Analytics</strong>, which is cookieless and does not build a profile
              across sites.
            </li>
          </ul>
          <p>
            Alongside page views, both receive a named event when you do one of a fixed set of
            things: tap an order, delivery, phone or directions link; open an item on the menu; view
            a product, add one to the bag, or open the bag; send the contact form; or join an
            opening list. An event carries what was tapped and which part of the page it was tapped
            from.
          </p>
          <p className="cne-lg-note">
            An analytics event never carries your name, email address, phone number or message. When
            a form fails, the event says only <em>why</em> — a fixed word like <code>network</code>{" "}
            or <code>rejected</code> — and never what you had typed. This is deliberate and it is
            enforced in the code, not by policy.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-browser">
          <h2 id="p-browser">What stays in your browser</h2>
          <p>
            If you put something in the shop bag, the item and the quantity are saved in your own
            browser&rsquo;s local storage so the bag survives a reload. It is never sent to us or to
            anyone else — there is nowhere for it to go, because the shop cannot take payment yet.
            Clearing your site data empties it.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-cookies">
          <h2 id="p-cookies">Cookies</h2>
          <p>
            The only cookies this site sets are Google Analytics&rsquo;. We set none of our own,
            there is no advertising cookie, and nothing here follows you to other sites. Blocking
            cookies, or blocking analytics outright, costs you nothing on this site — every page,
            the menu and both forms work exactly the same.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-leaving">
          <h2 id="p-leaving">When you leave this site</h2>
          <p>
            Ordering, delivery and our social links hand you to companies that are not us, each with
            its own privacy policy and none of which we control: <strong>Otter</strong> for pickup
            orders, <strong>DoorDash</strong>, <strong>Uber Eats</strong> and{" "}
            <strong>Grubhub</strong> for delivery, <strong>ezCater</strong> for catering, and{" "}
            <strong>Instagram</strong>, <strong>Yelp</strong> and <strong>Tripadvisor</strong>{" "}
            elsewhere. Anything you type once you are there — an address, a card number, a tip — you
            are giving to them, not to us. We never see it.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-never">
          <h2 id="p-never">What we do not do</h2>
          <ul>
            <li>
              We do not sell or rent your personal information, and we do not share it for
              cross-context behavioural advertising.
            </li>
            <li>We do not run ads on this site or build an advertising profile of you.</li>
            <li>There are no accounts, so there is no password of yours to lose.</li>
            <li>This site takes no payments, so we never hold a card number.</li>
          </ul>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-rights">
          <h2 id="p-rights">Your choices</h2>
          <p>
            You can opt out of Google Analytics everywhere with{" "}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google&rsquo;s browser add-on
            </a>
            , or block both tools with any content blocker. Clearing your site data removes the
            analytics cookies and empties the shop bag.
          </p>
          <p>
            If you are a California resident, the CCPA gives you the right to know what personal
            information we have collected about you, to have it deleted, to have it corrected, and
            not to be treated differently for asking. Write to{" "}
            <a href={`mailto:${brand.email}`}>{brand.email}</a> and we will handle it. We will not
            ask you to create an account to make a request — there are no accounts.
          </p>
          <p>
            In practice the personal information we hold is whatever you sent us through one of the
            two forms, so &ldquo;delete my data&rdquo; means deleting that correspondence, and we
            can do it on request.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-kids">
          <h2 id="p-kids">Children</h2>
          <p>
            This is a restaurant website, not a service for children, and we do not knowingly
            collect personal information from anyone under 13. If you believe a child has sent us
            something through a form, email us and we will delete it.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-changes">
          <h2 id="p-changes">Changes</h2>
          <p>
            If this policy changes, the date at the top of the page changes with it. There is no
            mailing list to be notified through, because we do not keep one.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-contact">
          <h2 id="p-contact">Contact</h2>
          <p>
            Questions about any of this, or a request about your own data, go to the same place
            everything else does:
          </p>
          <p className="cne-lg-contact">
            <a href={`mailto:${brand.email}`}>{brand.email}</a>
            <br />
            <a href={`tel:${brand.phoneTel}`}>{brand.phone}</a>
          </p>
        </section>
      </div>
    </>
  );
}
