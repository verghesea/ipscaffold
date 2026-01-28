/**
 * PDFCoverPage Component
 * Cover page for PDF exports with hero image and patent metadata
 * Only visible in print mode
 */

import { cn } from '@/lib/utils';
import type { Patent } from '@/lib/api';

interface PDFCoverPageProps {
  patent: Patent;
  heroImageUrl?: string;
  className?: string;
}

export function PDFCoverPage({
  patent,
  heroImageUrl,
  className,
}: PDFCoverPageProps) {
  const publicationNumber = patent.publication_number || 'N/A';
  const displayTitle = patent.friendly_title || patent.title || 'Untitled Patent';

  return (
    <div className={cn('pdf-cover-page relative', className)}>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-amber-50" />

      {/* Content */}
      <div className="relative flex flex-col items-center justify-center min-h-screen px-12 py-16">
        {/* Logo/Branding */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
            IPScaffold
          </h1>
          <p className="text-center text-sm text-gray-500 mt-2 font-mono">
            Patent Intelligence Platform
          </p>
        </div>

        {/* Hero Image */}
        {heroImageUrl && (
          <div className="mb-12 w-full max-w-3xl">
            <div className="relative bg-white border-4 border-blue-600 p-3 shadow-2xl">
              {/* Corner marks */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-600" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-600" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-600" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-600" />

              <img
                src={`/api/image/watermarked?url=${encodeURIComponent(heroImageUrl)}`}
                alt={displayTitle}
                className="w-full h-auto"
              />
            </div>
          </div>
        )}

        {/* Patent Title */}
        <div className="mb-8 text-center max-w-4xl">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
            {displayTitle}
          </h2>
          {patent.assignee && (
            <p className="text-xl text-gray-600 mb-2">
              {patent.assignee}
            </p>
          )}
        </div>

        {/* Publication Number */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-3 bg-white px-6 py-3 border-2 border-red-600 shadow-lg">
            <span className="font-mono text-sm font-bold text-red-600 uppercase tracking-wider">
              Publication No.
            </span>
            <span className="font-mono text-lg font-bold text-gray-900">
              {publicationNumber}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-sm text-gray-500">
            Generated on {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
