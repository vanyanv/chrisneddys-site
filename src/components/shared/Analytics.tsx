import Script from "next/script";

/**
 * Google Analytics 4.
 *
 * The measurement ID comes from `NEXT_PUBLIC_GA_ID` (set it in the Vercel
 * project's environment variables — it looks like `G-XXXXXXXXXX`). With no ID
 * set this renders nothing, so local builds and previews stay out of the
 * property's data.
 *
 * `afterInteractive` keeps the tag off the critical path: analytics should
 * never be what delays a menu appearing.
 *
 * This sits alongside Plausible rather than replacing it — Plausible already
 * tracks outbound clicks, which is how "did someone actually go through to
 * Otter" gets measured.
 */
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`}
      </Script>
    </>
  );
}
