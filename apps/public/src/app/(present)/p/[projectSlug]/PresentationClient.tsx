'use client';

import { useState, useEffect } from 'react';
import { ProjectMap } from '@/components/map/ProjectMap';
import { StatusLegend } from '@/components/present/StatusLegend';
import { UnitPanel } from '@/components/present/UnitPanel';
import { useProjectRealtime } from '@/lib/realtime';

type PresentationClientProps = {
  project: any;
  units: any[];
  geometry: any[];
  pois: any[];
  isPricingUnlocked?: boolean;
};

export function PresentationClient({ project, units: initialUnits, geometry, pois, isPricingUnlocked = false }: PresentationClientProps) {
  const liveUnits = useProjectRealtime(project.projectId, initialUnits);
  
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'skeleton' | '3d' | 'connectivity'>('skeleton');
  
  const selectedUnit = selectedUnitId ? liveUnits.find(u => u.unitId === selectedUnitId) : null;

  const [focusArea, setFocusArea] = useState<'map' | 'switcher'>('map');
  const viewModes: ('skeleton' | '3d' | 'connectivity')[] = ['skeleton', '3d', 'connectivity'];
  const [switcherIndex, setSwitcherIndex] = useState(0);
  const [unitIndex, setUnitIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Legacy 'M' toggle
      if (e.key === 'm' || e.key === 'M') {
        setViewMode(prev => 
          prev === 'skeleton' ? '3d' : 
          prev === '3d' ? 'connectivity' : 'skeleton'
        );
        return;
      }

      if (e.key === 'ArrowUp') {
        setFocusArea('switcher');
      } else if (e.key === 'ArrowDown') {
        setFocusArea('map');
      } else if (e.key === 'ArrowRight') {
        if (focusArea === 'switcher') {
          setSwitcherIndex(prev => Math.min(prev + 1, 2));
        } else {
          setUnitIndex(prev => Math.min(prev + 1, liveUnits.length - 1));
        }
      } else if (e.key === 'ArrowLeft') {
        if (focusArea === 'switcher') {
          setSwitcherIndex(prev => Math.max(prev - 1, 0));
        } else {
          setUnitIndex(prev => Math.max(prev - 1, 0));
        }
      } else if (e.key === 'Enter') {
        if (focusArea === 'switcher') {
          setViewMode(viewModes[switcherIndex]);
        } else {
          if (liveUnits[unitIndex]) {
            setSelectedUnitId(liveUnits[unitIndex].unitId);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusArea, switcherIndex, unitIndex, liveUnits]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 text-slate-50">
      <ProjectMap 
        project={project} 
        units={liveUnits} 
        geometry={geometry} 
        pois={pois}
        viewMode={viewMode}
        selectedUnitId={selectedUnitId}
        onUnitSelect={setSelectedUnitId}
      />
      
      {/* Hidden controls for testing or accessibility */}
      <div className="absolute top-0 left-0 w-full flex justify-center z-20 pointer-events-none p-4">
        <div className={`flex gap-4 p-2 rounded bg-black/50 ${focusArea === 'switcher' ? 'ring-2 ring-indigo-500' : ''}`}>
           {viewModes.map((mode, i) => (
             <div key={mode} className={`px-4 py-2 rounded ${switcherIndex === i && focusArea === 'switcher' ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                {mode}
             </div>
           ))}
        </div>
      </div>

      <div className="absolute top-8 left-8 z-10 pointer-events-none">
        <h1 className="text-4xl font-bold tracking-tight mb-2 drop-shadow-md">{project.name}</h1>
        <p className="text-xl text-slate-300 drop-shadow-md">{project.locality}, {project.city}</p>
      </div>

      <div className="absolute top-8 right-8 z-10 pointer-events-none">
        <StatusLegend units={liveUnits} />
      </div>

      {selectedUnit && (
        <div className="absolute bottom-8 left-8 z-10 w-96">
          <UnitPanel unit={selectedUnit} project={project} isPricingUnlocked={isPricingUnlocked} />
        </div>
      )}
    </div>
  );
}
