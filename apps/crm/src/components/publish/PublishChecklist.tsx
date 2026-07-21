// apps/crm/src/components/publish/PublishChecklist.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getPublishChecklistAction, publishProjectAction, unpublishProjectAction } from '@/server/actions/projects';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

type PublishChecklistProps = {
  projectId: string;
  isPublished: boolean;
};

export function PublishChecklist({ projectId, isPublished }: PublishChecklistProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, string | null> | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isPublished) {
      getPublishChecklistAction(projectId).then(res => {
        setIsReady(res.ok);
        setChecklist(res.checklist);
      });
    }
  }, [projectId, isPublished]);

  const handlePublish = async () => {
    setIsLoading(true);
    const res = await publishProjectAction(projectId);
    setIsLoading(false);
    
    if (res.ok) {
      router.refresh();
    } else if ('code' in res && res.code === 'VALIDATION_FAILED' && 'checklist' in res) {
      setIsReady(false);
      setChecklist(res.checklist as Record<string, string | null>);
    } else {
      alert('Failed to publish: ' + ('message' in res ? res.message : 'Unknown error'));
    }
  };

  const handleUnpublish = async () => {
    setIsLoading(true);
    const res = await unpublishProjectAction(projectId);
    setIsLoading(false);
    
    if (res.ok) {
      router.refresh();
    } else {
      alert('Failed to unpublish: ' + ('message' in res ? res.message : 'Unknown error'));
    }
  };

  if (isPublished) {
    return (
      <div className="p-4 border rounded-md bg-green-50 border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-green-700">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span className="font-medium">Project is live on public site</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleUnpublish} disabled={isLoading}>
            {isLoading ? 'Unpublishing...' : 'Unpublish'}
          </Button>
        </div>
      </div>
    );
  }

  if (!checklist) return null;

  return (
    <div className="p-4 border rounded-md bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Publish to Public Site</h3>
        <Button 
          onClick={handlePublish} 
          disabled={!isReady || isLoading}
        >
          {isLoading ? 'Publishing...' : 'Publish Project'}
        </Button>
      </div>
      
      {!isReady && (
        <div className="space-y-2 text-sm">
          <p className="text-gray-600 mb-2">Resolve the following issues to publish this project:</p>
          {Object.entries(checklist).map(([key, error]) => {
            if (!error) return null;
            return (
              <div key={key} className="flex items-start text-red-600 bg-red-50 p-2 rounded-md">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>{error as string}</span>
              </div>
            );
          })}
        </div>
      )}
      {isReady && (
        <div className="flex items-center text-green-600 text-sm">
          <CheckCircle className="w-4 h-4 mr-2" />
          <span>Project meets all requirements and is ready to be published.</span>
        </div>
      )}
    </div>
  );
}
