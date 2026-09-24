import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/legal.css";
import { brand } from "@/data/brand";
import { getPublicStoreSettings } from "@/lib/orders";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { breadcrumbLd, pageMetadata, ID } from "@/lib/seo";
import { PRIVACY_UPDATED } from "@/data/privacy";

const title = "Privacy Policy";
const description =
  "What Chris N Eddy’s collects when you browse, order or contact us, who it goes to, and how to get it deleted. No customer accounts. We don’t sell your data.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/privacy/" });

const UPDATED_HUMAN = "14 September 2026";

/** Re-checked at most once a minute, like the rest of the shop — the support
 * email in the Contact section comes from the same `store_settings` row
 * `/admin/settings` writes to. */
export const revalidate = 60;

/**
 * The privacy policy.
 *
 * Written against what the code actually does rather than from a template, so
 * every claim here is checkable in this repo:
 *
 * - The two contact forms are `GuestCheck.tsx` and `OpeningNotify.tsx`.
 * - Checkout is Stripe Checkout (`src/lib/stripe.ts`): card details are typed
 *   into Stripe's own hosted page and never reach this app — this server only
 *   ever sees back a payment-intent id (`markPaid` in `src/lib/orders.ts`).
 * - What an order stores is exactly `orders`/`order_items` in
 *   `src/db/schema.ts`: email, name, phone (nullable), `ship_to`, the items
 *   bought, and — for the Foam Trucker — the edition number assigned to it.
 * - The database is Neon Postgres, read and written through `src/db/client.ts`.
 * - The site is hosted on Vercel (`DEPLOY.md`).
 * - Owners (not customers) sign in at `/admin` — `src/lib/auth.ts`, on
 *   Better Auth (`src/lib/betterAuth.ts`) — which sets the one first-party
 *   session cookie this site issues. There is no customer account or
 *   password.
 * - The analytics are `Analytics.tsx` (GA4) and Vercel Web Analytics (page
 *   views only, in `(site)/layout.tsx`) and nothing else; the GA4 event list
 *   is the `TrackEvent` union in `lib/track.ts`.
 * - Before checkout, the only thing written to the browser is `cne.bag.v1`
 *   (`src/components/shop/bagStore.ts`), in `localStorage`.
 *
 * If any of those change, this page is part of the change.
 */
export default async function PrivacyPage() {
  const settings = await getPublicStoreSettings();
  const contactEmail = settings.supportEmail || brand.email;

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
            Placing an order gives us your name, email, shipping address and what you bought; your
            card details go straight to Stripe and never reach our servers. Two contact forms send
            us what you type into them. One analytics tool counts pages and taps. A hat in the shop
            bag stays in your own browser until you check out. There is no customer account, and we
            don&rsquo;t sell any of it.
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
            Both are turned into an email by this site and sent to us through{" "}
            <strong>Resend</strong>, the service that also sends our order emails. It is a
            pass-through: the message lands in our inbox at{" "}
            <a href={`mailto:${brand.email}`}>{brand.email}</a>, and we answer it from there. We
            keep that correspondence for as long as it is useful to have answered you, and you can
            ask us to delete it at any time.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-order">
          <h2 id="p-order">What placing an order collects</h2>
          <p>
            When you buy something from the{" "}
            <Link prefetch={false} href="/shop/">
              shop
            </Link>
            , Stripe Checkout collects your <strong>name</strong>, <strong>email address</strong>,
            your <strong>shipping address</strong> if you have it shipped, and a{" "}
            <strong>phone number</strong> — Stripe requires it to check out, and we only use it for
            questions about your order. It hands that back to us along with{" "}
            <strong>what you bought</strong> and, for a numbered item like the Foam Trucker,{" "}
            <strong>which edition number</strong> your order was assigned.
          </p>
          <p>
            Your <strong>card details never reach us</strong>. You type them into Stripe&rsquo;s own
            checkout page, not ours, and our server only ever gets back a payment confirmation —
            never a card number.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-share">
          <h2 id="p-share">Who order information goes to</h2>
          <p>Placing an order shares what it takes to fill it with:</p>
          <ul>
            <li>
              <strong>Stripe</strong> — to take payment and, where it applies, to calculate tax.
            </li>
            <li>
              <strong>The shipping carrier</strong> — your name and address, to deliver an order you
              have shipped. Nothing is shared with a carrier for a pickup order.
            </li>
            <li>
              <strong>Vercel</strong> — hosts this site and the server that talks to Stripe.
            </li>
            <li>
              <strong>Neon</strong> — the Postgres database your order is stored in.
            </li>
            <li>
              <strong>Resend</strong> — sends the order-confirmation and order-status emails, and
              delivers the two forms above to our inbox.
            </li>
          </ul>
          <p>
            Each of those only sees what it needs to do its one job. None of them are ours to speak
            for beyond that — see their own privacy policies for how they handle it on their end.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-retain">
          <h2 id="p-retain">How long we keep order records</h2>
          <p>
            We keep an order&rsquo;s record for as long as we need it — to fulfil it, to handle a
            return, and because tax law requires a business to keep sales records. We don&rsquo;t
            hold onto it longer than that on purpose.
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
              <strong>Vercel Web Analytics</strong>, from the company that hosts this site, which
              sets no cookies and counts page views, the country you are in, and the kind of device
              and browser you used.
            </li>
          </ul>
          <p>
            Alongside page views, Google Analytics receives a named event when you do one of a fixed
            set of things: tap an order, delivery, phone or directions link; open an item on the
            menu; view a product, add one to the bag, or open the bag; send the contact form; or
            join an opening list. An event carries what was tapped and which part of the page it was
            tapped from.
          </p>
          <p className="cne-lg-note">
            An analytics event never carries your name, email address, phone number, message or
            anything from an order. When a form fails, the event says only <em>why</em> — a fixed
            word like <code>network</code> or <code>rejected</code> — and never what you had typed.
            This is deliberate and it is enforced in the code, not by policy.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-browser">
          <h2 id="p-browser">What stays in your browser</h2>
          <p>
            Before you check out, whatever is in the shop bag — the item and the quantity — lives
            only in your own browser&rsquo;s local storage, so the bag survives a reload. It is
            never sent to us or to anyone else while you&rsquo;re still building it. Clearing your
            site data empties it. Once you start checkout, the items you&rsquo;re buying leave the
            browser and become the order information described above.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-cookies">
          <h2 id="p-cookies">Cookies</h2>
          <p>
            This site sets one cookie of its own: a sign-in cookie for the small team that runs the
            store, set only when one of us signs in at /admin to manage products and orders.
            Customers never get this cookie — there is no customer account to sign into, and
            checking out doesn&rsquo;t set one either. Beyond that, the only cookies here are Google
            Analytics&rsquo;. We set no advertising cookie, and nothing here follows you to other
            sites. Blocking cookies, or blocking analytics outright, costs a customer nothing on
            this site — every page, the menu, both forms and checkout work exactly the same.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-leaving">
          <h2 id="p-leaving">When you leave this site</h2>
          <p>
            Food ordering, delivery and our social links hand you to companies that are not us, each
            with its own privacy policy and none of which we control: <strong>Otter</strong> for
            pickup orders, <strong>DoorDash</strong>, <strong>Uber Eats</strong> and{" "}
            <strong>Grubhub</strong> for delivery, <strong>ezCater</strong> for catering, and{" "}
            <strong>Instagram</strong>, <strong>Yelp</strong> and <strong>Tripadvisor</strong>{" "}
            elsewhere. Anything you type once you are there — an address, a card number, a tip — you
            are giving to them, not to us. We never see it. Checking out through the{" "}
            <Link prefetch={false} href="/shop/">
              shop
            </Link>{" "}
            is different: that payment page is Stripe&rsquo;s, described above, and it is the one
            place off this site we do ask you to visit to complete a purchase.
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
            <li>
              Customers don&rsquo;t have accounts — checking out never asks you to create one. The
              only sign-in on this site is for the owners who run the store.
            </li>
            <li>We never see or store your card number — Stripe takes payment directly.</li>
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
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a> and we will handle it — including
            a request about an order&rsquo;s information, not just a form submission. We will not
            ask you to create an account to make a request; checking out doesn&rsquo;t create one
            either.
          </p>
          <p>
            In practice the personal information we hold is whatever you sent us through one of the
            two forms, or through an order you placed, so &ldquo;delete my data&rdquo; means
            deleting that — subject to what tax and accounting law requires us to keep a record of
            for a completed sale.
          </p>
        </section>

        <section className="cne-lg-sec" aria-labelledby="p-kids">
          <h2 id="p-kids">Children</h2>
          <p>
            This is a restaurant website, not a service for children, and we do not knowingly
            collect personal information from anyone under 13. If you believe a child has sent us
            something through a form or placed an order, email us and we will delete it.
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
            Questions about any of this, a request about your own data, or a question about an order
            go to the same place:
          </p>
          <p className="cne-lg-contact">
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            <br />
            <a href={`tel:${brand.phoneTel}`}>{brand.phone}</a>
          </p>
        </section>
      </div>
    </>
  );
}
