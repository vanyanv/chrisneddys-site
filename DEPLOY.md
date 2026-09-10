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
| `/*.webp`, `/*.jpg`, `/*.png` | `public, max-age=604800` | Photography changes rarely, but the filenames are not hashed, so not forever. |
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

- Serve `out/` from a private bucket behind an Origin Access Control.
- The build uses `trailingSlash: true`, so every route is a real
  `index.html` on disk. Attach a CloudFront Function on **viewer request** to
  append `index.html` to directory paths, and to handle the apex redirect:

```js
function handler(event) {
  var req = event.request;
  var host = req.headers.host.value;

  if (host === "chrisneddys.com") {
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: "https://www.chrisneddys.com" + req.uri },
      },
    };
  }

  // /menu/ -> /menu/index.html
  if (req.uri.endsWith("/")) req.uri += "index.html";
  else if (!req.uri.includes(".")) req.uri += "/index.html";

  return req;
}
```

- Set the two cache behaviours from the table above: one for `/_next/static/*`
  with a long TTL, the default behaviour short.
- Both `chrisneddys.com` and `www.chrisneddys.com` must be alternate domain
  names on the distribution, with a certificate covering both, or the apex
  never reaches the function that redirects it.
- **Invalidate `/*` on every deploy**, or the old HTML is served from cache.

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
- [ ] Apex 301 live and verified with
      `curl -sI https://chrisneddys.com/menu/` → expect `301` to the www URL.
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
