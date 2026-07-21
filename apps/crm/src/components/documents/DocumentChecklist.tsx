// apps/crm/src/components/documents/DocumentChecklist.tsx
'use client';

import { useState, useTransition } from 'react';
import { initUnitChecklist, uploadDocument, getSignedDocumentUrl } from '@/server/actions/documents';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FileText, Upload, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import type { AssetClass } from '@estate/domain/src/documents/templates';
import { getUnitChecklistTemplate } from '@estate/domain/src/documents/templates';

type DocRow = any;

export type DocumentChecklistProps = {
  scope?: 'unit' | 'client' | 'booking';
  unitId?: string;
  projectId?: string;
  assetClass?: AssetClass;
  clientId?: string;
  bookingId?: string;
  existingDocs?: DocRow[];
};

export function DocumentChecklist({ 
  scope = 'unit',
  unitId, 
  projectId, 
  assetClass, 
  clientId,
  bookingId,
  existingDocs = []
}: DocumentChecklistProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState<{ id: string, title: string, hasValidity: boolean } | null>(null);

  // Form State
  const [file, setFile] = useState<File | null>(null);
  const [validFrom, setValidFrom] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const template = scope === 'unit' && assetClass ? getUnitChecklistTemplate(assetClass) : [];

  const handleInit = () => {
    if (scope !== 'unit' || !unitId || !projectId || !assetClass) return;
    startTransition(async () => {
      const res = await initUnitChecklist({ unitId, projectId, assetClass });
      if (!res.ok) setError('code' in res ? res.code : 'Failed to initialize checklist');
    });
  };

  const handleUploadSubmit = () => {
    if (!uploadData || !file) return;
    setError(null);

    const formData = new FormData();
    formData.append('documentId', uploadData.id);
    formData.append('file', file);
    if (projectId) formData.append('projectId', projectId);
    if (unitId) formData.append('unitId', unitId);
    if (clientId) formData.append('clientId', clientId);
    if (bookingId) formData.append('bookingId', bookingId);
    
    if (uploadData.hasValidity) {
      if (validFrom) formData.append('validFrom', validFrom);
      if (expiryDate) formData.append('expiryDate', expiryDate);
    }

    startTransition(async () => {
      const res = await uploadDocument(formData);
      if (res.ok) {
        setUploadData(null);
        setFile(null);
        setValidFrom('');
        setExpiryDate('');
      } else {
        setError('message' in res && typeof res.message === 'string' ? res.message : ('code' in res ? res.code : 'Failed to upload document'));
      }
    });
  };

  const handleView = async (documentId: string) => {
    const res = await getSignedDocumentUrl(documentId);
    if (res.ok && res.data) {
      window.open(res.data, '_blank');
    } else {
      alert(!res.ok ? res.code : 'Failed to generate secure viewing link.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'on_file': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase"><CheckCircle className="w-3 h-3 mr-1"/> On File</span>;
      case 'missing': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive uppercase"><AlertCircle className="w-3 h-3 mr-1"/> Missing</span>;
      case 'expired': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 uppercase"><Clock className="w-3 h-3 mr-1"/> Expired</span>;
      default: return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground uppercase">{status}</span>;
    }
  };

  if (existingDocs.length === 0) {
    if (scope === 'unit' && template.length === 0) {
      return <div className="text-sm text-muted-foreground">No documents required for this asset class.</div>;
    }
    if (scope !== 'unit') {
      return <div className="text-sm text-muted-foreground py-4 text-center border rounded-md">No documents synced yet.</div>;
    }

    return (
      <div className="flex flex-col items-center justify-center p-8 border rounded-xl bg-card text-center shadow-sm">
        <FileText className="w-10 h-10 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold">Document Checklist</h3>
        <p className="text-muted-foreground mt-1 text-sm max-w-sm mb-6">
          Initialize the compliance and legal checklist required for {assetClass?.replace('_', ' ')} units.
        </p>
        <Button onClick={handleInit} disabled={isPending}>
          Generate Checklist
        </Button>
        {error && <p className="text-destructive text-sm mt-4">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
          {error}
        </div>
      )}

      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
            <tr>
              <th className="px-4 py-3">Document Requirement</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 hidden md:table-cell">Validity</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {existingDocs.map(doc => {
              const tmpl = template.find(t => t.key === doc.checklistKey);
              
              return (
                <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 align-middle font-medium text-foreground">
                    {doc.title}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {getStatusBadge(doc.status)}
                  </td>
                  <td className="px-4 py-3 align-middle hidden md:table-cell text-muted-foreground">
                    {doc.validFrom && doc.expiryDate ? (
                      <span className="text-xs">
                        {doc.validFrom} to <span className={new Date(doc.expiryDate) < new Date() ? 'text-destructive font-bold' : ''}>{doc.expiryDate}</span>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 align-middle text-right space-x-2">
                    {doc.status === 'on_file' ? (
                      <Button variant="outline" size="sm" onClick={() => handleView(doc.id)}>
                        View File
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setUploadData({ id: doc.id, title: doc.title, hasValidity: tmpl?.hasValidityDates || false })}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        Upload
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!uploadData} onOpenChange={(open) => !open && setUploadData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload {uploadData?.title}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select File (PDF, Image)</label>
              <Input 
                type="file" 
                accept=".pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            {uploadData?.hasValidity && (
              <div className="grid grid-cols-2 gap-4 border p-4 rounded-lg bg-muted/20">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Valid From</label>
                  <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expiry Date</label>
                  <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                </div>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Files are stored securely in a private bucket and served via short-lived signed URLs.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadData(null)}>Cancel</Button>
            <Button disabled={isPending || !file} onClick={handleUploadSubmit}>Upload Document</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
