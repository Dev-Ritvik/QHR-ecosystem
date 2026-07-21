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
    <div className="flex flex-col items-center justify-center py-16 px-6 border border-dashed border-gray-200 bg-gray-50/50 rounded-sm text-center">
      <Icon className="w-10 h-10 text-gray-300 mb-4" strokeWidth={1.5} />
      <h4 className="text-sm font-semibold text-gray-900 tracking-wide mb-1">{title}</h4>
      <p className="text-sm text-gray-500 max-w-sm">{description}</p>
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
