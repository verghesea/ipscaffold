import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { api } from '@/lib/api';
import { ArrowRight, Lock, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/layout/Layout';

export function PreviewPage() {
  const [, params] = useRoute('/preview/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patent, setPatent] = useState<any>(null);
  const [elia15, setElia15] = useState<string | null>(null);
  const [showEmailGate, setShowEmailGate] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params?.id) {
      loadPreview(params.id);
    }
  }, [params?.id]);

  const loadPreview = async (id: string) => {
    try {
      const data = await api.getPreview(id);
      setPatent(data.patent);
      setElia15(data.elia15);
      setShowEmailGate(data.showEmailGate);
      setLoading(false);

      // If patent completed and user logged in, redirect to detail
      if (data.patent.status === 'completed' && !data.showEmailGate) {
        setLocation(`/patent/${id}`);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load preview',
        variant: 'destructive',
      });
      setLocation('/');
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await api.requestMagicLink(email, params?.id);
      toast({
        title: 'Success!',
        description: 'Check your email for a magic link to access your full analysis.',
      });
      setEmail('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send magic link',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary-900 mx-auto" />
            <p className="text-muted-foreground">Loading preview...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!patent || !elia15) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary-900 mx-auto" />
            <p className="text-muted-foreground">Generating analysis...</p>
            <p className="text-sm text-muted-foreground/60">This usually takes 30-60 seconds</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="bg-secondary border-b border-border py-12">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="inline-flex items-center gap-2 text-accent-600 text-xs font-mono uppercase tracking-widest">
                <Check className="w-3 h-3" /> Analysis Complete
              </div>
              <h1 className="font-display font-bold text-3xl md:text-4xl text-primary-900 leading-tight" data-testid="text-patent-title">
                {patent.title}
              </h1>
              <p className="text-muted-foreground text-sm">
                {patent.filingDate && `Filed: ${patent.filingDate}`}
                {patent.assignee && ` • Assignee: ${patent.assignee}`}
              </p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 mt-12">
          <div className="max-w-3xl mx-auto">
            {/* ELIA15 Content */}
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150" data-testid="elia15-content">
              <div className="flex items-center gap-4 mb-8">
                 <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Artifact 01 / 03</span>
                 <div className="h-px bg-border flex-1" />
              </div>
              
              <div className="max-h-[500px] overflow-y-auto px-4 py-6 border border-border rounded-lg bg-card scrollbar-thin">
                <div className="prose prose-sm prose-headings:font-display prose-headings:text-primary-900 prose-p:text-muted-foreground prose-strong:text-primary-900 max-w-none">
                  {elia15.split('\n').map((line, i) => {
                    if (line.startsWith('# ')) return <h2 key={i} className="text-2xl font-bold mt-8 mb-4">{line.replace('# ', '')}</h2>;
                    if (line.startsWith('## ')) return <h3 key={i} className="text-xl font-bold mt-6 mb-3">{line.replace('## ', '')}</h3>;
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="mb-4 leading-relaxed">{line}</p>;
                  })}
                </div>
              </div>
            </div>

            {/* Email Gate */}
            {showEmailGate && (
              <div className="mt-16 relative overflow-hidden bg-primary-900 text-primary-foreground p-8 md:p-12 shadow-2xl animate-in fade-in slide-in-from-bottom-12 duration-700 delay-300">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative z-10 text-center space-y-8">
                  <div className="space-y-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">
                      Unlock Full Analysis
                    </h2>
                    <p className="text-primary-foreground/80 max-w-md mx-auto text-lg font-light leading-relaxed">
                      Enter your email to receive the <strong>Business Narrative</strong> and <strong>Golden Circle</strong> frameworks.
                    </p>
                  </div>

                  <form onSubmit={handleEmailSubmit} className="max-w-md mx-auto space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="email"
                        required
                        placeholder="name@university.edu"
                        className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-accent-400 focus:border-accent-400 h-12 px-4 outline-none border transition-all hover:bg-white/15"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        data-testid="input-email"
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-12 px-6 bg-accent-600 hover:bg-accent-500 text-white font-medium shadow-lg hover:shadow-accent-600/25 transition-all flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed"
                        data-testid="button-request-access"
                      >
                        {isSubmitting ? "Sending..." : "Get Access"}
                        {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-primary-foreground/50">
                      We'll create a free account with 100 credits for you. No password required.
                    </p>
                  </form>

                  <div className="pt-8 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
                    {[
                      { title: "Business Narrative", desc: "Investor pitch content" },
                      { title: "Golden Circle", desc: "Strategic positioning" },
                      { title: "100 Free Credits", desc: "Analyze 10 more patents" },
                    ].map((item, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center gap-2 text-accent-400 text-sm font-bold">
                          <Lock className="w-3 h-3" /> {item.title}
                        </div>
                        <p className="text-xs text-primary-foreground/60">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
