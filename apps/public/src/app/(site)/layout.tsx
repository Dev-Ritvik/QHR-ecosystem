import { PostHogProvider } from './posthog-provider';

// NFR-S6: PostHog loaded EXCLUSIVELY in the (site) layout to prevent loading inside (present) bundle
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <div className="flex flex-col min-h-screen">
        {children}
      </div>
    </PostHogProvider>
  );
}
