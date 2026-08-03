import { ConsentProvider } from '@/lib/consent/ConsentProvider';
import { ConsentPanel } from '@/components/consent/ConsentPanel';
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
            {children}
          </div>
          <ConsentPanel />
        </TelemetryProvider>
      </PostHogProvider>
    </ConsentProvider>
  );
}
