/**
 * ArtifactPrintPage - Displays a single artifact in print mode for PDF generation
 * Similar to PatentDetailPage but for individual artifacts
 */

import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { EnhancedMarkdownRenderer } from '@/components/patent/EnhancedMarkdownRenderer';
import { ArtifactHeader } from '@/components/patent/ArtifactHeader';
import { countSections } from '@/lib/markdownParser';
import { Lightbulb, TrendingUp, Target } from 'lucide-react';

const ARTIFACT_TYPES = {
  elia15: {
    icon: Lightbulb,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    label: 'Scientific Narrative',
    description: 'Simplified Explanation',
    emoji: '💡',
    tagline: "Explain Like I'm 15"
  },
  business_narrative: {
    icon: TrendingUp,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Business Narrative',
    description: 'Investor-Ready Pitch',
    emoji: '📈',
    tagline: 'Commercial Strategy'
  },
  golden_circle: {
    icon: Target,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    label: 'Golden Circle',
    description: 'Strategic Framework',
    emoji: '🎯',
    tagline: 'Why • How • What'
  }
} as const;

export function ArtifactPrintPage() {
  const [, params] = useRoute('/artifact/:id');
  const [artifact, setArtifact] = useState<any>(null);
  const [patent, setPatent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [loadedImageCount, setLoadedImageCount] = useState(0);

  // Check if we're in print mode
  const isPrintMode = new URLSearchParams(window.location.search).get('print') === 'true';

  useEffect(() => {
    if (isPrintMode) {
      document.body.classList.add('print-mode');
      return () => document.body.classList.remove('print-mode');
    }
  }, [isPrintMode]);

  const loadArtifact = async (id: string) => {
    try {
      const printToken = new URLSearchParams(window.location.search).get('token');
      const url = printToken
        ? `/api/artifact/${id}?token=${encodeURIComponent(printToken)}`
        : `/api/artifact/${id}`;

      console.log('[ArtifactPrintPage] Loading artifact:', id);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to load artifact: ${response.status}`);
      }

      const data = await response.json();
      setArtifact(data.artifact);
      setPatent(data.patent);
    } catch (error) {
      console.error('[ArtifactPrintPage] Failed to load artifact:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params?.id) {
      loadArtifact(params.id);
    }
  }, [params?.id]);

  // Track when all images have loaded
  useEffect(() => {
    if (!artifact || !artifact.images) return;

    const totalImages = artifact.images.length;

    // If no images, mark as loaded immediately
    if (totalImages === 0) {
      setImagesLoaded(true);
      console.log('[ArtifactPrintPage] No images to load');
      return;
    }

    // Check if all images are loaded
    if (loadedImageCount >= totalImages) {
      setImagesLoaded(true);
      console.log('[ArtifactPrintPage] All images loaded:', loadedImageCount, '/', totalImages);
    } else {
      console.log('[ArtifactPrintPage] Images loading:', loadedImageCount, '/', totalImages);
    }
  }, [artifact, loadedImageCount]);

  const handleImageLoad = () => {
    setLoadedImageCount(prev => prev + 1);
  };

  const handleImageError = () => {
    // Count errors as "loaded" so we don't wait forever
    setLoadedImageCount(prev => prev + 1);
    console.warn('[ArtifactPrintPage] Image failed to load');
  };

  if (loading || !artifact || !patent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  const meta = ARTIFACT_TYPES[artifact.type as keyof typeof ARTIFACT_TYPES];
  const sectionCount = countSections(artifact.content);
  const images = artifact.images || [];

  return (
    <div className="min-h-screen bg-white">
      {/* Cover page */}
      <div className="pdf-cover-page relative">
        <div className="absolute inset-0 bg-white" />

        <div className="relative flex flex-col items-center justify-center min-h-screen px-12 py-16">
          {/* Branding */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
              IPScaffold
            </h1>
            <p className="text-center text-sm text-gray-500 mt-2 font-mono">
              Patent Intelligence Platform
            </p>
          </div>

          {/* Artifact Type Badge */}
          <div className="mb-8">
            <div className={`inline-flex items-center gap-3 px-6 py-3 border-2 ${meta.borderColor} ${meta.bgColor}`}>
              <span className="text-2xl">{meta.emoji}</span>
              <span className={`font-mono text-lg font-bold ${meta.color} uppercase tracking-wider`}>
                {meta.label}
              </span>
            </div>
          </div>

          {/* Patent Title */}
          <div className="mb-8 text-center max-w-4xl">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
              {patent.friendlyTitle || patent.title || 'Untitled Patent'}
            </h2>
            {patent.assignee && (
              <p className="text-xl text-gray-600 mb-2">
                {patent.assignee}
              </p>
            )}
          </div>

          {/* Publication Number */}
          {patent.publication_number && (
            <div className="mb-8">
              <div className="inline-flex items-center gap-3 bg-white px-6 py-3 border-2 border-red-600 shadow-lg">
                <span className="font-mono text-sm font-bold text-red-600 uppercase tracking-wider">
                  Publication No.
                </span>
                <span className="font-mono text-lg font-bold text-gray-900">
                  {patent.publication_number}
                </span>
              </div>
            </div>
          )}

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

      {/* Artifact Content */}
      <div
        className="print-artifact"
        data-artifact-content
        data-images-loaded={imagesLoaded.toString()}
        data-image-count={images.length}
      >
        <div className="relative bg-white shadow-lg overflow-hidden">
          {/* Top accent line */}
          <div className="h-[3px] bg-gradient-to-r from-[#2563eb] via-[#059669] to-[#dc2626]" />

          <div className="relative z-10 p-6 md:p-12">
            {/* Artifact Header */}
            <ArtifactHeader
              artifactNumber={1}
              totalArtifacts={1}
              artifactLabel={meta.label}
              artifactTitle={meta.tagline}
              hasImages={images.length > 0}
              imageCount={images.length}
              totalSections={sectionCount}
              generating={false}
              onGenerateImages={() => {}}
            />

            {/* Content with Images */}
            <EnhancedMarkdownRenderer
              content={artifact.content}
              images={images}
              generating={false}
              onRegenerateImage={undefined}
              onUpdateImagePrompt={undefined}
              isAdmin={false}
              printMode={true}
              onImageLoad={handleImageLoad}
              onImageError={handleImageError}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
