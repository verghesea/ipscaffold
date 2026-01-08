import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { api, type Patent } from '@/lib/api';
import { FileText, Clock, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useToast } from '@/hooks/use-toast';

export function DashboardPage() {
  const [, setLocation] = useLocation();
  const [patents, setPatents] = useState<Patent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const data = await api.getDashboard();
      setPatents(data.patents);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load dashboard',
        variant: 'destructive',
      });
      setLocation('/');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      processing: { icon: Clock, text: 'Processing', className: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
      elia15_complete: { icon: Clock, text: 'Generating...', className: 'text-blue-600 bg-blue-50 border-blue-200' },
      completed: { icon: CheckCircle, text: 'Complete', className: 'text-green-600 bg-green-50 border-green-200' },
      failed: { icon: AlertCircle, text: 'Failed', className: 'text-red-600 bg-red-50 border-red-200' },
    };
    
    const config = configs[status as keyof typeof configs] || configs.processing;
    const Icon = config.icon;
    
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${config.className}`}>
        <Icon className="w-3 h-3" />
        {config.text}
      </div>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin w-8 h-8 border-2 border-primary-900 border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background py-12">
        <div className="container mx-auto px-6">
          {/* Header */}
          <div className="mb-12 space-y-4">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-primary-900" data-testid="text-dashboard-title">
              Your Patents
            </h1>
            <p className="text-muted-foreground text-lg">
              View and manage all your patent analyses
            </p>
          </div>

          {/* Patents Grid */}
          {patents.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-lg">
              <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-display text-2xl font-bold text-primary-900 mb-2">No patents yet</h3>
              <p className="text-muted-foreground mb-6">Upload your first patent to get started</p>
              <button
                onClick={() => setLocation('/')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-900 text-white hover:bg-primary-800 transition-colors"
                data-testid="button-upload-first"
              >
                Upload Patent
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {patents.map((patent) => (
                <div
                  key={patent.id}
                  onClick={() => setLocation(`/patent/${patent.id}`)}
                  className="bg-card border border-border hover:border-accent-400/50 p-6 space-y-4 transition-all cursor-pointer group"
                  data-testid={`card-patent-${patent.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-display text-xl font-bold text-primary-900 group-hover:text-primary-700 transition-colors line-clamp-2" data-testid={`text-title-${patent.id}`}>
                        {patent.title || 'Untitled Patent'}
                      </h3>
                    </div>
                    {getStatusBadge(patent.status)}
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    {patent.assignee && (
                      <p className="line-clamp-1">
                        <span className="font-medium">Assignee:</span> {patent.assignee}
                      </p>
                    )}
                    {patent.filingDate && (
                      <p>
                        <span className="font-medium">Filed:</span> {patent.filingDate}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Artifacts:</span> {patent.artifactCount || 0} / 3
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(patent.createdAt || '').toLocaleDateString()}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary-900 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
