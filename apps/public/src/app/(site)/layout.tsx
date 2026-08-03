import { ConsentProvider } from '@/lib/consent/ConsentProvider';
import { ConsentPanel, PrivacyControl } from '@/components/consent/ConsentPanel';
import { TelemetryProvider } from '@/lib/telemetry/TelemetryProvider';
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
          <div className="flex flex-col min-h-screen">
            <div className="flex-1">{children}</div>
            {/* Withdrawal has to be as easy as granting, so the control lives on
                every page rather than only wherever a footer eventually lands.
                This strip is a placeholder for the real footer. */}
            <footer className="border-t border-neutral-200 px-6 py-5">
              <PrivacyControl />
            </footer>
          </div>
          <ConsentPanel />
        </TelemetryProvider>
      </PostHogProvider>
    </ConsentProvider>
  );
}
