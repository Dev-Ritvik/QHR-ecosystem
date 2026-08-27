// apps/public/src/components/site/DownloadBrochureButton.tsx
'use client';

import { useState } from 'react';

type DownloadBrochureButtonProps = {
  projectSlug: string;
  unitSlug: string;
  priceVersionId?: string | null;
};

export function DownloadBrochureButton({ projectSlug, unitSlug, priceVersionId }: DownloadBrochureButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = () => {
    setIsDownloading(true);
    try {
      // Append priceVersionId to the URL so CDN edge caches properly per version (NFR-D5)
      const versionQuery = priceVersionId ? `?v=${priceVersionId}` : '';
      const url = `/api/brochure/${projectSlug}/${unitSlug}${versionQuery}`;
      
      // Simple location swap initiates the download file stream
      window.location.href = url;
    } finally {
      // Reset loading state after a sensible delay since we can't reliably detect the exact download completion via href
      setTimeout(() => setIsDownloading(false), 2500);
    }
  };

  return (
    <button 
      onClick={handleDownload}
      disabled={isDownloading}
      // min-h-[44px] rather than an expander: this is the primary action on the
      // page, so the real control should be the size of the target.
      // bg-primary/text-primary-foreground only started resolving once the
      // semantic tokens were actually defined in globals.css — until then this
      // button had no fill and no colour of its own.
      className="flex min-h-[44px] items-center rounded-[3px] bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 print:hidden"
    >
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {isDownloading ? 'Generating...' : 'Download Brochure'}
    </button>
  );
}
