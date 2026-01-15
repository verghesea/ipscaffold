/**
 * ArtifactHeader Component
 * Header with artifact info and generate images button
 * Design matches hybrid mockup style
 */

import { ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ArtifactHeaderProps {
  artifactNumber: number;
  totalArtifacts: number;
  artifactLabel: string;
  artifactTitle: string;
  hasImages: boolean;
  imageCount: number;
  totalSections: number;
  generating: boolean;
  onGenerateImages: () => void;
  className?: string;
}

export function ArtifactHeader({
  artifactNumber,
  totalArtifacts,
  artifactLabel,
  artifactTitle,
  hasImages,
  imageCount,
  totalSections,
  generating,
  onGenerateImages,
  className,
}: ArtifactHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8', className)}>
      {/* Artifact badge */}
      <div className="flex items-center gap-4 border-2 border-[#2563eb] p-4 bg-white flex-1 min-w-0">
        <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center border-2 border-[#2563eb] bg-white text-[#2563eb] font-bold font-mono text-lg">
          {String(artifactNumber).padStart(2, '0')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs font-semibold uppercase tracking-wider text-[#dc2626]">
            Artifact {String(artifactNumber).padStart(2, '0')} / {String(totalArtifacts).padStart(2, '0')}
          </div>
          <div className="text-base sm:text-lg font-bold text-gray-900 truncate">
            {artifactLabel} – {artifactTitle}
          </div>
        </div>
      </div>

      {/* Generate Images button */}
      <Button
        onClick={onGenerateImages}
        disabled={generating}
        variant={hasImages ? 'outline' : 'default'}
        className={cn(
          'flex items-center gap-2 font-mono whitespace-nowrap flex-shrink-0',
          !hasImages && 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white'
        )}
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="hidden sm:inline">Generating...</span>
            <span className="sm:hidden">Gen...</span>
          </>
        ) : (
          <>
            <ImagePlus className="w-4 h-4" />
            {hasImages ? (
              <>
                <span className="hidden sm:inline">
                  Regenerate ({imageCount}/{totalSections})
                </span>
                <span className="sm:hidden">
                  Regen ({imageCount}/{totalSections})
                </span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Generate Images</span>
                <span className="sm:hidden">Generate</span>
              </>
            )}
          </>
        )}
      </Button>
    </div>
  );
}
