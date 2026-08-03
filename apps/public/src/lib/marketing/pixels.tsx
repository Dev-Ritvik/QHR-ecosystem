'use client';

// apps/public/src/lib/marketing/pixels.tsx
//
// Meta, Google and LinkedIn, loaded ONLY under Marketing consent.
//
// Three properties, each of which is a requirement rather than a preference:
//
//   Nothing loads before consent. Not the script tag, not a no-op stub — the
//   network request itself does not happen. Loading a pixel and then telling it
//   not to track still hands the vendor an IP address and a referrer.
//
//   Missing IDs are a complete no-op. The client is supplying account IDs after
//   the site reaches production, so this ships as a working shell today and
//   turns on with env vars alone, no code change.
//
//   Withdrawal removes the cookies the vendors set. A tag that stops firing but
//   leaves _fbp behind has not honoured anything.
//
// Meta and Google both prohibit receiving data gathered without valid consent,
// so this gate is what protects the ad accounts, not just the visitor.

import Script from 'next/script';
import { useEffect, useRef } from 'react';
import { useConsent } from '@/lib/consent/ConsentProvider';

const META_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
const LINKEDIN_ID = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID;

/** Cookies each vendor sets, cleared on withdrawal. */
const VENDOR_COOKIES = [
  '_fbp', '_fbc',                    // Meta
  '_ga', '_gid', '_gcl_au',          // Google
  'li_sugr', 'bcookie', 'bscookie', 'lidc', // LinkedIn
];

type Params = Record<string, string | number | boolean>;

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    lintrk?: (...args: unknown[]) => void;
  }
}

/** Events raised before the tags finish loading are held here rather than
 *  dropped — the spatial events worth retargeting on tend to fire early. */
const pending: Array<{ event: string; params?: Params }> = [];
let live = false;

export function trackMarketing(event: string, params?: Params) {
  if (!live) {
    // Bounded: a visitor who never consents must not accumulate a queue.
    if (pending.length < 25) pending.push({ event, params });
    return;
  }
  emit(event, params);
}

function emit(event: string, params?: Params) {
  if (typeof window === 'undefined') return;
  try {
    if (META_ID && window.fbq) window.fbq('trackCustom', event, params ?? {});
    if (GA4_ID && window.gtag) window.gtag('event', event, params ?? {});
    if (LINKEDIN_ID && window.lintrk) window.lintrk('track', { conversion_id: event });
  } catch {
    /* marketing must never break the page */
  }
}

function clearVendorCookies() {
  if (typeof document === 'undefined') return;
  const host = window.location.hostname;
  // Vendors scope to the registrable domain, so clear the bare host and the
  // dot-prefixed parent; without the parent variant the cookie survives.
  const domains = [undefined, host, `.${host.split('.').slice(-2).join('.')}`];
  for (const name of VENDOR_COOKIES) {
    for (const d of domains) {
      document.cookie =
        `${name}=; Path=/; Max-Age=0; SameSite=Lax` + (d ? `; Domain=${d}` : '');
    }
  }
}

export function MarketingPixels() {
  const { ready, granted } = useConsent();
  const allowed = ready && granted('marketing');
  const wasAllowed = useRef(false);

  useEffect(() => {
    if (allowed) {
      wasAllowed.current = true;
      live = true;
      // Flush whatever happened between page load and consent.
      while (pending.length) {
        const item = pending.shift()!;
        emit(item.event, item.params);
      }
      return;
    }
    live = false;
    pending.length = 0;
    // Only sweep if they were ever on — avoids clobbering cookies we never set.
    if (wasAllowed.current) {
      wasAllowed.current = false;
      clearVendorCookies();
    }
  }, [allowed]);

  // No consent, or no IDs configured yet: render nothing at all.
  if (!allowed) return null;

  return (
    <>
      {META_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_ID}');fbq('track','PageView');`}
        </Script>
      )}

      {GA4_ID && (
        <>
          <Script
            id="ga4-src"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments)}
window.gtag=gtag;gtag('js',new Date());
gtag('config','${GA4_ID}',{send_page_view:true});`}
          </Script>
        </>
      )}

      {LINKEDIN_ID && (
        <Script id="linkedin-insight" strategy="afterInteractive">
          {`_linkedin_partner_id='${LINKEDIN_ID}';
window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];
window._linkedin_data_partner_ids.push(_linkedin_partner_id);
(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};
window.lintrk.q=[]}var s=document.getElementsByTagName('script')[0];
var b=document.createElement('script');b.type='text/javascript';b.async=true;
b.src='https://snap.licdn.com/li.lms-analytics/insight.min.js';
s.parentNode.insertBefore(b,s)})(window.lintrk);`}
        </Script>
      )}
    </>
  );
}
