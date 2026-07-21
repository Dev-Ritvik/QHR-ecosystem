'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPoi, updatePoi } from '@/server/actions/pois';
import { PoiMapPicker } from './PoiMapPicker';
import { Button } from '@/components/ui/button';

export interface EditingPoi {
  id: string;
  name: string;
  category: string;
  location: [number, number] | null;
  distanceOverrideM: number | null;
  driveTimeMin: number | null;
  driveTimeOverrideMin: number | null;
}

interface PoiFormProps {
  projectId: string;
  projectCentroid?: { type: 'Point', coordinates: [number, number] } | null;
  initialPoi?: EditingPoi | null;
  onSuccess?: () => void;
}

export function PoiForm({ projectId, projectCentroid, initialPoi, onSuccess }: PoiFormProps) {
  const router = useRouter();
  const isEditing = !!initialPoi;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(
    initialPoi?.location ?? null
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedLocation) {
      setError('Please select a location on the map');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const common = {
      name: formData.get('name') as string,
      category: formData.get('category') as any,
      distanceOverrideM: formData.get('distanceOverrideM') ? Number(formData.get('distanceOverrideM')) : undefined,
      driveTimeMin: formData.get('driveTimeMin') ? Number(formData.get('driveTimeMin')) : undefined,
      driveTimeOverrideMin: formData.get('driveTimeOverrideMin') ? Number(formData.get('driveTimeOverrideMin')) : undefined,
    };

    const res = isEditing
      ? await updatePoi({
          poiId: initialPoi!.id,
          ...common,
          // Only send the pin if it actually moved (avoids a distance recompute)
          location: selectedLocation !== initialPoi!.location ? selectedLocation : undefined,
        })
      : await createPoi({ projectId, location: selectedLocation, ...common });

    if (!res.ok) {
      setError(res.message);
      setIsSubmitting(false);
    } else {
      setIsSubmitting(false);
      if (isEditing) {
        router.push(`/projects/${projectId}/pois`);
        router.refresh();
      } else {
        setSelectedLocation(null);
        (e.target as HTMLFormElement).reset();
        if (onSuccess) onSuccess();
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 border rounded shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lg">{isEditing ? `Edit POI — ${initialPoi!.name}` : 'Add New POI'}</h3>
        {isEditing && (
          <Link href={`/projects/${projectId}/pois`} className="text-sm text-gray-500 hover:text-gray-900">
            Cancel
          </Link>
        )}
      </div>

      <div>
        <PoiMapPicker
          centroid={projectCentroid}
          selectedLocation={selectedLocation}
          onLocationSelect={setSelectedLocation}
        />
        {selectedLocation && (
          <p className="text-xs text-green-600 mt-1">
            Selected: {selectedLocation[0].toFixed(5)}, {selectedLocation[1].toFixed(5)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input name="name" type="text" className="w-full border rounded p-2 text-sm" required placeholder="e.g. Apollo Hospital" defaultValue={initialPoi?.name ?? ''} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select name="category" className="w-full border rounded p-2 text-sm" required defaultValue={initialPoi?.category ?? 'school'}>
            <option value="school">School</option>
            <option value="hospital">Hospital</option>
            <option value="transit">Transit</option>
            <option value="employment_hub">Employment Hub</option>
            <option value="shopping">Shopping</option>
            <option value="leisure">Leisure</option>
            <option value="connectivity">Connectivity (Highway/Road)</option>
            <option value="landmark">Landmark</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Estimated Drive Time (min)</label>
          <input name="driveTimeMin" type="number" min="0" className="w-full border rounded p-2 text-sm" placeholder="Enter manually" defaultValue={initialPoi?.driveTimeMin ?? ''} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-600">Manual Distance (m)</label>
          <input name="distanceOverrideM" type="number" min="0" className="w-full border rounded p-2 text-sm bg-gray-50" placeholder="Override auto distance" defaultValue={initialPoi?.distanceOverrideM ?? ''} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-600">Manual Drive Time (min)</label>
          <input name="driveTimeOverrideMin" type="number" min="0" className="w-full border rounded p-2 text-sm bg-gray-50" placeholder="Override drive time" defaultValue={initialPoi?.driveTimeOverrideMin ?? ''} />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <Button type="submit" disabled={isSubmitting || !selectedLocation} className="w-full">
        {isSubmitting ? 'Saving...' : isEditing ? 'Update POI' : 'Save POI'}
      </Button>
    </form>
  );
}
