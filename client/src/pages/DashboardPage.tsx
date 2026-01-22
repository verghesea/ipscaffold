import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { api, type Patent } from '@/lib/api';
import { FileText, Clock, CheckCircle, AlertCircle, Upload, Loader2, Plus, Gift, Grid, List } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { createAvatar } from '@dicebear/core';
import { shapes } from '@dicebear/collection';
import { analytics } from '@/lib/analytics';

export function DashboardPage() {
  const [, setLocation] = useLocation();
  const [patents, setPatents] = useState<Patent[]>([]);
  const [heroImages, setHeroImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const { toast } = useToast();

  // Load dashboard on mount only
  useEffect(() => {
    loadDashboard();
  }, []); // Empty deps - run once on mount

  // Auto-refresh hero images every 15 seconds for recently completed patents
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Only fetch hero images for patents that:
        // 1. Are completed
        // 2. Don't have a hero image yet
        // 3. Were created in the last hour (to avoid unnecessary requests)
        const recentPatents = patents.filter(p => {
          const isCompleted = p.status === 'completed';
          const hasNoHeroImage = !heroImages[p.id];
          const isRecent = p.createdAt &&
            (Date.now() - new Date(p.createdAt).getTime()) < 60 * 60 * 1000; // 1 hour
          return isCompleted && hasNoHeroImage && isRecent;
        });

        if (recentPatents.length === 0) return;

        console.log(`[Dashboard] Checking for hero images on ${recentPatents.length} recent patents...`);

        for (const patent of recentPatents) {
          try {
            const heroImage = await api.getPatentHeroImage(patent.id);
            if (heroImage?.image_url) {
              console.log(`[Dashboard] Found hero image for patent ${patent.id}`);
              setHeroImages(prev => ({
                ...prev,
                [patent.id]: heroImage.image_url
              }));
            }
          } catch (error) {
            // 404 is expected if hero image isn't ready yet, ignore
          }
        }
      } catch (error) {
        console.error('[Dashboard] Error checking for hero images:', error);
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [patents, heroImages]);

  const loadDashboard = async () => {
    try {
      const data = await api.getDashboard();

      // If no patents found, try to fix orphaned patents
      if (data.patents.length === 0) {
        console.log('[Dashboard] No patents found, attempting to fix orphaned patents...');
        try {
          const fixResult = await api.fixOrphanedPatents();
          console.log('[Dashboard] Fix result:', JSON.stringify(fixResult, null, 2));

          // Log detailed diagnostics
          console.log('[Dashboard] Fix diagnostics:');
          console.log('  - Total notification patents:', fixResult.totalNotificationPatents);
          console.log('  - Total orphaned in DB:', fixResult.totalOrphanedInDb);
          console.log('  - Fixed count:', fixResult.fixedCount);
          console.log('  - Already linked:', fixResult.alreadyLinkedCount);
          console.log('  - Not found:', fixResult.notFoundCount);

          if (fixResult.fixedCount > 0) {
            toast({
              title: 'Patents Recovered',
              description: fixResult.message,
            });
            // Reload the dashboard after fixing
            const updatedData = await api.getDashboard();
            setPatents(updatedData.patents || []);

            // Fetch hero images for recovered patents
            const imagePromises = (updatedData.patents || [])
              .filter(p => p.status === 'completed')
              .map(async (patent) => {
                try {
                  const heroImage = await api.getPatentHeroImage(patent.id);
                  return { patentId: patent.id, imageUrl: heroImage?.image_url };
                } catch {
                  return { patentId: patent.id, imageUrl: null };
                }
              });

            const images = await Promise.all(imagePromises);
            const imageMap = images.reduce((acc, { patentId, imageUrl }) => {
              if (imageUrl) acc[patentId] = imageUrl;
              return acc;
            }, {} as Record<string, string>);

            setHeroImages(imageMap);
            return; // Exit early, we've already set everything
          } else if (fixResult.totalOrphanedInDb > 0) {
            // There are orphaned patents but they didn't match - run debug
            console.log('[Dashboard] Running debug diagnostics...');
            try {
              const debugResult = await api.debugPatents();
              console.log('[Dashboard] Debug result:', JSON.stringify(debugResult, null, 2));

              // If there are orphaned patents, try to claim them
              if (debugResult.orphanedPatents && Array.isArray(debugResult.orphanedPatents) && debugResult.orphanedPatents.length > 0) {
                const orphanIds = debugResult.orphanedPatents.map((p: any) => p.id);
                console.log('[Dashboard] Attempting to claim orphaned patents:', orphanIds);

                const claimResult = await api.claimPatents(orphanIds);
                console.log('[Dashboard] Claim result:', claimResult);

                if (claimResult.claimedCount > 0) {
                  toast({
                    title: 'Patents Recovered',
                    description: `Recovered ${claimResult.claimedCount} patents.`,
                  });
                  // Reload dashboard
                  const updatedData = await api.getDashboard();
                  setPatents(updatedData.patents);
                  return;
                }
              }
            } catch (debugError) {
              console.error('[Dashboard] Debug failed:', debugError);
            }
          }
        } catch (fixError) {
          console.error('[Dashboard] Failed to fix orphaned patents:', fixError);
          // Continue with empty dashboard
        }
      }

      setPatents(data.patents || []);

      // Fetch hero images for all completed patents
      const imagePromises = (data.patents || [])
        .filter(p => p.status === 'completed')
        .map(async (patent) => {
          try {
            const heroImage = await api.getPatentHeroImage(patent.id);
            return { patentId: patent.id, imageUrl: heroImage?.image_url };
          } catch (error) {
            return { patentId: patent.id, imageUrl: null };
          }
        });

      const images = await Promise.all(imagePromises);
      const imageMap = images.reduce((acc, { patentId, imageUrl }) => {
        if (imageUrl) acc[patentId] = imageUrl;
        return acc;
      }, {} as Record<string, string>);

      setHeroImages(imageMap);
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

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      const result = await api.uploadPatent(file);
      toast({
        title: "Success!",
        description: "Patent uploaded and analysis started.",
      });
      setLocation(`/preview/${result.patentId}`);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRedeemCode = async () => {
    if (!promoCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a promo code',
        variant: 'destructive',
      });
      return;
    }

    setIsRedeemingCode(true);
    try {
      const result = await api.redeemPromoCode(promoCode.trim().toUpperCase());
      analytics.trackPromoCodeRedeemed(promoCode.trim().toUpperCase(), result.creditsAwarded);
      toast({
        title: 'Success!',
        description: `${result.creditsAwarded} credits added to your account!`,
      });
      setPromoCode('');
      setPromoDialogOpen(false);
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Invalid code',
        description: error.message || 'This code is invalid or has expired.',
        variant: 'destructive',
      });
    } finally {
      setIsRedeemingCode(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      processing: { icon: Clock, text: 'Processing', className: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
      elia15_complete: { icon: Clock, text: 'Generating...', className: 'text-blue-600 bg-blue-50 border-blue-200' },
      completed: { icon: CheckCircle, text: 'Complete', className: 'text-green-600 bg-green-50 border-green-200' },
      failed: { icon: AlertCircle, text: 'Failed', className: 'text-red-600 bg-red-50 border-red-200' },
      partial: { icon: AlertCircle, text: 'Partial', className: 'text-orange-600 bg-orange-50 border-orange-200' },
    };
    
    const config = configs[status as keyof typeof configs] || configs.processing;
    const Icon = config.icon;
    
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${config.className}`}>
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
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Content */}
            <div className="flex-1">
              {/* Header */}
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h1 className="font-display text-3xl md:text-4xl font-bold text-primary-900" data-testid="text-dashboard-title">
                    Your Patents
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    View and manage all your patent analyses
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 bg-muted rounded-lg p-1">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      data-testid="button-view-grid"
                    >
                      <Grid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('table')}
                      data-testid="button-view-table"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                  <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2" data-testid="button-redeem-code">
                      <Gift className="w-4 h-4" />
                      Redeem Code
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Redeem Promo Code</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="promo-code">Enter your code</Label>
                        <Input
                          id="promo-code"
                          placeholder="PROMO123"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          disabled={isRedeemingCode}
                          data-testid="input-promo-code"
                        />
                      </div>
                      <Button 
                        onClick={handleRedeemCode} 
                        className="w-full"
                        disabled={isRedeemingCode}
                        data-testid="button-submit-promo"
                      >
                        {isRedeemingCode ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Redeeming...
                          </>
                        ) : (
                          'Redeem Credits'
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
              </div>

              {/* Patents Display */}
              {patents.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold font-playfair mb-2">No Patents Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Upload your first patent to get started
                    </p>
                    <Button onClick={() => setLocation('/')} data-testid="button-upload-patent-empty">
                      Upload Patent
                    </Button>
                  </CardContent>
                </Card>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {patents.map((patent) => {
                    const heroImage = heroImages[patent.id];
                    const avatarSvg = createAvatar(shapes, {
                      seed: patent.id,
                      backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'],
                    }).toString();

                    return (
                      <Card
                        key={patent.id}
                        className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                        onClick={() => setLocation(`/patent/${patent.id}`)}
                        data-testid={`card-patent-${patent.id}`}
                      >
                        <div className="h-48 relative bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden">
                          {heroImage ? (
                            <img
                              src={heroImage}
                              alt={patent.title || 'Patent'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div
                              className="w-full h-full opacity-30 group-hover:opacity-40 transition"
                              dangerouslySetInnerHTML={{ __html: avatarSvg }}
                            />
                          )}

                          {/* Gradient overlay for better badge visibility */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/20" />

                          <Badge
                            className="absolute top-3 right-3 shadow-sm"
                            variant={
                              patent.status === 'completed' ? 'default' :
                              patent.status === 'failed' ? 'destructive' :
                              patent.status === 'processing' ? 'secondary' : 'outline'
                            }
                          >
                            {patent.status === 'elia15_complete' ? 'In Progress' : patent.status}
                          </Badge>

                          <div className="absolute bottom-3 left-3 right-3">
                            <div className="bg-white/90 backdrop-blur-sm rounded-full h-2 overflow-hidden shadow-sm">
                              <div
                                className="bg-primary h-full transition-all"
                                style={{ width: `${((patent.artifactCount || 0) / 3) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-semibold font-playfair text-lg line-clamp-2 group-hover:text-primary transition flex-1">
                              {patent.friendlyTitle || patent.title || 'Untitled Patent'}
                            </h3>
                            {patent.patentNumber && (
                              <Badge variant="secondary" className="text-xs shrink-0 font-mono">
                                {patent.patentNumber}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                            {patent.assignee || 'Unknown Assignee'}
                          </p>

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {patent.artifactCount || 0}/3 artifacts
                            </span>
                            <span>
                              {new Date(patent.createdAt || '').toLocaleDateString()}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[35%]">Title</TableHead>
                        <TableHead>Patent Number</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Artifacts</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patents.map((patent) => (
                        <TableRow 
                          key={patent.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setLocation(`/patent/${patent.id}`)}
                          data-testid={`row-patent-${patent.id}`}
                        >
                          <TableCell className="font-medium">
                            <span className="line-clamp-1" data-testid={`text-title-${patent.id}`}>
                              {patent.friendlyTitle || patent.title || 'Untitled Patent'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {patent.patentNumber ? (
                              <Badge variant="secondary" className="font-mono text-xs">
                                {patent.patentNumber}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <span className="line-clamp-1">{patent.assignee || '-'}</span>
                          </TableCell>
                          <TableCell>{getStatusBadge(patent.status)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {patent.artifactCount || 0} / 3
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(patent.createdAt || '').toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>

            {/* Upload Sidebar */}
            <div className="lg:w-80">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Plus className="w-5 h-5" />
                    Upload Patent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`
                      relative border-2 border-dashed rounded-lg p-6 text-center transition-all
                      ${isDragging 
                        ? 'border-accent-500 bg-accent-50' 
                        : 'border-border hover:border-accent-400/50 hover:bg-muted/30'
                      }
                      ${isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}
                    `}
                    data-testid="upload-drop-zone"
                  >
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={isUploading}
                      data-testid="input-file-upload"
                    />
                    
                    {isUploading ? (
                      <div className="space-y-3">
                        <Loader2 className="w-10 h-10 text-accent-500 mx-auto animate-spin" />
                        <p className="text-sm text-muted-foreground">Analyzing patent...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className={`w-10 h-10 mx-auto ${isDragging ? 'text-accent-500' : 'text-muted-foreground'}`} />
                        <div>
                          <p className="text-sm font-medium text-primary-900">
                            Drop PDF here
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            or click to browse
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    Max 10MB per file
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
