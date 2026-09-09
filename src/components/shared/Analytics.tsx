import Script from "next/script";

/**
 * Google Analytics 4.
 *
 * The measurement ID is the site's own, so it lives here rather than in an
 * environment variable — this is a static export, so an unset variable at
 * build time means the tag silently never ships, which is a bad failure mode
 * for the one thing you can't backfill. `NEXT_PUBLIC_GA_ID` still overrides it
 * if a deployment ever needs to report to a different property.
 *
 * `afterInteractive` keeps the tag off the critical path: analytics should
 * never be what delays a menu appearing.
 *
 * This sits alongside Plausible rather than replacing it — Plausible already
 * tracks outbound clicks, which is how "did someone actually go through to
 * Otter" gets measured.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-9WECB13653";

const GA_INIT = `(function(){
var h=location.hostname;
if(h!=='chrisneddys.com'&&!h.endsWith('.chrisneddys.com')){return}
window.dataLayer=window.dataLayer||[];
function gtag(){window.dataLayer.push(arguments)}
window.gtag=gtag;
gtag('js',new Date());
gtag('config','${GA_ID}');
var s=document.createElement('script');
s.async=true;
s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
document.head.appendChild(s);
})()`;

export function Analytics() {
  if (!GA_ID) return null;

  // gtag.js is appended by the snippet rather than loaded as its own <Script>
  // so that the hostname check gates the 100 KB download too — otherwise every
  // preview deploy and local build pays for a tag that will never report.
  return (
    <Script id="ga4-init" strategy="afterInteractive">
      {GA_INIT}
    </Script>
  );
}
