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
    // The site's quiet action — a word and a hairline (globals.css, cta-quiet)
    // — where this was the one filled, rounded button left on the site.
    <button
      type="button"
      onClick={handleDownload}
      disabled={isDownloading}
      className="cta-quiet disabled:opacity-50 print:hidden"
    >
      <span className="cta-quiet-label">{isDownloading ? 'Preparing the brochure' : 'Its brochure, as a PDF'}</span>
    </button>
  );
}
