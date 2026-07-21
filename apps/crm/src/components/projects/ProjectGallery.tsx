// apps/crm/src/components/projects/ProjectGallery.tsx
'use client';

import { useState } from 'react';
import { uploadMedia, updateMediaOrder } from '@/server/actions/media';

export function ProjectGallery({ projectId, initialMedia }: { projectId: string, initialMedia: any[] }) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsUploading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.append('projectId', projectId);

    const res = await uploadMedia(formData);
    if (!res.ok) {
      setError(res.message);
    }
    
    setIsUploading(false);
    if (res.ok) {
      (e.target as HTMLFormElement).reset();
    }
  }

  async function handleReorder(direction: 'up' | 'down', index: number) {
    const newOrder = [...initialMedia];
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
    } else {
      return;
    }

    await updateMediaOrder({
      projectId,
      orderedIds: newOrder.map(m => m.id)
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded border">
        <h3 className="font-medium mb-4">Upload Media</h3>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Kind</label>
            <select name="kind" className="border rounded p-2 mt-1 w-full" required>
              <option value="gallery">Gallery Image</option>
              <option value="hero">Hero Image</option>
              <option value="og_image">OG Image</option>
              <option value="plan">Floor/Site Plan</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Alt Text (Required)</label>
            <input name="altText" type="text" className="border rounded p-2 mt-1 w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium">File (High Resolution Required)</label>
            <input name="file" type="file" accept="image/*" className="mt-1" required />
          </div>
          
          {error && <p className="text-red-600 text-sm">{error}</p>}
          
          <button type="submit" disabled={isUploading} className="bg-blue-600 text-white px-4 py-2 rounded font-medium disabled:opacity-50">
            {isUploading ? 'Uploading...' : 'Upload Image'}
          </button>
        </form>
      </div>

      <div>
        <h3 className="font-medium mb-4">Project Gallery</h3>
        <div className="grid grid-cols-3 gap-4">
          {initialMedia.map((m, idx) => (
            <div key={m.id} className="border p-2 rounded group">
              <img src={m.variants.thumb.url} alt={m.altText} className="w-full h-32 object-cover rounded" />
              <div className="mt-2 flex justify-between items-center text-sm">
                <span className="font-medium text-gray-700 capitalize">{m.kind}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleReorder('up', idx)} disabled={idx === 0}>↑</button>
                  <button onClick={() => handleReorder('down', idx)} disabled={idx === initialMedia.length - 1}>↓</button>
                </div>
              </div>
            </div>
          ))}
          {initialMedia.length === 0 && <p className="text-gray-500 text-sm">No media uploaded yet.</p>}
        </div>
      </div>
    </div>
  );
}
