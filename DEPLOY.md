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

| Path | Header | Why |
|---|---|---|
| `/_next/static/*` | `public, max-age=31536000, immutable` | Filenames contain a content hash. A new build produces new names, so these can never go stale. |
| `/*.webp`, `/*.jpg`, `/*.png`, `/*.svg` | `public, max-age=604800` | Photography and the generated map base change rarely, but the filenames are not hashed, so not forever. |
| `*.html`, `/`, `/sitemap.xml`, `/robots.txt` | `public, max-age=0, must-revalidate` | The menu and its prices live here. A stale price is a support call. |

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
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

Add both domains in the project's Domains panel and set `www` as primary —
Vercel then issues the apex redirect itself, and the `redirects` block above
becomes belt-and-braces.

## Netlify / Cloudflare Pages

`public/_redirects` (copied into `out/` by the build):

```
https://chrisneddys.com/*  https://www.chrisneddys.com/:splat  301!
```

`public/_headers`:

```
/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
/*.html
  Cache-Control: public, max-age=0, must-revalidate
```

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

### Viewer-request function

Every URL has exactly one correct spelling — `https://www.chrisneddys.com/menu/`
— and this function is what enforces it. Four rules, in this order:

1. Apex → www, **301**, path and query preserved.
2. `/menu` → **301** `/menu/`. Not a silent rewrite to `/menu/index.html`: a
   rewrite leaves both spellings answering 200 and duplicates all 19 pages.
3. `/menu/index.html` → **301** `/menu/`, for the same reason. `/index.html`
   → `/`.
4. Only then, `/menu/` → origin request for `/menu/index.html`.

The path is normalised *before* the host is checked, so a request for
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
        "cache-control": { value: "public, max-age=3600" }
      }
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
have to be mapped. In the distribution's *Error pages* tab, add two:

| HTTP error code | Response page path | HTTP response code | Error caching TTL |
|---|---|---|---|
| 403 | `/404.html` | **404** | 60 |
| 404 | `/404.html` | **404** | 60 |

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
- [ ] Verify **both** hosts in Search Console, submit
      `https://www.chrisneddys.com/sitemap.xml`.
- [ ] Google Rich Results Test against `/`, `/menu/`, `/order/` and
      `/locations/hollywood/` — expect Restaurant, Menu, FAQ and Breadcrumb.
- [ ] Google Business Profile: primary category *Hamburger restaurant*, exact
      late-night hours, menu URL `/menu/`, order URL the Otter storefront,
      20–30 photos. **Do not** create listings for Glendale or Van Nuys until
      they open — a premature listing is hard to undo.
- [ ] Once GBP is right, sweep Yelp, Grubhub, Tripadvisor and Apple Maps to the
      same hours. Several currently understate the closing time by an hour or two.
