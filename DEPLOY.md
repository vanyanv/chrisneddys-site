# Deploying chrisneddys.com

The site is a Next.js static export (`output: "export"`), so `pnpm build` writes a
plain directory of files to `out/` and there is no server at runtime. Everything
below is therefore host configuration, not application code — a static export
cannot redirect, set a header, or canonicalise a hostname on its own.

Two of these are SEO-critical and have to be right on day one, because both are
expensive to correct later:

1. **One canonical host.** If both `chrisneddys.com` and `www.chrisneddys.com`
   answer with 200, the entire site exists twice. Link equity splits across the
   pair, and so does analytics. The canonical tags in the HTML all point at
   `https://www.chrisneddys.com`, so **www is the canonical host** — the apex
   must 301 to it, not the other way round.
2. **Correct cache headers.** Everything under `/_next/static/` is
   content-hashed and safe to cache forever. HTML must not be, or a price change
   takes a week to reach anyone.

---

## Cache policy

| Path                                         | Header                                | Why                                                                                                     |
| -------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/_next/static/*`                            | `public, max-age=31536000, immutable` | Filenames contain a content hash. A new build produces new names, so these can never go stale.          |
| `/*.webp`, `/*.jpg`, `/*.png`, `/*.svg`      | `public, max-age=604800`              | Photography and the generated map base change rarely, but the filenames are not hashed, so not forever. |
| `*.html`, `/`, `/sitemap.xml`, `/robots.txt` | `public, max-age=0, must-revalidate`  | The menu and its prices live here. A stale price is a support call.                                     |

---

## Security headers

A static export cannot set a header on itself, so every one of these is host
configuration — and none of them exists until someone adds it. The set below is
the whole policy; the three host sections that follow each say where to paste it.

| Header                      | Value                                                                              | Why                                                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload`                                     | The apex 301 is a redirect a network can strip. This is what makes the _second_ visit unstrippable.                                                                                      |
| `X-Content-Type-Options`    | `nosniff`                                                                          | `out/` is served straight from a bucket. Without this a file whose `Content-Type` S3 guessed wrong can be re-guessed by the browser into something executable.                           |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                                  | Every order button leaves for Otter with the full path in the referrer otherwise. The UTM tags already say where the click came from; the path does not need repeating to a third party. |
| `X-Frame-Options`           | `DENY`                                                                             | Redundant with `frame-ancestors` below, kept for the browsers that never learned the CSP directive.                                                                                      |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()` | The site asks for none of these. Saying so means a script that someday does gets denied rather than prompting.                                                                           |
| `Content-Security-Policy`   | see below                                                                          | The origin allow-list.                                                                                                                                                                   |

### The CSP, and the one concession in it

```
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://plausible.io;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com;
font-src 'self';
connect-src 'self' https://api.web3forms.com https://plausible.io https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com;
upgrade-insecure-requests
```

Written as one line, no newlines, in whichever config the host reads.

Every origin in it was read off a built `out/`, not assumed:

- **`script-src`** — `googletagmanager.com` is gtag.js, appended by the snippet in
  `Analytics.tsx`; `plausible.io` is the outbound-links script in `layout.tsx`.
- **`connect-src`** — `api.web3forms.com` is where both forms POST. The
  `google-analytics.com` wildcards cover GA4's regional collection endpoints
  (`region1.`, `region2.`, …), which are not optional and are not on the bare
  hostname. `plausible.io` also takes the event beacons, not just the script.
- **`font-src 'self'`** — `next/font` downloads Google's fonts at build time and
  serves them from `/_next/static/media/`. There are 14 `.woff2` files in `out/`
  and no request to `fonts.gstatic.com`, so the font origins are deliberately
  absent. If a face is ever loaded by URL instead, this line is what breaks.
- **`img-src data:`** — the inlined SVG markers.

`script-src` carries **`'unsafe-inline'`**, which is worth being honest about: it
is the directive that would otherwise stop an injected `<script>`, and with it
the CSP's script rule is an origin allow-list rather than an XSS defence. The
alternatives were both checked and neither survives this architecture. A nonce
has to be minted per response, and there is no server to mint one. Hashes are
possible in principle, but `out/index.html` carries **31 inline `<script>`
blocks**, 25 of them Next's own RSC payload (`self.__next_f.push(...)`), whose
contents differ per page and change on every build — so the hash list would have
to be regenerated and re-pasted into host config on each deploy, and would fail
closed, sitewide, the first time someone forgot.

What the directive still buys, and the reason to ship it: an injected script
cannot _load_ from an origin that is not listed, `connect-src` means exfiltration
has nowhere to POST to, `object-src 'none'` and `base-uri 'self'` close two
injection routes outright, and `frame-ancestors 'none'` makes the site
un-iframeable. The real mitigation for inline XSS on this site is upstream and
already holds — see the audit note in `JsonLd.tsx`: nothing user-supplied reaches
an HTML sink, because there is no user-supplied anything. The site renders only
data committed to this repo.

### Roll it out in report-only first

A CSP mistake does not degrade, it blanks the page — and on a static site the
blank is cached. So ship it once as `Content-Security-Policy-Report-Only` with
the same value, walk the site (home, menu, an item sheet, contact, the shop bag,
locations), and confirm the console logs nothing. Then rename the header and
invalidate. The other five headers can go straight in; none of them can break a
page that was not already broken.

### Verify

```sh
curl -sI https://www.chrisneddys.com/ | grep -iE \
  'strict-transport|content-security|x-content-type|referrer-policy|x-frame|permissions-policy'
```

All six should come back. They must be on the **HTML** responses, not only on
`/_next/static/*` — a policy attached to one cache behaviour does not apply to
the other.

---

## Vercel

Static export is auto-detected; the redirect and headers go in `vercel.json`:

```json
{
  "redirects": [
    {
      "source": "/(.*)",
      "has": [{ "type": "host", "value": "chrisneddys.com" }],
      "destination": "https://www.chrisneddys.com/$1",
      "permanent": true
    }
  ],
  "headers": [
    {
      "source": "/_next/static/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains; preload"
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Frame-Options", "value": "DENY" },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://plausible.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com; font-src 'self'; connect-src 'self' https://api.web3forms.com https://plausible.io https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com; upgrade-insecure-requests"
        }
      ]
    }
  ]
}
```

The `/(.*)` block is second on purpose: Vercel applies every matching block, so
the static-asset rule above still adds its own `Cache-Control` on top.

Add both domains in the project's Domains panel and set `www` as primary —
Vercel then issues the apex redirect itself, and the `redirects` block above
becomes belt-and-braces.

## Netlify / Cloudflare Pages

`public/_redirects` and `public/_headers` are **in the repo** and are copied into
`out/` by the build, so this path needs no config written by hand — check that
both came through (`ls out/_headers out/_redirects`) and that the host is
actually reading them. Neither file does anything on S3 + CloudFront; they are
inert there, which is why they can live in `public/` unconditionally.

Both are commented at the top. `_headers` carries the cache rules from the table
above _and_ the six security headers, because on this host the two are set in the
same place.

## S3 + CloudFront

This is what the previous site ran on, so it is the likely path.

- Serve `out/` from a **private** bucket behind an Origin Access Control, with
  S3 **static-website hosting turned off**. It matters: the bucket serving
  `chrisneddys.com` today has website hosting on with redirect rules, and those
  rules answer `https://chrisneddys.com/contact` with a `302` to
  `/chrisneddys/deployment_20260312131414/contact/` — a dead URL that also
  publishes the deployment key prefix to anyone with `curl`. Delete the routing
  rules and switch the origin to the REST endpoint (`…s3.us-east-1.amazonaws.com`,
  not `…s3-website-…`) so CloudFront, and only CloudFront, decides what a URL
  means.
- Both `chrisneddys.com` and `www.chrisneddys.com` must be alternate domain
  names on the distribution, with a certificate covering both, or the apex never
  reaches the function that redirects it.
- Set the two cache behaviours from the table above: one for `/_next/static/*`
  with a long TTL, the default behaviour short.
- **Invalidate `/*` on every deploy**, or the old HTML is served from cache.

### Response-headers policy

The six headers from **Security headers** above are attached here, not in the
viewer-request function — a CloudFront _function_ cannot add headers to a
response it did not generate, and the 301s it does generate are not the
responses that need them.

Create one **response headers policy** (CloudFront → Policies → Response
headers) and attach it to **both** cache behaviours, the default and
`/_next/static/*`. A policy attached to one does not apply to the other, and the
HTML is the half that matters.

Most of it is fill-in-the-blanks in the console's _Security headers_ panel:

| Console field             | Value                                                         |
| ------------------------- | ------------------------------------------------------------- |
| Strict-Transport-Security | `max-age=31536000`, include subdomains **on**, preload **on** |
| X-Content-Type-Options    | `nosniff` — tick "Override"                                   |
| Referrer-Policy           | `strict-origin-when-cross-origin`                             |
| X-Frame-Options           | `DENY`                                                        |
| Content-Security-Policy   | the one-line CSP from above                                   |

`Permissions-Policy` has no field in that panel — add it under **Custom
headers**, name `Permissions-Policy`, value
`camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()`.

Or, as CLI:

```sh
aws cloudfront create-response-headers-policy \
  --response-headers-policy-config file://response-headers-policy.json
```

Tick **Override** on each one. Without it CloudFront defers to whatever the
origin sent, and S3 sends some of these as empty strings rather than not at all.

One interaction worth knowing before you turn on HSTS `preload`: it is a
commitment, and `includeSubDomains` covers every subdomain including any that
only speaks HTTP today. Check there is no such host before submitting the domain
to the preload list — the header alone is safe and reversible, the list is
neither.

### Viewer-request function

Every URL has exactly one correct spelling — `https://www.chrisneddys.com/menu/`
— and this function is what enforces it. Four rules, in this order:

1. Apex → www, **301**, path and query preserved.
2. `/menu` → **301** `/menu/`. Not a silent rewrite to `/menu/index.html`: a
   rewrite leaves both spellings answering 200 and duplicates all 19 pages.
3. `/menu/index.html` → **301** `/menu/`, for the same reason. `/index.html`
   → `/`.
4. Only then, `/menu/` → origin request for `/menu/index.html`.

The path is normalised _before_ the host is checked, so a request for
`http://chrisneddys.com/menu` costs one redirect rather than two.

Attach it to the default cache behaviour on **viewer request**, runtime
`cloudfront-js-2.0`:

```js
function handler(event) {
  var req = event.request;
  var canonical = "www.chrisneddys.com";
  var host = req.headers.host ? req.headers.host.value.toLowerCase() : "";
  var uri = req.uri;

  // ACME HTTP-01 challenges (cert issuance/renewal) live under this path and
  // must reach the origin exactly as requested — untouched by the host or
  // trailing-slash rules below, which would 301 the validator instead of
  // answering it.
  if (uri.indexOf("/.well-known/") === 0) return req;

  // --- normalise the path ------------------------------------------------
  var target = uri;

  if (target.slice(-11) === "/index.html") {
    // /menu/index.html -> /menu/ ; /index.html -> /
    target = target.slice(0, -10);
  } else if (target.slice(-1) !== "/" && target.lastIndexOf(".") <= target.lastIndexOf("/")) {
    // extensionless, so it is a page, not a file: /menu -> /menu/
    target += "/";
  }

  // --- one canonical URL -------------------------------------------------
  if (host !== canonical || target !== uri) {
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: "https://" + canonical + target + querystring(req) },
        "cache-control": { value: "public, max-age=3600" },
      },
    };
  }

  // --- and only now, the rewrite ----------------------------------------
  if (target.slice(-1) === "/") req.uri = target + "index.html";

  return req;
}

/** Rebuilds ?a=1&b=2 from the request, so a redirect never drops UTM tags. */
function querystring(req) {
  var q = req.querystring;
  var parts = [];
  for (var key in q) {
    var v = q[key];
    if (v.multiValue) {
      for (var i = 0; i < v.multiValue.length; i++) {
        parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(v.multiValue[i].value));
      }
    } else if (v.value === "") {
      parts.push(encodeURIComponent(key));
    } else {
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(v.value));
    }
  }
  return parts.length ? "?" + parts.join("&") : "";
}
```

Anything that is not the canonical host lands in the same 301 — including the
`d111111abcdef8.cloudfront.net` domain, which otherwise gets indexed as a third
copy of the site.

### Custom error responses

A private bucket behind OAC answers a missing key with **403**, not 404, so both
have to be mapped. In the distribution's _Error pages_ tab, add two:

| HTTP error code | Response page path | HTTP response code | Error caching TTL |
| --------------- | ------------------ | ------------------ | ----------------- |
| 403             | `/404.html`        | **404**            | 60                |
| 404             | `/404.html`        | **404**            | 60                |

The response code has to be **404, not 200**. A 200 makes every typo a soft 404:
Google indexes the not-found page, reports "Submitted URL not found (soft 404)",
and the page itself is `noindex` — so it is neither found nor indexable, which is
the worst of both. `out/404.html` is emitted by the build; nothing else is needed.

### Verify

After the first deploy, before submitting anything to Search Console:

```sh
# apex -> www, path kept
curl -sI https://chrisneddys.com/menu/            | grep -iE '^(HTTP|location)'
#   HTTP/2 301 … location: https://www.chrisneddys.com/menu/

# extensionless -> trailing slash
curl -sI https://www.chrisneddys.com/menu         | grep -iE '^(HTTP|location)'
#   HTTP/2 301 … location: https://www.chrisneddys.com/menu/

# index.html -> directory
curl -sI https://www.chrisneddys.com/index.html   | grep -iE '^(HTTP|location)'
#   HTTP/2 301 … location: https://www.chrisneddys.com/

# a URL that does not exist is a 404, not a 200
curl -s -o /dev/null -w "%{http_code}\n" https://www.chrisneddys.com/does-not-exist/
#   404

# and the real page still answers directly
curl -s -o /dev/null -w "%{http_code}\n" https://www.chrisneddys.com/menu/
#   200
```

No `Location` header may contain `deployment_` anywhere in it. If one does, the
S3 website redirect rules are still live.

---

## Analytics before launch

The repo defaults to `G-9WECB13653` (`src/components/shared/Analytics.tsx`,
overridable with `NEXT_PUBLIC_GA_ID`). The Gatsby site on the domain today
reports through `GTM-WQF95WC` into a different measurement ID, `G-QBQRJG4LSQ`.

Before the first production build, open **GA4 Admin → Data streams** and settle
whether those two IDs are two streams of one property or two separate
properties. If they are separate, shipping the default starts a brand-new
history on launch day and orphans everything already in the old one — set
`NEXT_PUBLIC_GA_ID` to the existing ID instead. This is a one-way door: it
cannot be backfilled after the fact.

In the same property, GA4 Enhanced Measurement → "Page changes based on
browser history events" must stay **ON**. This site's `Analytics.tsx` never
calls `gtag('config', …)` again after the first load, so every client-side
route change is a `history.pushState` this setting is what turns into a
`page_view` — turn it off and every SPA navigation after the first stops
being counted.

---

## Launch checklist

Ordered so that nothing is measured after the fact.

- [ ] Confirm the Plausible property name matches `data-domain="chrisneddys.com"`
      exactly. If it is registered as `www.chrisneddys.com`, every pageview is
      discarded silently.
- [ ] Walk the site on a phone with `?ga_debug=1` and confirm the six events land
      in GA4 DebugView: `order_click`, `delivery_click`, `call_click`,
      `directions_click`, `menu_item_open`, `contact_submit`.
- [ ] In GA4, mark `order_click`, `delivery_click` and `call_click` as key events.
      In Plausible, create goals with the same names — custom events do not appear
      until a goal exists.
- [ ] `pnpm check:links`, and open the two bot-blocked delivery URLs by hand.
- [ ] Run the four `curl` checks in **S3 + CloudFront → Verify**: apex → www,
      `/menu` → `/menu/`, `/index.html` → `/`, and an unknown path → `404`.
- [ ] `curl -sI https://www.chrisneddys.com/_next/static/...` → expect
      `immutable`.
- [ ] Ship the CSP as `Content-Security-Policy-Report-Only` first, walk the site
      (home, menu, an item sheet, contact, the shop bag, locations) with the
      console open, and only then rename the header. See **Security headers**.
- [ ] Confirm all six security headers come back on an **HTML** response, not
      just on `/_next/static/*`:
      `curl -sI https://www.chrisneddys.com/ | grep -iE 'strict-transport|content-security|x-content-type|referrer-policy|x-frame|permissions-policy'`
- [ ] Read `/privacy/` against what the site actually does before it goes out —
      it is written from the code, so a new form, a new analytics tool or a
      payment processor in the shop each make it wrong. Confirm the two business
      claims in it hold: that we do not sell personal information, and that
      `chris@chrisneddys.com` is where data requests should land.
- [ ] Verify **both** hosts in Search Console, submit
      `https://www.chrisneddys.com/sitemap.xml`.
- [ ] Google Rich Results Test against `/`, `/menu/`, `/order/` and
      `/locations/hollywood/` — expect Restaurant, Menu, FAQ and Breadcrumb.
- [ ] Google Business Profile: primary category _Hamburger restaurant_, exact
      late-night hours, menu URL `/menu/`, order URL the Otter storefront,
      20–30 photos. **Do not** create listings for Glendale or Van Nuys until
      they open — a premature listing is hard to undo.
- [ ] Once GBP is right, sweep Yelp, Grubhub, Tripadvisor and Apple Maps to the
      same hours. Several currently understate the closing time by an hour or two.
