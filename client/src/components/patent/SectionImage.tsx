/**
 * SectionImage Component
 * Displays individual section images with corner marks and captions
 * Design reference: mockup-final-hybrid.html lines 264-358
 */

import { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SectionImage as SectionImageType } from '@/lib/api';

interface SectionImageProps {
  image: SectionImageType;
  onRegenerate?: () => Promise<void>;
  className?: string;
}

// Corner marks component (simple L-shapes in blue)
function CornerMark({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const positionClasses = {
    tl: 'top-0 left-0 border-t-2 border-l-2',
    tr: 'top-0 right-0 border-t-2 border-r-2',
    bl: 'bottom-0 left-0 border-b-2 border-l-2',
    br: 'bottom-0 right-0 border-b-2 border-r-2',
  };

  return (
    <div
      className={cn(
        'absolute w-4 h-4 border-[#2563eb]',
        positionClasses[position]
      )}
    />
  );
}

export function SectionImage({ image, onRegenerate, className }: SectionImageProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleRegenerate = async () => {
    if (!onRegenerate || regenerating) return;

    setRegenerating(true);
    try {
      await onRegenerate();
      setImageError(false);
    } catch (error) {
      console.error('Error regenerating image:', error);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className={cn('mb-8', className)}>
      {/* Image container with corner marks */}
      <div className="relative bg-white border-2 border-[#2563eb] p-2 group">
        <CornerMark position="tl" />
        <CornerMark position="tr" />
        <CornerMark position="bl" />
        <CornerMark position="br" />

        {/* Image */}
        <div className="relative aspect-video bg-white border border-gray-200 overflow-hidden">
          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)
              `,
              backgroundSize: '10px 10px',
            }}
          />

          {imageError ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-mono text-sm">
              Image failed to load
            </div>
          ) : (
            <img
              src={image.image_url}
              alt={`Figure ${image.section_number} - ${image.section_title}`}
              className="w-full h-full object-cover relative z-10"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          )}

          {/* Regenerate button (hover) */}
          {onRegenerate && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className={cn(
                'absolute top-2 right-2 p-2 bg-white/90 border border-[#2563eb]',
                'text-[#2563eb] rounded opacity-0 group-hover:opacity-100',
                'transition-opacity duration-200 hover:bg-[#2563eb] hover:text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed z-20',
                'focus:outline-none focus:ring-2 focus:ring-[#2563eb]'
              )}
              title="Regenerate image"
              aria-label="Regenerate image"
            >
              {regenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Caption */}
      <div className="mt-3 font-mono text-xs text-[#2563eb] flex items-center gap-2">
        <span>&#9656;</span>
        <span>
          Fig {image.section_number} — {image.section_title}
        </span>
      </div>
    </div>
  );
}
