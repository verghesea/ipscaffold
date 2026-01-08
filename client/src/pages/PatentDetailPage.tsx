import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { api, type Artifact } from '@/lib/api';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useToast } from '@/hooks/use-toast';

export function PatentDetailPage() {
  const [, params] = useRoute('/patent/:id');
  const [, setLocation] = useLocation();
  const [patent, setPatent] = useState<any>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (params?.id) {
      loadPatent(parseInt(params.id));
    }
  }, [params?.id]);

  const loadPatent = async (id: number) => {
    try {
      const data = await api.getPatentDetail(id);
      setPatent(data.patent);
      setArtifacts(data.artifacts);
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

  const artifactLabels: Record<string, string> = {
    elia15: 'ELIA15 Explanation',
    business_narrative: 'Business Narrative',
    golden_circle: 'Golden Circle Framework',
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background py-12">
        <div className="container mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => setLocation('/dashboard')}
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary-900 transition-colors mb-6"
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>

            <div className="space-y-4">
              <h1 className="font-display text-4xl md:text-5xl font-bold text-primary-900 leading-tight" data-testid="text-patent-title">
                {patent.title || 'Untitled Patent'}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {patent.inventors && (
                  <p>
                    <span className="font-medium">Inventors:</span> {patent.inventors}
                  </p>
                )}
                {patent.assignee && (
                  <span className="px-1">•</span>
                )}
                {patent.assignee && (
                  <p>
                    <span className="font-medium">Assignee:</span> {patent.assignee}
                  </p>
                )}
                {patent.filingDate && (
                  <>
                    <span className="px-1">•</span>
                    <p>
                      <span className="font-medium">Filed:</span> {patent.filingDate}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Artifacts */}
          <div className="space-y-12">
            {artifacts.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-lg">
                <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-display text-2xl font-bold text-primary-900 mb-2">Generating artifacts...</h3>
                <p className="text-muted-foreground">Your analysis is being generated. Check back soon.</p>
              </div>
            ) : (
              artifacts.map((artifact, index) => (
                <div key={artifact.type} className="space-y-6">
                  {/* Artifact Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                        Artifact {String(index + 1).padStart(2, '0')} / {artifacts.length.toString().padStart(2, '0')}
                      </span>
                      <div className="h-px bg-border flex-1 w-24" />
                    </div>
                  </div>

                  {/* Artifact Content */}
                  <div className="bg-card border border-border p-8 md:p-12" data-testid={`artifact-${artifact.type}`}>
                    <h2 className="font-display text-3xl font-bold text-primary-900 mb-8">
                      {artifactLabels[artifact.type] || artifact.type}
                    </h2>
                    
                    <div className="prose prose-lg max-w-none prose-headings:font-display prose-headings:text-primary-900 prose-p:text-muted-foreground prose-strong:text-primary-900">
                      {artifact.content.split('\n').map((line, i) => {
                        if (line.startsWith('# ')) return <h2 key={i} className="text-2xl font-bold mt-8 mb-4">{line.replace('# ', '')}</h2>;
                        if (line.startsWith('## ')) return <h3 key={i} className="text-xl font-bold mt-6 mb-3">{line.replace('## ', '')}</h3>;
                        if (line.startsWith('### ')) return <h4 key={i} className="text-lg font-bold mt-4 mb-2">{line.replace('### ', '')}</h4>;
                        if (line.trim().startsWith('- ')) return <li key={i} className="ml-6 mb-2">{line.replace(/^- /, '')}</li>;
                        if (line.trim() === '') return <br key={i} />;
                        return <p key={i} className="mb-4 leading-relaxed">{line}</p>;
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
