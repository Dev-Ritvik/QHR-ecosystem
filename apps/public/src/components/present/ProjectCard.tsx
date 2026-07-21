'use client';

import { useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { prefetchProjectBundle } from '@/lib/prefetch';
import * as Sentry from '@sentry/nextjs';

export function ProjectCard({ project, onFocus }: { project: any, onFocus?: (project: any) => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const handleFocus = () => {
      if (onFocus) onFocus(project);
      const tier = typeof window !== 'undefined' ? window.localStorage.getItem('capability_tier') : 'standard';
      prefetchProjectBundle(project, tier as any).catch(err => {
         // Silently report prefetch failure; UX degrades gracefully to network request
         Sentry.captureException(err, {});
      });
    };

    el.addEventListener('focus', handleFocus);
    return () => el.removeEventListener('focus', handleFocus);
  }, [project]);

  const handleSelect = () => {
    router.push(`/p/${project.slug}`);
  };

  return (
    <div 
      ref={cardRef}
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSelect();
      }}
      className="relative group w-full aspect-video rounded-xl overflow-hidden focus:ring-4 focus:ring-indigo-500 outline-none cursor-pointer transition-transform duration-300 focus:scale-[1.02] bg-slate-800"
    >
      <img 
        src={project.heroUrl} 
        alt="" 
        className="w-full h-full object-cover transition-opacity"
        onError={(e) => {
          // FR-PM11: Report missing asset without breaking UI flow
          Sentry.captureMessage(`Asset failure: Project hero image failed to load (${project.heroUrl})`, {});
          e.currentTarget.src = '/fallbacks/map-placeholder.jpg';
        }}
      />
      <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/80 to-transparent">
        <h3 className="text-2xl font-bold text-white">{project.name}</h3>
        <p className="text-slate-300">{project.locality}, {project.city}</p>
      </div>
    </div>
  );
}
