/**
 * SectionImage Component
 * Displays individual section images with corner marks and captions
 * Design reference: mockup-final-hybrid.html lines 264-358
 */

import { useState } from 'react';
import { RefreshCw, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SectionImage as SectionImageType } from '@/lib/api';
import { PromptDetailsModal } from './PromptDetailsModal';

interface SectionImageProps {
  image: SectionImageType;
  onRegenerate?: () => Promise<void>;
  onPromptUpdate?: (newPrompt: string) => Promise<void>;
  isAdmin?: boolean;
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

export function SectionImage({ image, onRegenerate, onPromptUpdate, isAdmin = false, className }: SectionImageProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);

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

  const handlePromptUpdate = async (newPrompt: string) => {
    if (!onPromptUpdate) return;

    setRegenerating(true);
    try {
      await onPromptUpdate(newPrompt);
      setImageError(false);
    } catch (error) {
      console.error('Error updating prompt:', error);
      throw error;
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
            <>
              <img
                src={image.image_url}
                alt={`Figure ${image.section_number} - ${image.section_title}`}
                className="w-full h-full object-cover relative z-10"
                loading="lazy"
                onError={() => setImageError(true)}
              />

              {/* Image title overlay (DALL-E revised prompt) */}
              {image.image_title && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 z-20">
                  <p className="text-white text-sm italic line-clamp-2">
                    {image.image_title}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Action buttons (hover) */}
          <div className="absolute top-2 right-2 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {/* Info button (admin only) */}
            {isAdmin && (
              <button
                onClick={() => setShowPromptModal(true)}
                className={cn(
                  'p-2 bg-white/90 border border-[#2563eb]',
                  'text-[#2563eb] rounded hover:bg-[#2563eb] hover:text-white',
                  'transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563eb]'
                )}
                title="View prompt details"
                aria-label="View prompt details"
              >
                <Info className="w-4 h-4" />
              </button>
            )}

            {/* Regenerate button */}
            {onRegenerate && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className={cn(
                  'p-2 bg-white/90 border border-[#2563eb]',
                  'text-[#2563eb] rounded hover:bg-[#2563eb] hover:text-white',
                  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
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
      </div>

      {/* Caption */}
      <div className="mt-3 font-mono text-xs text-[#2563eb] flex items-center gap-2">
        <span>&#9656;</span>
        <span>
          Fig {image.section_number} — {image.section_title}
        </span>
      </div>

      {/* Prompt Details Modal (admin only) */}
      {isAdmin && (
        <PromptDetailsModal
          image={image}
          open={showPromptModal}
          onOpenChange={setShowPromptModal}
          onPromptUpdate={onPromptUpdate}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
