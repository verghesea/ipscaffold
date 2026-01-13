import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { api, type Artifact, getAuthHeaders } from '@/lib/api';
import { ArrowLeft, RefreshCw, AlertCircle, Lightbulb, TrendingUp, Target, Download } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SectionImage {
  id: string;
  artifactId: string;
  sectionHeading: string;
  sectionOrder: number;
  imageUrl: string;
  dallePrompt: string;
  imageSize: string | null;
  generationCost: string | null;
  createdAt: string;
}

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
        }).then(res => res.json()),
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

  const handleExport = (format: 'pdf' | 'docx' | 'txt') => {
    if (!params?.id) return;
    const url = `/api/patent/${params.id}/export/${format}`;
    window.open(url, '_blank');
    toast({
      title: 'Export Started',
      description: `Your ${format.toUpperCase()} download will begin shortly.`,
    });
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

  const artifactConfig: Record<string, { label: string; icon: React.ElementType; description: string }> = {
    elia15: { 
      label: 'ELIA15', 
      icon: Lightbulb,
      description: 'Explained Like I Am 15 - A simplified explanation of the patent'
    },
    business_narrative: { 
      label: 'Business Narrative', 
      icon: TrendingUp,
      description: 'Investor-ready pitch content for commercialization'
    },
    golden_circle: { 
      label: 'Golden Circle', 
      icon: Target,
      description: "Strategic WHY/HOW/WHAT framework based on Simon Sinek's methodology"
    },
  };

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
                    {patent.patentNumber && (
                      <div>
                        <span className="font-medium text-primary-900">Patent Number</span>
                        <p className="text-muted-foreground font-mono">{patent.patentNumber}</p>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-primary-900">Artifacts Generated</span>
                      <p className="text-muted-foreground">{artifacts.length} / 3</p>
                    </div>
                  </div>

                  {patent.status === 'completed' && artifacts.length > 0 && (
                    <div className="pt-4 border-t">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full gap-2" data-testid="button-export">
                            <Download className="w-4 h-4" />
                            Export
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center">
                          <DropdownMenuItem onClick={() => handleExport('pdf')}>
                            Export as PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport('docx')}>
                            Export as DOCX
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport('txt')}>
                            Export as TXT
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}

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
                    {['elia15', 'business_narrative', 'golden_circle'].map((type) => {
                      const config = artifactConfig[type];
                      const hasArtifact = artifacts.some(a => a.type === type);
                      const Icon = config.icon;
                      return (
                        <TabsTrigger 
                          key={type} 
                          value={type} 
                          disabled={!hasArtifact}
                          className="flex items-center gap-2"
                          data-testid={`tab-${type}`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="hidden sm:inline">{config.label}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {artifacts.map((artifact) => {
                    const config = artifactConfig[artifact.type] || { 
                      label: artifact.type, 
                      icon: Lightbulb,
                      description: '' 
                    };
                    const Icon = config.icon;

                    return (
                      <TabsContent key={artifact.type} value={artifact.type}>
                        <Card data-testid={`artifact-${artifact.type}`}>
                          <CardHeader className="border-b">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary-100 rounded-lg">
                                <Icon className="w-5 h-5 text-primary-900" />
                              </div>
                              <div>
                                <CardTitle className="font-display text-xl">{config.label}</CardTitle>
                                <p className="text-sm text-muted-foreground">{config.description}</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-6 md:p-8">
                            <ScrollArea className="max-h-[600px] pr-4">
                              <div className="prose prose-lg max-w-none">
                                <MarkdownRenderer
                                  content={artifact.content}
                                  images={images
                                    .filter(img => img.artifactId === artifact.id)
                                    .map(img => ({
                                      sectionHeading: img.sectionHeading,
                                      imageUrl: img.imageUrl,
                                    }))}
                                />
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
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
