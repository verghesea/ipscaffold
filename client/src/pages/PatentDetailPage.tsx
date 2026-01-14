import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { api, type Artifact, getAuthHeaders } from '@/lib/api';
import { ArrowLeft, RefreshCw, AlertCircle, Lightbulb, TrendingUp, Target, Loader2 } from 'lucide-react';
import { analytics } from '@/lib/analytics';
import { Layout } from '@/components/layout/Layout';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

interface SectionImage {
  id: string;
  artifactId: string;
  sectionHeading: string;
  sectionOrder: number;
  imageUrl: string;
  dallePrompt: string;
}

const ARTIFACT_TYPES = {
  elia15: {
    icon: Lightbulb,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    label: 'ELIA15',
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
  const [images, setImages] = useState<SectionImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (params?.id) {
      loadPatent(params.id);
    }
  }, [params?.id]);

  const loadPatent = async (id: string) => {
    try {
      const [patentData, imagesData] = await Promise.all([
        api.getPatentDetail(id),
        fetch(`/api/patent/${id}/images`, {
          headers: getAuthHeaders(),
        }).then(res => res.ok ? res.json() : { images: [] }),
      ]);
      
      setPatent(patentData.patent);
      setArtifacts(patentData.artifacts);
      setImages(imagesData.images || []);
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

  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('# ')) {
        return (
          <h2 key={i} className="text-2xl font-display font-bold text-primary-900 mt-8 mb-4 first:mt-0">
            {line.replace('# ', '')}
          </h2>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h3 key={i} className="text-xl font-display font-bold text-primary-900 mt-6 mb-3">
            {line.replace('## ', '')}
          </h3>
        );
      }
      if (line.startsWith('### ')) {
        return (
          <h4 key={i} className="text-lg font-display font-semibold text-primary-900 mt-4 mb-2">
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.trim().startsWith('- ')) {
        return (
          <li key={i} className="ml-6 mb-2 text-muted-foreground leading-relaxed">
            {line.replace(/^[\s]*- /, '')}
          </li>
        );
      }
      if (line.trim().match(/^\d+\./)) {
        return (
          <li key={i} className="ml-6 mb-2 text-muted-foreground leading-relaxed list-decimal">
            {line.replace(/^\d+\.\s*/, '')}
          </li>
        );
      }
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <p key={i} className="mb-3 font-semibold text-primary-900 leading-relaxed">
            {line.replace(/\*\*/g, '')}
          </p>
        );
      }
      return (
        <p key={i} className="mb-3 text-muted-foreground leading-relaxed">
          {line}
        </p>
      );
    });
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
                    <CardTitle className="font-display text-xl leading-tight" data-testid="text-patent-title">
                      {patent.title || 'Untitled Patent'}
                    </CardTitle>
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
                          onClick={() => analytics.trackArtifactView(key)}
                        >
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                          <span className="hidden sm:inline">{meta.label}</span>
                          <span className="sm:hidden">{meta.emoji}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {(Object.entries(ARTIFACT_TYPES) as [keyof typeof ARTIFACT_TYPES, typeof ARTIFACT_TYPES[keyof typeof ARTIFACT_TYPES]][]).map(([key, meta]) => {
                    const Icon = meta.icon;
                    const artifact = artifacts.find(a => a.type === key);

                    return (
                      <TabsContent key={key} value={key} className="mt-6">
                        <div className={`${meta.bgColor} ${meta.borderColor} border-l-4 rounded-lg p-4 mb-4`}>
                          <div className="flex items-start gap-3">
                            <Icon className={`w-6 h-6 ${meta.color} mt-1`} />
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{meta.tagline}</p>
                              <h3 className={`text-lg font-semibold ${meta.color} font-playfair`}>
                                {meta.label}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">{meta.description}</p>
                            </div>
                          </div>
                        </div>

                        {artifact ? (
                          <Card data-testid={`artifact-${key}`}>
                            <CardContent className="p-0">
                              <div className="max-h-[600px] overflow-y-auto px-6 py-6 md:px-8 md:py-8 scrollbar-thin">
                                <MarkdownRenderer 
                                  content={artifact.content} 
                                  images={images.filter(img => img.artifactId === artifact.id)}
                                />
                              </div>
                            </CardContent>
                          </Card>
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
