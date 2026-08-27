// apps/public/src/components/site/EmptyStates.tsx
import React from 'react';
import { Image as ImageIcon, Map as MapIcon, Component as ComponentIcon } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: React.ElementType;
};

export function EmptyState({ title, description, icon: Icon = ComponentIcon }: EmptyStateProps) {
  return (
    // Dark palette, matching every other surface. These carried gray-50/gray-900
    // from when the site had a white background — the same migration
    // ProjectCard documents having gone through — which left near-black type on
    // a near-black page wherever a section had no data. Since geometry_pub and
    // the gallery manifests are both empty today, these are not a rare state:
    // they are what the project page mostly shows.
    <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      <Icon className="mb-4 h-8 w-8 text-[#F2EDE4]/30" strokeWidth={1.25} />
      <h4 className="t-eyebrow mb-2 text-[#F2EDE4]/70">{title}</h4>
      <p className="t-small max-w-sm text-[#F2EDE4]/50">{description}</p>
    </div>
  );
}

export function EmptyGallery() {
  return (
    <EmptyState 
      title="Gallery Unavailable" 
      description="Photographs and visual renderings for this project are currently being curated." 
      icon={ImageIcon} 
    />
  );
}

export function EmptyMap() {
  return (
    <EmptyState 
      title="Map Unavailable" 
      description="The interactive plot map and geometry for this project are not currently available." 
      icon={MapIcon} 
    />
  );
}

export function EmptyStates({ type }: { type: 'narrative' | 'gallery' | 'map' | 'amenities' | 'location' }) {
  switch (type) {
    case 'narrative': return <EmptyState title="Narrative Unavailable" description="No narrative provided for this project." />;
    case 'gallery': return <EmptyGallery />;
    case 'map': return <EmptyMap />;
    case 'amenities': return <EmptyState title="Amenities Unavailable" description="No amenities listed for this project." />;
    case 'location': return <EmptyState title="Location Data Unavailable" description="No points of interest available." />;
    default: return <EmptyState title="Unavailable" description="This information is currently unavailable." />;
  }
}
