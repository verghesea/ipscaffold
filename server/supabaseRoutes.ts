import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { supabaseStorage } from "./supabaseStorage";
import { supabaseAdmin, supabase, supabaseUrl, supabaseAnonKey } from "./lib/supabase";
import multer from "multer";
import { nanoid } from "nanoid";
import fs from "fs/promises";
import { parsePatentPDF } from "./services/pdfParser";
import { generateELIA15, generateBusinessNarrative, generateGoldenCircle } from "./services/aiGenerator";
import { generateImagesForArtifact } from "./services/artifactImageService";

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

      let organizationId: string | null = null;

      // If user is logged in, get their current organization
      if (user?.id) {
        const profile = await supabaseStorage.getProfile(user.id);
        organizationId = profile?.current_organization_id || null;

        // Check if user has a current organization
        if (!organizationId) {
          return res.status(400).json({ error: 'No organization selected. Please create or select an organization first.' });
        }

        // Check organization credits
        const organization = await supabaseStorage.getOrganization(organizationId);
        if (!organization || organization.credits < 10) {
          return res.status(402).json({ error: 'Insufficient organization credits' });
        }

        // Deduct credits from organization
        const newBalance = organization.credits - 10;
        await supabaseStorage.updateOrganizationCredits(organizationId, newBalance);
        await supabaseStorage.createCreditTransaction({
          user_id: user.id,
          organization_id: organizationId,
          amount: -10,
          balance_after: newBalance,
          transaction_type: 'ip_processing',
          description: `Patent analysis: ${parsedPatent.title || 'Untitled'}`,
          patent_id: null, // Will be updated after patent creation
        });
      }

      const patent = await supabaseStorage.createPatent({
        user_id: user?.id || null,
        organization_id: organizationId,
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

        const elia15Artifact = await supabaseStorage.createArtifact({
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

        generateImagesForArtifact(
          elia15Artifact.id,
          elia15Result.content,
          'elia15',
          parsedPatent.title || 'Patent Document'
        ).catch(err => console.error('Error generating ELIA15 images:', err));

        if (user?.id) {
          generateRemainingArtifactsWithNotifications(
            patent.id,
            parsedPatent.fullText,
            elia15Result.content,
            user.id,
            parsedPatent.title
          ).catch((err) => console.error('Error in generation with notifications:', err));
        } else {
          generateRemainingArtifacts(patent.id, parsedPatent.fullText, elia15Result.content, parsedPatent.title || undefined).catch(console.error);
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
        if (patent && !patent.user_id && !patent.organization_id) {
          console.log('Claiming patent:', patentId);

          // Get or create organization for user
          let currentOrgId = profile.current_organization_id;
          if (!currentOrgId) {
            // Create a personal organization for the user
            const personalOrg = await supabaseStorage.createOrganization(
              `${profile.email.split('@')[0]}'s Organization`,
              user.id
            );
            currentOrgId = personalOrg.id;
            console.log('Created personal organization for user:', user.id);
          }

          // Check organization credits
          const organization = await supabaseStorage.getOrganization(currentOrgId);
          if (organization && organization.credits >= 10) {
            await supabaseStorage.updatePatentUserId(patent.id, user.id);

            // Update patent with organization_id
            await supabaseAdmin
              .from('patents')
              .update({ organization_id: currentOrgId })
              .eq('id', patent.id);

            const newBalance = organization.credits - 10;
            await supabaseStorage.updateOrganizationCredits(currentOrgId, newBalance);
            await supabaseStorage.createCreditTransaction({
              user_id: user.id,
              organization_id: currentOrgId,
              amount: -10,
              balance_after: newBalance,
              transaction_type: 'ip_processing',
              description: `Patent analysis: ${patent.title}`,
              patent_id: patent.id,
            });
          } else {
            console.log('Insufficient organization credits to claim patent');
          }
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

    let currentOrganization = null;
    if (profile.current_organization_id) {
      currentOrganization = await supabaseStorage.getOrganization(profile.current_organization_id);
    }

    res.json({
      id: profile.id,
      email: profile.email,
      credits: profile.credits, // Deprecated - for backwards compatibility
      isAdmin: profile.is_admin,
      currentOrganization: currentOrganization ? {
        id: currentOrganization.id,
        name: currentOrganization.name,
        credits: currentOrganization.credits,
      } : null,
    });
  });

  app.post('/api/logout', (req, res) => {
    res.json({ success: true });
  });

  app.get('/api/dashboard', requireAuth, async (req, res) => {
    try {
      const profile = await supabaseStorage.getProfile(req.user!.id);

      let patents: any[] = [];

      // If user has a current organization, show org patents
      if (profile?.current_organization_id) {
        patents = await supabaseStorage.getPatentsByOrganization(profile.current_organization_id);
      } else {
        // Fallback to user's personal patents (backwards compatibility)
        patents = await supabaseStorage.getPatentsByUser(req.user!.id);
      }

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
            uploadedBy: patent.user_id, // Track who uploaded it
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

      if (!patent) {
        return res.status(404).json({ error: 'Patent not found' });
      }

      // Check access: user uploaded it OR user is in the patent's organization
      let hasAccess = patent.user_id === req.user!.id;

      if (!hasAccess && patent.organization_id) {
        const role = await supabaseStorage.getOrganizationMemberRole(req.user!.id, patent.organization_id);
        hasAccess = !!role;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const artifacts = await supabaseStorage.getArtifactsByPatent(patentId);
      
      const { getImagesForArtifact } = await import('./services/artifactImageService');
      
      const artifactsWithImages = await Promise.all(
        artifacts.map(async (a) => {
          const images = await getImagesForArtifact(a.id);
          return {
            id: a.id,
            type: a.artifact_type,
            content: a.content,
            tokensUsed: a.tokens_used,
            generationTime: a.generation_time_seconds,
            createdAt: a.created_at,
            images: images.map(img => ({
              id: img.id,
              sectionHeading: img.sectionHeading,
              sectionOrder: img.sectionOrder,
              imageUrl: img.imageUrl,
            })),
          };
        })
      );

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
          uploadedBy: patent.user_id,
          organizationId: patent.organization_id,
        },
        artifacts: artifactsWithImages,
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

      // Check access: user uploaded it OR user is in the patent's organization
      let hasAccess = patent.user_id === req.user!.id;

      if (!hasAccess && patent.organization_id) {
        const role = await supabaseStorage.getOrganizationMemberRole(req.user!.id, patent.organization_id);
        hasAccess = !!role;
      }

      if (!hasAccess) {
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

  // Organization Endpoints

  // Get user's organizations
  app.get('/api/organizations', requireAuth, async (req, res) => {
    try {
      const organizations = await supabaseStorage.getUserOrganizations(req.user!.id);
      const profile = await supabaseStorage.getProfile(req.user!.id);

      const orgsWithRole = await Promise.all(
        organizations.map(async (org) => {
          const role = await supabaseStorage.getOrganizationMemberRole(req.user!.id, org.id);
          return {
            ...org,
            role,
            isCurrent: profile?.current_organization_id === org.id,
          };
        })
      );

      res.json({ organizations: orgsWithRole });
    } catch (error) {
      console.error('Organizations error:', error);
      res.status(500).json({ error: 'Failed to load organizations' });
    }
  });

  // Create organization
  app.post('/api/organizations', requireAuth, async (req, res) => {
    try {
      const { name } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Organization name is required' });
      }

      if (name.length > 100) {
        return res.status(400).json({ error: 'Organization name must be 100 characters or less' });
      }

      const organization = await supabaseStorage.createOrganization(name.trim(), req.user!.id);
      res.json({ organization });

    } catch (error) {
      console.error('Create organization error:', error);
      res.status(500).json({ error: 'Failed to create organization' });
    }
  });

  // Switch current organization
  app.post('/api/organizations/switch', requireAuth, async (req, res) => {
    try {
      const { organizationId } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      // Verify user is a member
      const role = await supabaseStorage.getOrganizationMemberRole(req.user!.id, organizationId);
      if (!role) {
        return res.status(403).json({ error: 'You are not a member of this organization' });
      }

      await supabaseStorage.setCurrentOrganization(req.user!.id, organizationId);
      const organization = await supabaseStorage.getOrganization(organizationId);

      res.json({ success: true, organization });

    } catch (error) {
      console.error('Switch organization error:', error);
      res.status(500).json({ error: 'Failed to switch organization' });
    }
  });

  // Get organization members
  app.get('/api/organizations/:id/members', requireAuth, async (req, res) => {
    try {
      const orgId = req.params.id;

      // Verify user is a member
      const userRole = await supabaseStorage.getOrganizationMemberRole(req.user!.id, orgId);
      if (!userRole) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const members = await supabaseStorage.getOrganizationMembers(orgId);

      res.json({
        members: members.map(m => ({
          id: m.id,
          userId: m.user_id,
          email: m.profile?.email,
          role: m.role,
          joinedAt: m.joined_at,
        }))
      });

    } catch (error) {
      console.error('Get members error:', error);
      res.status(500).json({ error: 'Failed to load members' });
    }
  });

  // Invite member to organization
  app.post('/api/organizations/:id/members', requireAuth, async (req, res) => {
    try {
      const orgId = req.params.id;
      const { email, role } = req.body;

      // Verify requester is an admin
      const userRole = await supabaseStorage.getOrganizationMemberRole(req.user!.id, orgId);
      if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Only admins can invite members' });
      }

      if (!email || !role) {
        return res.status(400).json({ error: 'Email and role are required' });
      }

      if (!['admin', 'member', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Find user by email
      const invitedUser = await supabaseStorage.getProfileByEmail(email);
      if (!invitedUser) {
        return res.status(404).json({ error: 'User not found. They must sign up first.' });
      }

      // Check if already a member
      const existingRole = await supabaseStorage.getOrganizationMemberRole(invitedUser.id, orgId);
      if (existingRole) {
        return res.status(400).json({ error: 'User is already a member of this organization' });
      }

      await supabaseStorage.addOrganizationMember(orgId, invitedUser.id, role);

      res.json({ success: true, message: `${email} has been added to the organization` });

    } catch (error) {
      console.error('Invite member error:', error);
      res.status(500).json({ error: 'Failed to invite member' });
    }
  });

  // Remove member from organization
  app.delete('/api/organizations/:id/members/:userId', requireAuth, async (req, res) => {
    try {
      const orgId = req.params.id;
      const targetUserId = req.params.userId;

      // Verify requester is an admin
      const userRole = await supabaseStorage.getOrganizationMemberRole(req.user!.id, orgId);
      if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Only admins can remove members' });
      }

      // Prevent removing yourself if you're the only admin
      const members = await supabaseStorage.getOrganizationMembers(orgId);
      const adminCount = members.filter(m => m.role === 'admin').length;

      if (targetUserId === req.user!.id && adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot remove the only admin. Promote another member first.' });
      }

      await supabaseStorage.removeOrganizationMember(orgId, targetUserId);

      res.json({ success: true, message: 'Member removed successfully' });

    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  });

  // Update member role
  app.patch('/api/organizations/:id/members/:userId', requireAuth, async (req, res) => {
    try {
      const orgId = req.params.id;
      const targetUserId = req.params.userId;
      const { role } = req.body;

      // Verify requester is an admin
      const userRole = await supabaseStorage.getOrganizationMemberRole(req.user!.id, orgId);
      if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Only admins can update member roles' });
      }

      if (!role || !['admin', 'member', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Prevent demoting yourself if you're the only admin
      if (targetUserId === req.user!.id && role !== 'admin') {
        const members = await supabaseStorage.getOrganizationMembers(orgId);
        const adminCount = members.filter(m => m.role === 'admin').length;

        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot demote the only admin. Promote another member first.' });
        }
      }

      await supabaseStorage.updateOrganizationMemberRole(orgId, targetUserId, role);

      res.json({ success: true, message: 'Member role updated successfully' });

    } catch (error) {
      console.error('Update member role error:', error);
      res.status(500).json({ error: 'Failed to update member role' });
    }
  });

  // Update organization name
  app.patch('/api/organizations/:id', requireAuth, async (req, res) => {
    try {
      const orgId = req.params.id;
      const { name } = req.body;

      // Verify requester is an admin
      const userRole = await supabaseStorage.getOrganizationMemberRole(req.user!.id, orgId);
      if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Only admins can update organization settings' });
      }

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Organization name is required' });
      }

      if (name.length > 100) {
        return res.status(400).json({ error: 'Organization name must be 100 characters or less' });
      }

      await supabaseStorage.updateOrganizationName(orgId, name.trim());

      res.json({ success: true, message: 'Organization name updated successfully' });

    } catch (error) {
      console.error('Update organization error:', error);
      res.status(500).json({ error: 'Failed to update organization' });
    }
  });

  return httpServer;
}

async function generateRemainingArtifacts(patentId: string, fullText: string, elia15Content: string, patentTitle?: string) {
  try {
    const [narrativeResult, goldenCircleResult] = await Promise.all([
      generateBusinessNarrative(fullText, elia15Content),
      generateGoldenCircle(fullText, elia15Content),
    ]);

    const [narrativeArtifact, goldenCircleArtifact] = await Promise.all([
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

    Promise.all([
      generateImagesForArtifact(
        narrativeArtifact.id,
        narrativeResult.content,
        'business_narrative',
        patentTitle || 'Patent Document'
      ),
      generateImagesForArtifact(
        goldenCircleArtifact.id,
        goldenCircleResult.content,
        'golden_circle',
        patentTitle || 'Patent Document'
      ),
    ]).catch(err => console.error('Error generating images for remaining artifacts:', err));

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

    const [narrativeArtifact, goldenCircleArtifact] = await Promise.all([
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

    Promise.all([
      generateImagesForArtifact(
        narrativeArtifact.id,
        narrativeResult.content,
        'business_narrative',
        patentTitle || 'Patent Document'
      ),
      generateImagesForArtifact(
        goldenCircleArtifact.id,
        goldenCircleResult.content,
        'golden_circle',
        patentTitle || 'Patent Document'
      ),
    ]).catch(err => console.error('Error generating images for remaining artifacts:', err));

  } catch (error) {
    console.error('Error generating remaining artifacts:', error);
    await supabaseStorage.updatePatentStatus(patentId, 'failed', 'Failed to generate all artifacts');
    await NotificationService.sendProcessingError(userId, patentId, patentTitle, (error as Error).message);
  }
}
