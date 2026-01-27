/**
 * ImagePlaceholder Component
 * Shows loading or empty state for images
 * Used when image hasn't been generated yet
 */

import { Loader2, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImagePlaceholderProps {
  sectionNumber: number;
  sectionTitle: string;
  loading?: boolean;
  onGenerate?: () => void;
  className?: string;
}

export function ImagePlaceholder({
  sectionNumber,
  sectionTitle,
  loading = false,
  onGenerate,
  className,
}: ImagePlaceholderProps) {
  return (
    <div className={cn('mb-8 section-image-container image-with-caption', className)}>
      <div className="relative bg-white border-2 border-dashed border-gray-300 p-2">
        <div className="aspect-video bg-gray-50 flex flex-col items-center justify-center gap-4 relative">
          {/* Subtle grid - hidden in print mode */}
          <div
            className="graph-paper-overlay absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)
              `,
              backgroundSize: '10px 10px',
            }}
          />

          {loading ? (
            <>
              <Loader2 className="w-8 h-8 text-[#2563eb] animate-spin relative z-10" />
              <span className="font-mono text-xs text-gray-500 relative z-10">
                Generating image...
              </span>
            </>
          ) : (
            <>
              <div className="text-center font-mono text-xs text-gray-400 relative z-10">
                <p>[4-color pen sketch placeholder]</p>
                <p className="mt-1">Section {sectionNumber}: {sectionTitle}</p>
              </div>
              {onGenerate && (
                <button
                  onClick={onGenerate}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 relative z-10',
                    'bg-[#2563eb] text-white font-mono text-xs rounded',
                    'hover:bg-[#1d4ed8] transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2'
                  )}
                >
                  <ImagePlus className="w-4 h-4" />
                  Generate Image
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-3 font-mono text-xs text-gray-400 flex items-center gap-2">
        <span>&#9656;</span>
        <span>Fig {sectionNumber} — {sectionTitle}</span>
      </div>
    </div>
  );
}
