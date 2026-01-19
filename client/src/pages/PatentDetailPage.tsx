import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { api, type Artifact } from '@/lib/api';
import { ArrowLeft, RefreshCw, AlertCircle, Lightbulb, TrendingUp, Target, Loader2 } from 'lucide-react';
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

export function PatentDetailPage() {
  const [, params] = useRoute('/patent/:id');
  const [, setLocation] = useLocation();
  const [patent, setPatent] = useState<any>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('elia15');
  const { toast } = useToast();
  const { profile } = useAuth();

  // Get current artifact based on active tab
  const currentArtifact = artifacts.find(a => a.type === activeTab);

  // Use image hook for current artifact
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

  const loadPatent = async (id: string) => {
    try {
      const data = await api.getPatentDetail(id);
      setPatent(data.patent);
      setArtifacts(data.artifacts);

      // Set default active tab to first available artifact
      if (data.artifacts.length > 0) {
        setActiveTab(data.artifacts[0].type);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load patent details',
        variant: 'destructive',
      });
      setLocation('/dashboard');
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
      elia15_complete: { text: 'Generating...', variant: 'secondary' },
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
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-6">
          <button
            onClick={() => setLocation('/dashboard')}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary-900 transition-colors mb-6"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
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
                    <div>
                      <span className="font-medium text-primary-900">Artifacts Generated</span>
                      <p className="text-muted-foreground">{artifacts.length} / 3</p>
                    </div>
                  </div>

                  {(patent.status === 'failed' || patent.status === 'partial') && (
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
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              {artifacts.length === 0 && patent.status !== 'failed' && patent.status !== 'partial' ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-primary-900 border-t-transparent rounded-full mx-auto mb-4" />
                    <h3 className="font-display text-xl font-bold text-primary-900 mb-2">Generating artifacts...</h3>
                    <p className="text-muted-foreground">Your analysis is being generated. Check back soon.</p>
                  </CardContent>
                </Card>
              ) : artifacts.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="font-display text-xl font-bold text-primary-900 mb-2">No artifacts available</h3>
                    <p className="text-muted-foreground">Processing failed. Use the retry button to try again.</p>
                  </CardContent>
                </Card>
              ) : (
                <Tabs defaultValue={defaultTab} className="w-full">
                  <TabsList className="w-full grid grid-cols-3 mb-6">
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
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                          <span className="hidden sm:inline">{meta.label}</span>
                          <span className="sm:hidden">{meta.emoji}</span>
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
                          {/* Graph paper overlay */}
                          <div
                            className="absolute inset-0 pointer-events-none opacity-50"
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
