/**
 * Google Analytics 4.
 *
 * The measurement ID is the site's own, so it lives here rather than in an
 * environment variable — this is a static export, so an unset variable at
 * build time means the tag silently never ships, which is a bad failure mode
 * for the one thing you can't backfill. `NEXT_PUBLIC_GA_ID` still overrides it
 * if a deployment ever needs to report to a different property.
 *
 * The gate and `gtag('js')`/`gtag('config')` are emitted as a plain inline
 * `<script>` rather than through `next/script`. On a static export an
 * `afterInteractive` script with inline children is not in the exported HTML at
 * all — it is carried in the RSC payload and only runs once React has hydrated,
 * which on a throttled phone is seconds after first paint. "Check the hours and
 * leave" is a real visit and it was going uncounted. This snippet is in the
 * HTML and runs while the document is still parsing.
 *
 * What is *not* on the critical path is gtag.js itself: the snippet appends it
 * `async`, and only after the gate has passed, so localhost and preview deploys
 * pay nothing — neither a hit nor the 100 KB download.
 *
 * The hostname gate keeps localhost and preview deploys out of the property.
 * `?ga_debug=1` no longer opens that gate: it only adds `debug_mode` on a host
 * that was already going to report, so a DebugView walk can be done on the real
 * site without the flag becoming a way to send hits from anywhere — or, worse,
 * a way to have production traffic filtered out as developer traffic.
 *
 * This sits alongside Plausible rather than replacing it — Plausible already
 * tracks outbound clicks, which is how "did someone actually go through to
 * Otter" gets measured.
 */
import { shouldTrack } from "@/lib/analytics";

// Sanitised before it ever reaches the template literal below: GA_ID is
// interpolated straight into an inline `<script>` with no escaping, so an
// override that somehow carried `</script>` or a stray quote would be a
// self-inflicted injection. A real measurement ID is only ever letters,
// digits and hyphens, so anything else is simply dropped.
const GA_ID = (process.env.NEXT_PUBLIC_GA_ID || "G-9WECB13653").replace(/[^A-Za-z0-9-]/g, "");

// `shouldTrack` (see src/lib/analytics.ts) is serialised into the inline
// snippet below by `toString()`, so there is exactly one copy of the gating
// rule and no way for the tested version and the shipped one to drift.
const GA_INIT = `(function(){
var gate=${shouldTrack.toString()};
if(!gate(location.hostname,location.search)){return}
var dbg=location.search.indexOf('ga_debug=1')>-1;
window.dataLayer=window.dataLayer||[];
function gtag(){window.dataLayer.push(arguments)}
window.gtag=gtag;
gtag('js',new Date());
gtag('config','${GA_ID}',dbg?{debug_mode:true}:{});
var s=document.createElement('script');
s.async=true;
s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
document.head.appendChild(s);
})()`;

export function Analytics() {
  if (!GA_ID) return null;

  return (
    <script
      id="ga4-init"
      dangerouslySetInnerHTML={{ __html: GA_INIT }}
    />
  );
}
