import { ConsentProvider } from '@/lib/consent/ConsentProvider';
import { ConsentPanel } from '@/components/consent/ConsentPanel';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { TelemetryProvider } from '@/lib/telemetry/TelemetryProvider';
import { MarketingPixels } from '@/lib/marketing/pixels';
import { PostHogProvider } from './posthog-provider';

// NFR-S6: PostHog loaded EXCLUSIVELY in the (site) layout to prevent loading inside (present) bundle.
// Consent lives here for the same reason — (present) is a staff-operated kiosk on
// its own subdomain that deliberately loads no analytics, so it has nothing to
// ask about. ConsentProvider must wrap PostHogProvider, because PostHog now reads
// consent before it is permitted to initialise.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsentProvider>
      <PostHogProvider>
        <TelemetryProvider>
          {/* Chrome lives in the layout, not the pages. App Router keeps this
              subtree mounted across every navigation inside the segment, so the
              header never remounts and the WebGL canvas behind it survives —
              which is the whole reason the experience is a route group.

              pt-[62px] clears the fixed bar. A fixed header over scrolling
              content needs the offset somewhere, and putting it here means a
              page cannot forget it. */}
          <div className="flex min-h-screen flex-col bg-[#0A1120]">
            <SiteHeader />
            <div className="flex-1 pt-[62px]">{children}</div>
            {/* Withdrawal has to be as easy as granting, so PrivacyControl sits
                inside the footer, which is on every page. */}
            <SiteFooter />
          </div>
          <ConsentPanel />
          {/* Renders nothing at all without Marketing consent — no script tag,
              no network request. A pixel loaded and then told not to track has
              still handed the vendor an IP and a referrer. */}
          <MarketingPixels />
        </TelemetryProvider>
      </PostHogProvider>
    </ConsentProvider>
  );
}
