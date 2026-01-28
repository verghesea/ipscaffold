import { useEffect, useState, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { api, type Artifact } from '@/lib/api';
import { ArrowLeft, RefreshCw, AlertCircle, Lightbulb, TrendingUp, Target, Loader2, Download, FileDown } from 'lucide-react';
import { analytics } from '@/lib/analytics';
import { Layout } from '@/components/layout/Layout';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EnhancedMarkdownRenderer } from '@/components/patent/EnhancedMarkdownRenderer';
import { ArtifactHeader } from '@/components/patent/ArtifactHeader';
import { useSectionImages } from '@/hooks/useSectionImages';
import { countSections } from '@/lib/markdownParser';
import { GenerationProgress } from '@/components/patent/GenerationProgress';
import { ProfileCompletionModal } from '@/components/ProfileCompletionModal';
import { PDFCoverPage } from '@/components/patent/PDFCoverPage';

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

// Component to render an artifact with its images in print mode
function PrintArtifactSection({
  artifact,
  artifactIndex,
  meta,
  onRegenerateImage,
  onUpdateImagePrompt
}: {
  artifact: Artifact;
  artifactIndex: number;
  meta: typeof ARTIFACT_TYPES[keyof typeof ARTIFACT_TYPES];
  onRegenerateImage: (sectionNumber: number) => Promise<void>;
  onUpdateImagePrompt: (imageId: string, newPrompt: string) => Promise<void>;
}) {
  // Load images for this specific artifact
  const { images, loading } = useSectionImages(artifact.id);
  const sectionCount = countSections(artifact.content);

  return (
    <div
      className="print-artifact mt-6"
      data-artifact-content
      data-images-loaded={!loading}
      data-image-count={images.length}
    >
      {/* Graph paper background container */}
      <div className="relative bg-white shadow-lg overflow-hidden">
        {/* Graph paper overlay - hidden in print mode via CSS class */}
        <div
          className="graph-paper-overlay absolute inset-0 pointer-events-none opacity-50"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px),
              linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)
            `,
            backgroundSize: '10px 10px, 10px 10px, 50px 50px, 50px 50px',
          }}
        />

        {/* Top accent line (4-color gradient) */}
        <div className="h-[3px] bg-gradient-to-r from-[#2563eb] via-[#059669] to-[#dc2626]" />

        <div className="relative z-10 p-6 md:p-12">
          {/* Artifact Header */}
          <ArtifactHeader
            artifactNumber={artifactIndex + 1}
            totalArtifacts={3}
            artifactLabel={meta.label}
            artifactTitle={meta.tagline}
            hasImages={images.length > 0}
            imageCount={images.length}
            totalSections={sectionCount}
            generating={false}
            onGenerateImages={() => {}}
          />

          {/* Enhanced Markdown Renderer with Images */}
          <EnhancedMarkdownRenderer
            content={artifact.content}
            images={images}  // Pass actual loaded images
            generating={false}
            onRegenerateImage={undefined}
            onUpdateImagePrompt={undefined}
            isAdmin={false}
            printMode={true}  // Use Humble watermark in print mode
          />
        </div>
      </div>
    </div>
  );
}

export function PatentDetailPage() {
  const [, params] = useRoute('/patent/:id');
  const [, setLocation] = useLocation();
  const [patent, setPatent] = useState<any>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [downloadingPackage, setDownloadingPackage] = useState(false);
  const [downloadingArtifact, setDownloadingArtifact] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('elia15');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [heroImageUrl, setHeroImageUrl] = useState<string | undefined>(undefined);
  const hasShownProfileModal = useRef(false);
  const { toast } = useToast();
  const { user, profile, refetch: refetchUser } = useAuth();

  // Check if we're in print mode (for PDF generation)
  const isPrintMode = new URLSearchParams(window.location.search).get('print') === 'true';

  // Get current artifact based on active tab
  const currentArtifact = artifacts.find(a => a.type === activeTab);

  // Use image hook for current artifact (normal mode only)
  const {
    images,
    loading: imagesLoading,
    generating,
    generateImages,
    regenerateImage,
  } = useSectionImages(currentArtifact?.id);

  // Calculate section count
  const sectionCount = currentArtifact
    ? countSections(currentArtifact.content)
    : 0;

  useEffect(() => {
    if (params?.id) {
      loadPatent(params.id);
    }
  }, [params?.id]);

  // Apply print mode class to body when in print mode
  useEffect(() => {
    if (isPrintMode) {
      document.body.classList.add('print-mode');
      return () => document.body.classList.remove('print-mode');
    }
  }, [isPrintMode]);

  // Show profile completion modal when patent is completed and user hasn't completed their profile
  useEffect(() => {
    if (
      patent?.status === 'completed' &&
      user &&
      !user.profileCompleted &&
      !user.displayName &&
      !hasShownProfileModal.current
    ) {
      // Small delay to let the user see the completed analysis first
      const timer = setTimeout(() => {
        setShowProfileModal(true);
        hasShownProfileModal.current = true;
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [patent?.status, user]);

  const loadPatent = async (id: string) => {
    try {
      let data;

      if (isPrintMode) {
        // Print mode: use direct fetch with token
        const printToken = new URLSearchParams(window.location.search).get('token');
        const url = printToken
          ? `/api/patent/${id}?token=${encodeURIComponent(printToken)}`
          : `/api/patent/${id}`;

        console.log('[PatentDetailPage] Print mode loading');
        console.log('[PatentDetailPage] URL:', url);

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to load patent: ${response.status}`);
        }

        data = await response.json();
      } else {
        // Normal mode: use API helper (includes auth headers)
        console.log('[PatentDetailPage] Normal mode loading patent:', id);
        data = await api.getPatentDetail(id);
      }

      setPatent(data.patent);
      setArtifacts(data.artifacts);

      // Fetch hero image in print mode for cover page
      if (isPrintMode) {
        try {
          const heroResponse = await fetch(`/api/patent/${id}/hero-image`);
          if (heroResponse.ok) {
            const heroData = await heroResponse.json();
            setHeroImageUrl(heroData.image_url);
          }
        } catch (error) {
          console.error('[Print Mode] Failed to load hero image:', error);
          // Continue without hero image
        }
      }

      // Set default active tab to first available artifact
      if (data.artifacts.length > 0) {
        setActiveTab(data.artifacts[0].type);
      }
    } catch (error) {
      if (!isPrintMode) {
        // Only show toast and redirect in normal mode, not print mode
        toast({
          title: 'Error',
          description: 'Failed to load patent details',
          variant: 'destructive',
        });
        setLocation('/dashboard');
      } else {
        console.error('[Print Mode] Failed to load patent:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!params?.id) return;
    setRetrying(true);
    try {
      await api.retryPatent(params.id);
      toast({
        title: 'Retry Started',
        description: 'Processing has been restarted. Check back shortly.'
      });
      loadPatent(params.id);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to retry processing',
        variant: 'destructive'
      });
    } finally {
      setRetrying(false);
    }
  };

  const handleDownloadPackage = async () => {
    if (!params?.id) return;
    setDownloadingPackage(true);
    try {
      await api.downloadPatentPackagePDF(params.id);
      toast({
        title: 'Download Started',
        description: 'Your complete patent analysis package is downloading.',
      });
      analytics.trackDownload('patent_package', params.id);
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Could not generate PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingPackage(false);
    }
  };

  const handleDownloadArtifact = async (artifactId: string, artifactType: string) => {
    setDownloadingArtifact(true);
    try {
      await api.downloadArtifactPDF(artifactId, artifactType);
      toast({
        title: 'Download Started',
        description: `Your ${ARTIFACT_TYPES[artifactType as keyof typeof ARTIFACT_TYPES]?.label || artifactType} is downloading.`,
      });
      analytics.trackDownload('artifact', artifactId);
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Could not generate PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingArtifact(false);
    }
  };

  const handleGenerateImages = async () => {
    const result = await generateImages();
    if (result?.success) {
      toast({
        title: 'Images Generated!',
        description: `Created ${result.imagesGenerated} images${result.costEstimate ? ` (Cost: $${result.costEstimate.costUSD.toFixed(2)})` : ''}`,
      });
    } else if (result?.errors?.length) {
      toast({
        title: 'Partial Success',
        description: `Generated ${result.imagesGenerated} images, ${result.errors.length} failed`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Generation Failed',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleRegenerateImage = async (sectionNumber: number) => {
    const result = await regenerateImage(sectionNumber);
    if (result) {
      toast({ title: 'Image regenerated successfully' });
    } else {
      toast({
        title: 'Regeneration failed',
        description: 'Please try again',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateImagePrompt = async (imageId: string, newPrompt: string) => {
    try {
      const updatedImage = await api.updateImagePrompt(imageId, newPrompt);
      toast({ title: 'Image regenerated with new prompt' });
      // Refresh images to show the updated image
      if (currentArtifact?.id) {
        // Force a refresh of images
        window.location.reload();
      }
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'Failed to regenerate image with new prompt',
        variant: 'destructive'
      });
      throw error;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin w-8 h-8 border-2 border-primary-900 border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground">Loading patent...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!patent) return null;

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      processing: { text: 'Processing', variant: 'secondary' },
      elia15_complete: { text: 'Scientific Narrative Complete', variant: 'secondary' },
      completed: { text: 'Complete', variant: 'default' },
      failed: { text: 'Failed', variant: 'destructive' },
      partial: { text: 'Partial', variant: 'outline' },
    };
    const config = configs[status] || configs.processing;
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const defaultTab = artifacts.length > 0 ? artifacts[0].type : 'elia15';

  return (
    <Layout>
      {/* Profile completion modal */}
      <ProfileCompletionModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onComplete={() => {
          refetchUser();
          setShowProfileModal(false);
        }}
      />

      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-6">
          {!isPrintMode && (
            <button
              onClick={() => setLocation('/dashboard')}
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary-900 transition-colors mb-6 no-print"
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            {!isPrintMode && (
              <div className="lg:col-span-1 sidebar">
                <Card className="sticky top-24">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    {patent.friendlyTitle ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CardTitle className="font-display text-xl leading-tight cursor-help" data-testid="text-patent-title">
                              {patent.friendlyTitle}
                            </CardTitle>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-md">
                            <p className="text-xs font-mono">{patent.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <CardTitle className="font-display text-xl leading-tight" data-testid="text-patent-title">
                        {patent.title || 'Untitled Patent'}
                      </CardTitle>
                    )}
                    {getStatusBadge(patent.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {patent.patentNumber && (
                    <div className="pb-4 border-b">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Patent Number</span>
                      <div className="mt-1">
                        <Badge variant="secondary" className="font-mono text-sm">
                          {patent.patentNumber}
                        </Badge>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 text-sm">
                    {patent.inventors && (
                      <div>
                        <span className="font-medium text-primary-900">Inventors</span>
                        <p className="text-muted-foreground">{patent.inventors}</p>
                      </div>
                    )}
                    {patent.assignee && (
                      <div>
                        <span className="font-medium text-primary-900">Assignee</span>
                        <p className="text-muted-foreground">{patent.assignee}</p>
                      </div>
                    )}
                    {patent.filingDate && (
                      <div>
                        <span className="font-medium text-primary-900">Filing Date</span>
                        <p className="text-muted-foreground">{patent.filingDate}</p>
                      </div>
                    )}
                    {patent.applicationNumber && (
                      <div>
                        <span className="font-medium text-primary-900">Application Number</span>
                        <p className="text-muted-foreground font-mono text-xs">{patent.applicationNumber}</p>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-primary-900">Artifacts Generated</span>
                      <p className="text-muted-foreground">{artifacts.length} / 3</p>
                    </div>
                  </div>

                  {/* Download Complete Package Button */}
                  {artifacts.length > 0 && (
                    <div className="pt-4 border-t">
                      <Button
                        onClick={handleDownloadPackage}
                        disabled={downloadingPackage}
                        variant="outline"
                        className="w-full"
                        data-testid="button-download-package"
                      >
                        {downloadingPackage ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating PDF...
                          </>
                        ) : (
                          <>
                            <FileDown className="w-4 h-4 mr-2" />
                            Download Complete Package
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Download all artifacts as a single PDF
                      </p>
                    </div>
                  )}

                  {(patent.status === 'failed' || patent.status === 'partial' || (patent.status === 'processing' && artifacts.length === 0)) && (
                    <div className="pt-4 border-t">
                      <Button
                        onClick={handleRetry}
                        disabled={retrying}
                        variant="destructive"
                        className="w-full"
                        data-testid="button-retry"
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
                        {retrying ? 'Retrying...' : 'Retry Processing'}
                      </Button>
                      {patent.status === 'processing' && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Patent appears stuck. Click retry to restart generation.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            )}

            <div className={isPrintMode ? 'col-span-full' : 'lg:col-span-2'} data-patent-content>
              {artifacts.length === 0 && patent.status !== 'failed' && patent.status !== 'partial' ? (
                <>
                  {params?.id && <GenerationProgress patentId={params.id} onComplete={() => loadPatent(params.id)} />}
                  <Card>
                    <CardContent className="py-16 text-center">
                      <div className="animate-spin w-8 h-8 border-2 border-primary-900 border-t-transparent rounded-full mx-auto mb-4" />
                      <h3 className="font-display text-xl font-bold text-primary-900 mb-2">Generating artifacts...</h3>
                      <p className="text-muted-foreground">Your analysis is being generated. Check back soon.</p>
                    </CardContent>
                  </Card>
                </>
              ) : artifacts.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="font-display text-xl font-bold text-primary-900 mb-2">No artifacts available</h3>
                    <p className="text-muted-foreground">Processing failed. Use the retry button to try again.</p>
                  </CardContent>
                </Card>
              ) : isPrintMode ? (
                <>
                  {/* PDF Cover Page */}
                  <PDFCoverPage
                    patent={patent}
                    heroImageUrl={heroImageUrl}
                    description={(() => {
                      // Extract first paragraph from ELIA15 artifact as description
                      const elia15 = artifacts.find(a => a.type === 'elia15');
                      if (!elia15) return undefined;
                      const firstParagraph = elia15.content.split('\n\n')[0];
                      return firstParagraph?.replace(/^#+\s+/, '').trim();
                    })()}
                  />

                  {/* Print mode: Show all artifacts stacked vertically with images */}
                  <div className="space-y-12">
                    {(Object.entries(ARTIFACT_TYPES) as [keyof typeof ARTIFACT_TYPES, typeof ARTIFACT_TYPES[keyof typeof ARTIFACT_TYPES]][]).map(([key, meta], artifactIndex) => {
                      const artifact = artifacts.find(a => a.type === key);
                      if (!artifact) return null;

                    return (
                      <PrintArtifactSection
                        key={key}
                        artifact={artifact}
                        artifactIndex={artifactIndex}
                        meta={meta}
                        onRegenerateImage={handleRegenerateImage}
                        onUpdateImagePrompt={handleUpdateImagePrompt}
                      />
                    );
                  })}
                  </div>
                </>
              ) : (
                // Normal mode: Show tabs
                <Tabs defaultValue={defaultTab} className="w-full">
                  <TabsList className="w-full grid grid-cols-3 mb-6 no-print">
                    {(Object.entries(ARTIFACT_TYPES) as [keyof typeof ARTIFACT_TYPES, typeof ARTIFACT_TYPES[keyof typeof ARTIFACT_TYPES]][]).map(([key, meta]) => {
                      const Icon = meta.icon;
                      const hasArtifact = artifacts.some(a => a.type === key);
                      return (
                        <TabsTrigger
                          key={key}
                          value={key}
                          disabled={!hasArtifact}
                          className="flex items-center gap-2 data-[state=active]:border-b-2"
                          data-testid={`tab-${key}`}
                          onClick={() => {
                            analytics.trackArtifactView(key);
                            setActiveTab(key);
                          }}
                        >
                          <Icon className={`w-4 h-4 ${meta.color} hidden sm:inline`} />
                          <span className="hidden sm:inline">{meta.label}</span>
                          <span className="sm:hidden text-xl">{meta.emoji}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {(Object.entries(ARTIFACT_TYPES) as [keyof typeof ARTIFACT_TYPES, typeof ARTIFACT_TYPES[keyof typeof ARTIFACT_TYPES]][]).map(([key, meta]) => {
                    const artifact = artifacts.find(a => a.type === key);
                    const artifactIndex = Object.keys(ARTIFACT_TYPES).indexOf(key);

                    return (
                      <TabsContent key={key} value={key} className="mt-6">
                        {/* Graph paper background container */}
                        <div className="relative bg-white shadow-lg overflow-hidden">
                          {/* Graph paper overlay - hidden in print mode via CSS class */}
                          <div
                            className="graph-paper-overlay absolute inset-0 pointer-events-none opacity-50"
                            style={{
                              backgroundImage: `
                                linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px),
                                linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)
                              `,
                              backgroundSize: '10px 10px, 10px 10px, 50px 50px, 50px 50px',
                            }}
                          />

                          {/* Top accent line (4-color gradient) */}
                          <div className="h-[3px] bg-gradient-to-r from-[#2563eb] via-[#059669] to-[#dc2626]" />

                          <div className="relative z-10 p-6 md:p-12">
                            {artifact ? (
                              <>
                                {/* Artifact Header with Generate Button */}
                                <ArtifactHeader
                                  artifactNumber={artifactIndex + 1}
                                  totalArtifacts={3}
                                  artifactLabel={meta.label}
                                  artifactTitle={meta.tagline}
                                  hasImages={images.length > 0}
                                  imageCount={images.length}
                                  totalSections={sectionCount}
                                  generating={generating}
                                  onGenerateImages={handleGenerateImages}
                                />

                                {/* Download This Artifact Button */}
                                <div className="flex justify-end mb-4 no-print">
                                  <Button
                                    onClick={() => artifact?.id && handleDownloadArtifact(artifact.id, key as string)}
                                    disabled={downloadingArtifact || !artifact?.id}
                                    variant="outline"
                                    size="sm"
                                  >
                                    {downloadingArtifact ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generating...
                                      </>
                                    ) : (
                                      <>
                                        <Download className="w-4 h-4 mr-2" />
                                        Download PDF
                                      </>
                                    )}
                                  </Button>
                                </div>

                                {/* Enhanced Markdown Renderer with Images */}
                                <EnhancedMarkdownRenderer
                                  content={artifact.content}
                                  images={images}
                                  generating={generating}
                                  onRegenerateImage={handleRegenerateImage}
                                  onUpdateImagePrompt={handleUpdateImagePrompt}
                                  isAdmin={profile?.is_admin || false}
                                />
                              </>
                            ) : (
                              <Card className="text-center py-8">
                                <CardContent>
                                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-2" />
                                  <p className="text-sm text-muted-foreground">
                                    Generating {meta.label}...
                                  </p>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
