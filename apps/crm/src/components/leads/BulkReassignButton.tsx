'use client';

import { useState } from 'react';
import { BulkReassignModal } from './BulkReassignModal';

type Agent = { id: string; name: string };

export function BulkReassignButton({ agents }: { agents: Agent[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)} 
        className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors"
      >
        Bulk Reassign
      </button>
      <BulkReassignModal agents={agents} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
