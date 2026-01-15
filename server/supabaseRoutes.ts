import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { supabaseStorage } from "./supabaseStorage";
import { supabaseAdmin, supabase, supabaseUrl, supabaseAnonKey } from "./lib/supabase";
import multer from "multer";
import { nanoid } from "nanoid";
import fs from "fs/promises";
import { parsePatentPDF } from "./services/pdfParser";
import { generateELIA15, generateBusinessNarrative, generateGoldenCircle } from "./services/aiGenerator";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      const uniqueName = `${nanoid()}.pdf`;
      cb(null, uniqueName);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

async function getUserFromToken(req: Request): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return { id: user.id, email: user.email || '' };
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  getUserFromToken(req).then(user => {
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    req.user = user;
    next();
  }).catch(() => {
    res.status(401).json({ error: 'Not authenticated' });
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/supabase-config', (req, res) => {
    res.json({
      url: supabaseUrl,
      anonKey: supabaseAnonKey
    });
  });

  app.post('/api/upload', upload.single('pdf'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const user = await getUserFromToken(req);
      const filePath = req.file.path;
      const filename = req.file.filename;
      const parsedPatent = await parsePatentPDF(filePath);

      const patent = await supabaseStorage.createPatent({
        user_id: user?.id || null,
        title: parsedPatent.title,
        inventors: parsedPatent.inventors,
        assignee: parsedPatent.assignee,
        filing_date: parsedPatent.filingDate,
        issue_date: parsedPatent.issueDate,
        full_text: parsedPatent.fullText,
        pdf_filename: filename,
        status: 'processing',
        error_message: null,
      });

      try {
        const elia15Result = await generateELIA15(
          parsedPatent.fullText,
          parsedPatent.title || 'Patent Document'
        );

        await supabaseStorage.createArtifact({
          patent_id: patent.id,
          artifact_type: 'elia15',
          content: elia15Result.content,
          tokens_used: elia15Result.tokensUsed,
          generation_time_seconds: elia15Result.generationTimeSeconds,
        });

        await supabaseStorage.updatePatentStatus(patent.id, 'elia15_complete');

        res.json({ 
          success: true, 
          patentId: patent.id,
          message: 'Patent uploaded and ELIA15 generated successfully'
        });

        if (user?.id) {
          generateRemainingArtifactsWithNotifications(
            patent.id, 
            parsedPatent.fullText, 
            elia15Result.content, 
            user.id, 
            parsedPatent.title
          ).catch((err) => console.error('Error in generation with notifications:', err));
        } else {
          generateRemainingArtifacts(patent.id, parsedPatent.fullText, elia15Result.content).catch(console.error);
        }

      } catch (error) {
        console.error('Error generating ELIA15:', error);
        await supabaseStorage.updatePatentStatus(patent.id, 'failed', 'Failed to generate ELIA15');
        res.status(500).json({ error: 'Failed to generate analysis' });
      }

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to process patent' });
    }
  });

  app.get('/api/preview/:id', async (req, res) => {
    try {
      const patentId = req.params.id;
      const patent = await supabaseStorage.getPatent(patentId);
      const user = await getUserFromToken(req);

      if (!patent) {
        return res.status(404).json({ error: 'Patent not found' });
      }

      const artifacts = await supabaseStorage.getArtifactsByPatent(patentId);
      const elia15 = artifacts.find(a => a.artifact_type === 'elia15');

      res.json({
        patent: {
          id: patent.id,
          title: patent.title,
          assignee: patent.assignee,
          filingDate: patent.filing_date,
          status: patent.status,
        },
        elia15: elia15?.content || null,
        showEmailGate: !user
      });

    } catch (error) {
      console.error('Preview error:', error);
      res.status(500).json({ error: 'Failed to load preview' });
    }
  });

  app.post('/api/auth/magic-link', async (req, res) => {
    try {
      const { email, patentId } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }

      const appUrl = process.env.APP_URL || 'https://ipscaffold.replit.app';

      const { data, error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: `${appUrl}/auth/callback${patentId ? `?patent=${patentId}` : ''}`,
          shouldCreateUser: true,
        }
      });

      if (error) {
        console.error('Magic link error:', error);
        return res.status(500).json({ error: 'Failed to send magic link', details: error.message });
      }

      console.log('Magic link sent to:', email);

      res.json({ success: true, message: 'Magic link sent to your email', patentId });

    } catch (error: any) {
      console.error('Magic link error:', error);
      res.status(500).json({ error: 'Failed to send magic link', details: error?.message });
    }
  });

  app.get('/auth/confirm', async (req, res) => {
    const { token_hash, type } = req.query;
    const appUrl = process.env.APP_URL || 'https://ipscaffold.replit.app';
    
    console.log('Auth confirm - redirecting to frontend callback');
    
    const params = new URLSearchParams();
    if (token_hash) params.set('token_hash', token_hash as string);
    if (type) params.set('type', type as string);
    
    res.redirect(`${appUrl}/auth/callback?${params.toString()}`);
  });

  app.post('/api/auth/verify-session', async (req, res) => {
    try {
      const { accessToken, refreshToken, patentId } = req.body;
      console.log('Verify session request:', { hasAccessToken: !!accessToken, patentId });

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token required' });
      }

      const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
      console.log('getUser result:', { hasUser: !!user, error: error?.message });

      if (error || !user) {
        return res.status(401).json({ error: 'Invalid token', details: error?.message });
      }

      let profile = await supabaseStorage.getProfile(user.id);
      console.log('Profile:', { exists: !!profile, credits: profile?.credits });
      
      if (!profile) {
        console.log('Creating new profile for user:', user.id);
        try {
          await supabaseStorage.createProfile({
            id: user.id,
            email: user.email || '',
            credits: 100,
            is_admin: false,
          });
        } catch (e) {
          console.log('Profile creation skipped (may already exist):', e);
        }
        profile = await supabaseStorage.getProfile(user.id);
      }

      if (patentId && profile) {
        const patent = await supabaseStorage.getPatent(patentId);
        if (patent && !patent.user_id && profile.credits >= 10) {
          console.log('Claiming patent:', patentId);
          await supabaseStorage.updatePatentUserId(patent.id, user.id);
          const newBalance = profile.credits - 10;
          await supabaseStorage.updateProfileCredits(user.id, newBalance);
          await supabaseStorage.createCreditTransaction({
            user_id: user.id,
            amount: -10,
            balance_after: newBalance,
            transaction_type: 'ip_processing',
            description: `Patent analysis: ${patent.title}`,
            patent_id: patent.id,
          });
          profile.credits = newBalance;
        }
      }

      console.log('Session verified successfully for user:', user.id);

      res.json({ 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          credits: profile?.credits || 100,
        }
      });

    } catch (error: any) {
      console.error('Session verification error:', error);
      res.status(500).json({ error: 'Failed to verify session', details: error?.message });
    }
  });

  app.get('/api/user', requireAuth, async (req, res) => {
    const profile = await supabaseStorage.getProfile(req.user!.id);
    if (!profile) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      id: profile.id,
      email: profile.email,
      credits: profile.credits,
      isAdmin: profile.is_admin,
    });
  });

  app.post('/api/logout', (req, res) => {
    res.json({ success: true });
  });

  app.get('/api/dashboard', requireAuth, async (req, res) => {
    try {
      const patents = await supabaseStorage.getPatentsByUser(req.user!.id);
      
      const patentsWithArtifactCount = await Promise.all(
        patents.map(async (patent) => {
          const artifacts = await supabaseStorage.getArtifactsByPatent(patent.id);
          return {
            id: patent.id,
            title: patent.title,
            assignee: patent.assignee,
            filingDate: patent.filing_date,
            status: patent.status,
            createdAt: patent.created_at,
            artifactCount: artifacts.length,
          };
        })
      );

      res.json({ patents: patentsWithArtifactCount });

    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  });

  app.get('/api/patent/:id', requireAuth, async (req, res) => {
    try {
      const patentId = req.params.id;
      const patent = await supabaseStorage.getPatent(patentId);

      if (!patent || patent.user_id !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const artifacts = await supabaseStorage.getArtifactsByPatent(patentId);

      res.json({
        patent: {
          id: patent.id,
          title: patent.title,
          inventors: patent.inventors,
          assignee: patent.assignee,
          filingDate: patent.filing_date,
          issueDate: patent.issue_date,
          status: patent.status,
          createdAt: patent.created_at,
        },
        artifacts: artifacts.map(a => ({
          id: a.id,
          type: a.artifact_type,
          content: a.content,
          tokensUsed: a.tokens_used,
          generationTime: a.generation_time_seconds,
          createdAt: a.created_at,
        })),
      });

    } catch (error) {
      console.error('Patent error:', error);
      res.status(500).json({ error: 'Failed to load patent' });
    }
  });

  app.get('/api/credits', requireAuth, async (req, res) => {
    try {
      const profile = await supabaseStorage.getProfile(req.user!.id);
      const transactions = await supabaseStorage.getCreditTransactionsByUser(req.user!.id);

      res.json({
        balance: profile?.credits || 0,
        transactions: transactions.map(t => ({
          id: t.id,
          amount: t.amount,
          balanceAfter: t.balance_after,
          type: t.transaction_type,
          description: t.description,
          createdAt: t.created_at,
        })),
      });

    } catch (error) {
      console.error('Credits error:', error);
      res.status(500).json({ error: 'Failed to load credits' });
    }
  });

  app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
      const { NotificationService } = await import('./services/notificationService');
      const unreadOnly = req.query.unread === 'true';
      const notifications = await NotificationService.getUserNotifications(req.user!.id, unreadOnly);
      const unreadCount = await NotificationService.getUnreadCount(req.user!.id);

      res.json({ notifications, unreadCount });
    } catch (error) {
      console.error('Notifications error:', error);
      res.status(500).json({ error: 'Failed to load notifications' });
    }
  });

  app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
      const { NotificationService } = await import('./services/notificationService');
      await NotificationService.markAsRead(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Mark read error:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
    try {
      const { NotificationService } = await import('./services/notificationService');
      await NotificationService.markAllAsRead(req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Mark all read error:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const profile = await supabaseStorage.getProfile(req.user.id);
    if (!profile?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  };

  app.get('/api/admin/metrics', requireAuth, requireAdmin, async (req, res) => {
    try {
      const metrics = await supabaseStorage.getSystemMetrics();
      res.json(metrics);
    } catch (error) {
      console.error('Admin metrics error:', error);
      res.status(500).json({ error: 'Failed to load metrics' });
    }
  });

  app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
      const profiles = await supabaseStorage.getAllProfiles();
      res.json({ users: profiles });
    } catch (error) {
      console.error('Admin users error:', error);
      res.status(500).json({ error: 'Failed to load users' });
    }
  });

  app.get('/api/admin/patents', requireAuth, requireAdmin, async (req, res) => {
    try {
      const patents = await supabaseStorage.getAllPatents();
      res.json({ patents });
    } catch (error) {
      console.error('Admin patents error:', error);
      res.status(500).json({ error: 'Failed to load patents' });
    }
  });

  app.post('/api/admin/users/:id/credits', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { amount, description } = req.body;
      if (typeof amount !== 'number') {
        return res.status(400).json({ error: 'Amount must be a number' });
      }
      await supabaseStorage.adjustUserCredits(req.params.id, amount, description || 'Admin adjustment');
      await supabaseStorage.createAuditLog(req.user!.id, 'adjust_credits', 'user', req.params.id, { amount, description });
      res.json({ success: true });
    } catch (error) {
      console.error('Admin credits error:', error);
      res.status(500).json({ error: 'Failed to adjust credits' });
    }
  });

  app.post('/api/admin/users/:id/admin', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { isAdmin } = req.body;
      await supabaseStorage.updateProfileAdmin(req.params.id, !!isAdmin);
      await supabaseStorage.createAuditLog(req.user!.id, 'update_admin_status', 'user', req.params.id, { isAdmin });
      res.json({ success: true });
    } catch (error) {
      console.error('Admin update error:', error);
      res.status(500).json({ error: 'Failed to update admin status' });
    }
  });

  app.get('/api/admin/users/:id/details', requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      
      const profile = await supabaseStorage.getProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const patents = await supabaseStorage.getPatentsByUser(userId);
      const transactions = await supabaseStorage.getCreditTransactionsByUser(userId);
      
      res.json({
        ...profile,
        patents,
        transactions,
      });
    } catch (error) {
      console.error('Admin user details error:', error);
      res.status(500).json({ error: 'Failed to load user details' });
    }
  });

  app.post('/api/patent/:id/retry', requireAuth, async (req, res) => {
    try {
      const patent = await supabaseStorage.getPatent(req.params.id);
      
      if (!patent) {
        return res.status(404).json({ error: 'Patent not found' });
      }
      
      if (patent.user_id !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      if (patent.status === 'completed') {
        return res.status(400).json({ error: 'Patent is already completed' });
      }
      
      if (patent.status !== 'failed' && patent.status !== 'partial') {
        return res.status(400).json({ error: 'Patent is not in a failed state' });
      }
      
      await supabaseStorage.updatePatentStatus(req.params.id, 'processing');
      
      const existingArtifacts = await supabaseStorage.getArtifactsByPatent(req.params.id);
      const hasElia15 = existingArtifacts.some(a => a.artifact_type === 'elia15');
      
      if (!hasElia15) {
        const elia15Result = await generateELIA15(patent.full_text, patent.title || 'Patent Document');
        await supabaseStorage.createArtifact({
          patent_id: req.params.id,
          artifact_type: 'elia15',
          content: elia15Result.content,
          tokens_used: elia15Result.tokensUsed,
          generation_time_seconds: elia15Result.generationTimeSeconds,
        });
        await supabaseStorage.updatePatentStatus(req.params.id, 'elia15_complete');
      }
      
      const artifacts = await supabaseStorage.getArtifactsByPatent(req.params.id);
      const elia15 = artifacts.find(a => a.artifact_type === 'elia15');
      
      if (elia15) {
        generateRemainingArtifactsWithNotifications(
          req.params.id, 
          patent.full_text, 
          elia15.content, 
          req.user!.id, 
          patent.title
        ).catch((err) => console.error('Error in retry generation:', err));
      }
      
      res.json({ success: true, message: 'Retry initiated' });
      
    } catch (error) {
      console.error('Retry error:', error);
      res.status(500).json({ error: 'Failed to retry patent processing' });
    }
  });

  // Promo code redemption
  app.post('/api/promo/redeem', requireAuth, async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: 'Promo code is required' });
      }
      
      const result = await supabaseStorage.redeemPromoCode(req.user!.id, code.toUpperCase());
      res.json(result);
      
    } catch (error: any) {
      console.error('Promo redemption error:', error);
      res.status(400).json({ error: error.message || 'Failed to redeem promo code' });
    }
  });

  // Admin: Create promo code
  app.post('/api/admin/promo-codes', requireAdmin, async (req, res) => {
    try {
      const { code, creditAmount, maxRedemptions, expiresAt } = req.body;
      
      if (!code || !creditAmount) {
        return res.status(400).json({ error: 'Code and credit amount are required' });
      }
      
      const promoCode = await supabaseStorage.createPromoCode({
        code: code.toUpperCase(),
        creditAmount,
        maxRedemptions: maxRedemptions || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: parseInt(req.user!.id),
      });
      
      await supabaseStorage.createAuditLog(req.user!.id, 'create_promo_code', 'promo_code', promoCode.id.toString(), { code, creditAmount });
      res.json(promoCode);
      
    } catch (error) {
      console.error('Promo creation error:', error);
      res.status(500).json({ error: 'Failed to create promo code' });
    }
  });

  // Admin: List promo codes
  app.get('/api/admin/promo-codes', requireAdmin, async (req, res) => {
    try {
      const promoCodes = await supabaseStorage.getPromoCodes();
      res.json(promoCodes);
    } catch (error) {
      console.error('Promo list error:', error);
      res.status(500).json({ error: 'Failed to list promo codes' });
    }
  });

  // Admin: Toggle promo code active status
  app.patch('/api/admin/promo-codes/:id', requireAdmin, async (req, res) => {
    try {
      const { isActive } = req.body;
      await supabaseStorage.updatePromoCodeStatus(req.params.id, isActive);
      await supabaseStorage.createAuditLog(req.user!.id, 'update_promo_code', 'promo_code', req.params.id, { isActive });
      res.json({ success: true });
    } catch (error) {
      console.error('Promo update error:', error);
      res.status(500).json({ error: 'Failed to update promo code' });
    }
  });

  // Image Generation Routes

  // Generate images for all sections in an artifact
  app.post('/api/images/generate/:artifactId', async (req, res) => {
    try {
      const { artifactId } = req.params;

      // Get artifact details
      const { data: artifact, error } = await supabaseAdmin
        .from('artifacts')
        .select('artifact_type, content')
        .eq('id', artifactId)
        .single();

      if (error || !artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      // Validate artifact type
      if (!['elia15', 'business_narrative', 'golden_circle'].includes(artifact.artifact_type)) {
        return res.status(400).json({ error: 'Invalid artifact type' });
      }

      // Generate images
      const { generateArtifactImages } = await import('./services/artifactImageService');
      const result = await generateArtifactImages({
        artifactId,
        artifactType: artifact.artifact_type as 'elia15' | 'business_narrative' | 'golden_circle',
        markdownContent: artifact.content,
      });

      res.json(result);
    } catch (error) {
      console.error('Error generating images:', error);
      res.status(500).json({
        error: 'Failed to generate images',
        details: (error as Error).message
      });
    }
  });

  // Get all images for an artifact
  app.get('/api/images/:artifactId', async (req, res) => {
    try {
      const { artifactId } = req.params;

      const { data, error } = await supabaseAdmin
        .from('section_images')
        .select('*')
        .eq('artifact_id', artifactId)
        .order('section_number', { ascending: true });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json(data || []);
    } catch (error) {
      console.error('Error fetching images:', error);
      res.status(500).json({ error: 'Failed to fetch images' });
    }
  });

  // Regenerate a single section image
  app.post('/api/images/regenerate/:artifactId/:sectionNumber', async (req, res) => {
    try {
      const { artifactId, sectionNumber } = req.params;

      // Get artifact details
      const { data: artifact, error } = await supabaseAdmin
        .from('artifacts')
        .select('artifact_type, content')
        .eq('id', artifactId)
        .single();

      if (error || !artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      // Parse sections to get the title
      const { parseMarkdownSections } = await import('./services/sectionParser');
      const sections = parseMarkdownSections(artifact.content);
      const section = sections.find(s => s.number === parseInt(sectionNumber));

      if (!section) {
        return res.status(404).json({ error: 'Section not found' });
      }

      // Generate single image
      const { generateSingleSectionImage } = await import('./services/artifactImageService');
      const sectionImage = await generateSingleSectionImage({
        artifactId,
        artifactType: artifact.artifact_type as 'elia15' | 'business_narrative' | 'golden_circle',
        sectionNumber: parseInt(sectionNumber),
        sectionTitle: section.title,
      });

      res.json(sectionImage);
    } catch (error) {
      console.error('Error regenerating image:', error);
      res.status(500).json({
        error: 'Failed to regenerate image',
        details: (error as Error).message
      });
    }
  });

  // Delete a specific section image
  app.delete('/api/images/:imageId', async (req, res) => {
    try {
      const { imageId } = req.params;

      const { error } = await supabaseAdmin
        .from('section_images')
        .delete()
        .eq('id', imageId);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting image:', error);
      res.status(500).json({ error: 'Failed to delete image' });
    }
  });

  return httpServer;
}

async function generateRemainingArtifacts(patentId: string, fullText: string, elia15Content: string) {
  try {
    const [narrativeResult, goldenCircleResult] = await Promise.all([
      generateBusinessNarrative(fullText, elia15Content),
      generateGoldenCircle(fullText, elia15Content),
    ]);

    await Promise.all([
      supabaseStorage.createArtifact({
        patent_id: patentId,
        artifact_type: 'business_narrative',
        content: narrativeResult.content,
        tokens_used: narrativeResult.tokensUsed,
        generation_time_seconds: narrativeResult.generationTimeSeconds,
      }),
      supabaseStorage.createArtifact({
        patent_id: patentId,
        artifact_type: 'golden_circle',
        content: goldenCircleResult.content,
        tokens_used: goldenCircleResult.tokensUsed,
        generation_time_seconds: goldenCircleResult.generationTimeSeconds,
      }),
    ]);

    await supabaseStorage.updatePatentStatus(patentId, 'completed');
    console.log('All artifacts generated for patent:', patentId);

  } catch (error) {
    console.error('Error generating remaining artifacts:', error);
    await supabaseStorage.updatePatentStatus(patentId, 'failed', 'Failed to generate all artifacts');
  }
}

async function generateRemainingArtifactsWithNotifications(
  patentId: string, 
  fullText: string, 
  elia15Content: string, 
  userId: string, 
  patentTitle: string | null
) {
  const { NotificationService } = await import('./services/notificationService');
  
  try {
    const [narrativeResult, goldenCircleResult] = await Promise.all([
      generateBusinessNarrative(fullText, elia15Content),
      generateGoldenCircle(fullText, elia15Content),
    ]);

    await Promise.all([
      supabaseStorage.createArtifact({
        patent_id: patentId,
        artifact_type: 'business_narrative',
        content: narrativeResult.content,
        tokens_used: narrativeResult.tokensUsed,
        generation_time_seconds: narrativeResult.generationTimeSeconds,
      }),
      supabaseStorage.createArtifact({
        patent_id: patentId,
        artifact_type: 'golden_circle',
        content: goldenCircleResult.content,
        tokens_used: goldenCircleResult.tokensUsed,
        generation_time_seconds: goldenCircleResult.generationTimeSeconds,
      }),
    ]);

    await supabaseStorage.updatePatentStatus(patentId, 'completed');
    console.log('All artifacts generated for patent:', patentId);
    
    await NotificationService.sendPatentReady(userId, patentId, patentTitle);

  } catch (error) {
    console.error('Error generating remaining artifacts:', error);
    await supabaseStorage.updatePatentStatus(patentId, 'failed', 'Failed to generate all artifacts');
    await NotificationService.sendProcessingError(userId, patentId, patentTitle, (error as Error).message);
  }
}
