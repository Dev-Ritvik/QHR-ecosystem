// apps/public/src/components/map/MapLocationFallback.tsx
//
// The designed failure/degraded state for the site map (replaces the old
// reference to a non-existent /fallbacks/map-placeholder.jpg). It is not an
// apology screen: it still delivers the page's information — where the
// project is and what surrounds it — from the same ProjectMapData the live
// map would use, so a visitor without WebGL/a key configured loses polish,
// not content.
import type { ProjectMapData } from '@/lib/projection';

const CATEGORY_GLYPHS: Record<string, string> = {
  school: '🎓',
  hospital: '🏥',
  transit: '🚌',
  employment_hub: '🏢',
  shopping: '🛍',
  leisure: '🌳',
  connectivity: '🛣',
  landmark: '📍',
  other: '📌',
};

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function MapLocationFallback({
  projectName,
  locality,
  city,
  pois,
  className,
}: {
  projectName: string;
  locality?: string | null;
  city?: string | null;
  pois: ProjectMapData['pois'];
  className?: string;
}) {
  const place = [locality, city].filter(Boolean).join(', ');

  return (
    <div
      className={`${className ?? 'h-full w-full'} relative overflow-hidden rounded-[inherit] bg-gradient-to-br from-brand-900 via-brand-800 to-neutral-900 text-brand-50`}
      data-testid="site-map-fallback"
    >
      {/* Quiet cartographic texture: contour rings around the "pin" */}
      <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.14]" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        {[40, 80, 130, 190, 260].map((r) => (
          <circle key={r} cx="200" cy="150" r={r} fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 6" />
        ))}
        <circle cx="200" cy="150" r="5" fill="currentColor" />
      </svg>

      <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300">Location</p>
          <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">{projectName}</h3>
          {place && <p className="mt-1 text-sm text-brand-200">{place}</p>}
        </div>

        {pois.length > 0 ? (
          <ul className="mt-6 space-y-2">
            {pois.slice(0, 5).map((poi) => (
              <li key={poi.id} className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-2 text-sm last:border-0">
                <span className="flex items-center gap-2 text-brand-100">
                  <span aria-hidden>{CATEGORY_GLYPHS[poi.properties.category] ?? '📌'}</span>
                  {poi.properties.name}
                </span>
                <span className="shrink-0 tabular-nums text-brand-300">
                  {formatDistance(poi.properties.distanceM)}
                  {poi.properties.driveTimeMin != null && ` · ${poi.properties.driveTimeMin} min`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-brand-300">Interactive map temporarily unavailable.</p>
        )}
      </div>
    </div>
  );
}
