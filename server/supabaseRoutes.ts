import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { supabaseStorage } from "./supabaseStorage";
import { supabaseAdmin, supabase, supabaseUrl, supabaseAnonKey } from "./lib/supabase";
import multer from "multer";
import { nanoid } from "nanoid";
import fs from "fs/promises";
import { parsePatentPDF } from "./services/pdfParser";
import { generateELIA15, generateBusinessNarrative, generateGoldenCircle } from "./services/aiGenerator";
import { getProgress, getProgressFromDb, updateProgress } from "./services/progressService";
import { logMetadataCorrection, findValueContext, getPendingCorrections } from "./services/extractionLogger";
import {
  analyzeFieldCorrections,
  deployPattern,
  getPendingCorrectionCounts,
  type PatternSuggestion,
} from "./services/patternLearningService";

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

  // Startup log to confirm Stage 4 auto-generation is enabled
  console.log('🚀 Server starting with parallel section image auto-generation (Stage 4) ENABLED');

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

      // Parse PDF for metadata extraction
      const parsedPatent = await parsePatentPDF(filePath);

      // Upload PDF to Supabase Storage
      let pdfStoragePath: string | null = null;
      try {
        const fileBuffer = await fs.readFile(filePath);
        const { storagePath } = await supabaseStorage.uploadPdfToStorage(
          fileBuffer,
          filename,
          user?.id || null
        );
        pdfStoragePath = storagePath;
        console.log(`[Upload] ✓ PDF uploaded to Supabase Storage: ${storagePath}`);

        // Delete local file after successful upload to storage
        await fs.unlink(filePath);
        console.log(`[Upload] ✓ Local file cleaned up: ${filePath}`);
      } catch (storageError) {
        console.error('[Upload] ⚠️ Failed to upload to Supabase Storage:', storageError);
        console.log('[Upload] Continuing with local file fallback');
        // Continue anyway - we'll keep the local file as fallback
      }

      const patent = await supabaseStorage.createPatent({
        user_id: user?.id || null,
        title: parsedPatent.title,
        inventors: parsedPatent.inventors,
        assignee: parsedPatent.assignee,
        filing_date: parsedPatent.filingDate,
        issue_date: parsedPatent.issueDate,
        patent_number: parsedPatent.patentNumber,
        application_number: parsedPatent.applicationNumber,
        patent_classification: parsedPatent.patentClassification,
        full_text: parsedPatent.fullText,
        pdf_filename: filename,
        pdf_storage_path: pdfStoragePath,
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

        // Generate friendly title from ELIA15
        try {
          const { generateFriendlyTitle, extractELIA15Introduction } = await import('./services/titleGenerator');
          const introduction = extractELIA15Introduction(elia15Result.content);
          const friendlyTitle = await generateFriendlyTitle({
            patentTitle: parsedPatent.title || 'Untitled Patent',
            elia15Introduction: introduction,
          });
          await supabaseStorage.updatePatentFriendlyTitle(patent.id, friendlyTitle);
          console.log(`✓ Generated friendly title: "${friendlyTitle}"`);
        } catch (error) {
          console.error('Failed to generate friendly title:', error);
          // Don't fail the upload if title generation fails
        }

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
          patentNumber: patent.patent_number,
          applicationNumber: patent.application_number,
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

  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      const { data, error } = await supabaseAdmin.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      res.json({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({ error: 'Failed to refresh session' });
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
    // Prevent HTTP caching for user-specific data
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    console.log('[Dashboard] Request from user:', req.user?.id);

    try {
      const patents = await supabaseStorage.getPatentsByUser(req.user!.id);
      console.log('[Dashboard] Found', patents.length, 'patents for user');

      const patentsWithArtifactCount = await Promise.all(
        patents.map(async (patent) => {
          const artifacts = await supabaseStorage.getArtifactsByPatent(patent.id);
          return {
            id: patent.id,
            title: patent.title,
            friendlyTitle: patent.friendly_title,
            assignee: patent.assignee,
            filingDate: patent.filing_date,
            patentNumber: patent.patent_number,
            applicationNumber: patent.application_number,
            patentClassification: patent.patent_classification,
            status: patent.status,
            createdAt: patent.created_at,
            artifactCount: artifacts.length,
          };
        })
      );

      console.log('[Dashboard] Responding with', patentsWithArtifactCount.length, 'patents');
      res.json({ patents: patentsWithArtifactCount });

    } catch (error) {
      console.error('[Dashboard] Error:', error);
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
          friendlyTitle: patent.friendly_title,
          inventors: patent.inventors,
          assignee: patent.assignee,
          filingDate: patent.filing_date,
          issueDate: patent.issue_date,
          patentNumber: patent.patent_number,
          applicationNumber: patent.application_number,
          patentClassification: patent.patent_classification,
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

  // SSE endpoint for real-time progress tracking
  app.get('/api/patent/:id/progress', requireAuth, async (req, res) => {
    try {
      const patentId = req.params.id;

      // Verify ownership
      const patent = await supabaseStorage.getPatent(patentId);
      if (!patent || patent.user_id !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // SSE setup
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Send initial progress from database if exists
      const initialProgress = await getProgressFromDb(patentId);
      if (initialProgress) {
        res.write(`data: ${JSON.stringify(initialProgress)}\n\n`);
        if (initialProgress.complete) {
          return res.end();
        }
      }

      // Poll for updates every 2 seconds
      const sendProgress = () => {
        const progress = getProgress(patentId);
        if (progress) {
          res.write(`data: ${JSON.stringify(progress)}\n\n`);
          if (progress.complete) {
            clearInterval(interval);
            res.end();
          }
        }
      };

      const interval = setInterval(sendProgress, 2000);

      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(interval);
        res.end();
      });

    } catch (error) {
      console.error('Progress SSE error:', error);
      res.status(500).json({ error: 'Failed to stream progress' });
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

  const requireSuperAdmin = async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const profile = await supabaseStorage.getProfile(req.user.id);
    if (!profile?.is_super_admin) {
      return res.status(403).json({ error: 'Super admin access required' });
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

      // Map database fields (snake_case) to frontend fields (camelCase)
      const mappedPatents = patents.map(patent => ({
        id: patent.id,
        userId: patent.user_id,
        title: patent.title,
        friendlyTitle: patent.friendly_title,
        inventors: patent.inventors,
        assignee: patent.assignee,
        filingDate: patent.filing_date,
        issueDate: patent.issue_date,
        patentNumber: patent.patent_number,
        applicationNumber: patent.application_number,
        patentClassification: patent.patent_classification,
        fullText: patent.full_text, // Include full_text for re-extraction
        pdfFilename: patent.pdf_filename,
        pdfStoragePath: patent.pdf_storage_path,
        status: patent.status,
        errorMessage: patent.error_message,
        createdAt: patent.created_at,
        updatedAt: patent.updated_at,
      }));

      res.json({ patents: mappedPatents });
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

  app.post('/api/admin/users/:id/admin', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { isAdmin } = req.body;
      await supabaseStorage.updateProfileAdmin(req.params.id, !!isAdmin);
      await supabaseStorage.createAuditLog(req.user!.id, 'update_admin_status', 'user', req.params.id, { isAdmin });
      await supabaseStorage.logUserManagementAction(req.user!.id, 'toggle_admin', req.params.id, { isAdmin });
      res.json({ success: true });
    } catch (error) {
      console.error('Admin update error:', error);
      res.status(500).json({ error: 'Failed to update admin status' });
    }
  });

  // Create user (super admin only)
  app.post('/api/admin/users', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { email, credits, isAdmin } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Check if user already exists
      const existing = await supabaseStorage.getProfileByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const profile = await supabaseStorage.createUserByAdmin(email, credits || 100);

      if (isAdmin) {
        await supabaseStorage.updateProfileAdmin(profile.id, true);
      }

      await supabaseStorage.logUserManagementAction(req.user!.id, 'create_user', profile.id, { email, credits, isAdmin });

      res.json({ success: true, user: profile });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  // Delete user (super admin only)
  app.delete('/api/admin/users/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Prevent self-deletion
      if (id === req.user!.id) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
      }

      await supabaseStorage.deleteUserByAdmin(id);
      await supabaseStorage.logUserManagementAction(req.user!.id, 'delete_user', id, {});

      res.json({ success: true });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
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

  // Re-extract metadata from stored full_text (admin only)
  app.post('/api/admin/patent/:id/re-extract', requireAuth, requireAdmin, async (req, res) => {
    try {
      const patentId = req.params.id;
      const patent = await supabaseStorage.getPatent(patentId);

      if (!patent) {
        return res.status(404).json({ error: 'Patent not found' });
      }

      if (!patent.full_text) {
        return res.status(400).json({
          error: 'No text available for this patent',
          details: 'Patent text was not saved during upload. Cannot re-extract metadata.'
        });
      }

      console.log(`[Re-extract] Re-extracting metadata from full_text for patent ${patentId}`);

      // Extract metadata directly from stored full_text (no PDF needed!)
      const { extractMetadataFromText } = await import('./services/pdfParser');
      const parsedPatent = await extractMetadataFromText(patent.full_text, patentId);

      // Update patent metadata (keep full_text, status, and other fields intact)
      await supabaseAdmin
        .from('patents')
        .update({
          title: parsedPatent.title,
          inventors: parsedPatent.inventors,
          assignee: parsedPatent.assignee,
          filing_date: parsedPatent.filingDate,
          issue_date: parsedPatent.issueDate,
          patent_number: parsedPatent.patentNumber,
          application_number: parsedPatent.applicationNumber,
          patent_classification: parsedPatent.patentClassification,
          updated_at: new Date().toISOString(),
        })
        .eq('id', patentId);

      console.log(`[Re-extract] ✓ Updated metadata for patent ${patentId}`);
      console.log(`  Assignee: ${parsedPatent.assignee || 'NOT FOUND'}`);
      console.log(`  Inventors: ${parsedPatent.inventors || 'NOT FOUND'}`);

      // Return updated patent
      const updatedPatent = await supabaseStorage.getPatent(patentId);
      res.json({ success: true, patent: updatedPatent });

    } catch (error) {
      console.error('Re-extract metadata error:', error);
      res.status(500).json({ error: 'Failed to re-extract metadata', details: (error as Error).message });
    }
  });

  // Manually update patent metadata (admin only)
  app.put('/api/admin/patent/:id/metadata', requireAuth, requireAdmin, async (req, res) => {
    try {
      const patentId = req.params.id;
      const { inventors, assignee, filingDate, issueDate, patentNumber, applicationNumber, patentClassification } = req.body;

      const patent = await supabaseStorage.getPatent(patentId);
      if (!patent) {
        return res.status(404).json({ error: 'Patent not found' });
      }

      console.log(`[Manual Update] Updating metadata for patent ${patentId}`);
      console.log(`  Assignee: ${assignee || '(no change)'}`);
      console.log(`  Inventors: ${inventors || '(no change)'}`);

      // Build update object (only update provided fields)
      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (inventors !== undefined) updates.inventors = inventors;
      if (assignee !== undefined) updates.assignee = assignee;
      if (filingDate !== undefined) updates.filing_date = filingDate;
      if (issueDate !== undefined) updates.issue_date = issueDate;
      if (patentNumber !== undefined) updates.patent_number = patentNumber;
      if (applicationNumber !== undefined) updates.application_number = applicationNumber;
      if (patentClassification !== undefined) updates.patent_classification = patentClassification;

      await supabaseAdmin
        .from('patents')
        .update(updates)
        .eq('id', patentId);

      // Log manual corrections for learning system
      const fieldsToLog = [
        { key: 'inventors', oldValue: patent.inventors, newValue: inventors },
        { key: 'assignee', oldValue: patent.assignee, newValue: assignee },
        { key: 'filingDate', oldValue: patent.filing_date, newValue: filingDate },
        { key: 'applicationNumber', oldValue: patent.application_number, newValue: applicationNumber },
      ];

      for (const field of fieldsToLog) {
        // Only log if value actually changed
        if (field.newValue !== undefined && field.oldValue !== field.newValue) {
          const context = findValueContext(patent.full_text, field.newValue);

          await logMetadataCorrection({
            patentId,
            fieldName: field.key,
            originalValue: field.oldValue,
            correctedValue: field.newValue,
            correctedBy: req.user!.id,
            contextBefore: context?.before,
            contextAfter: context?.after,
            valuePositionStart: context?.valueStart,
            valuePositionEnd: context?.valueEnd,
          });

          console.log(`[Manual Update] Logged correction for ${field.key}`);
        }
      }

      console.log(`[Manual Update] ✓ Metadata updated for patent ${patentId}`);

      // Get correction counts for smart notifications
      const opportunities = await getPendingCorrectionCounts();

      // Return updated patent with smart notifications
      const updatedPatent = await supabaseStorage.getPatent(patentId);
      res.json({
        success: true,
        patent: updatedPatent,
        // Smart notifications for hybrid learning system
        opportunities: opportunities.map((opp) => ({
          fieldName: opp.fieldName,
          count: opp.count,
          ready: opp.ready,
          message:
            opp.ready
              ? `${opp.count} corrections collected for ${opp.fieldName}. Pattern analysis ready!`
              : `${opp.count} corrections collected for ${opp.fieldName}`,
        })),
      });

    } catch (error) {
      console.error('Manual metadata update error:', error);
      res.status(500).json({ error: 'Failed to update metadata' });
    }
  });

  // ============================================================================
  // PATTERN LEARNING ENDPOINTS (Admin only)
  // ============================================================================

  // Get pattern opportunities (correction counts by field)
  app.get('/api/admin/patterns/opportunities', requireAuth, requireAdmin, async (req, res) => {
    try {
      const opportunities = await getPendingCorrectionCounts();
      res.json({ opportunities });
    } catch (error) {
      console.error('Error getting pattern opportunities:', error);
      res.status(500).json({ error: 'Failed to get opportunities' });
    }
  });

  // Analyze corrections for a field and generate pattern suggestions
  app.post('/api/admin/patterns/analyze', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { fieldName, minCorrections } = req.body;

      if (!fieldName) {
        return res.status(400).json({ error: 'Field name required' });
      }

      console.log(`[Pattern Analysis] Analyzing field: ${fieldName}`);

      const suggestions = await analyzeFieldCorrections(fieldName, minCorrections || 5);

      res.json({
        success: true,
        fieldName,
        suggestionsCount: suggestions.length,
        suggestions,
      });
    } catch (error) {
      console.error('Error analyzing corrections:', error);
      res.status(500).json({
        error: 'Failed to analyze corrections',
        details: (error as Error).message,
      });
    }
  });

  // Deploy a learned pattern
  app.post('/api/admin/patterns/deploy', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { fieldName, pattern, description, correctionIds, priority } = req.body;

      if (!fieldName || !pattern || !correctionIds) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      console.log(`[Pattern Deploy] Deploying pattern for ${fieldName}`);

      const patternId = await deployPattern(
        fieldName,
        pattern,
        description || 'Pattern learned from corrections',
        correctionIds,
        priority || 50, // Default priority for AI-generated patterns
        req.user!.id
      );

      res.json({
        success: true,
        patternId,
      });
    } catch (error) {
      console.error('Error deploying pattern:', error);
      res.status(500).json({
        error: 'Failed to deploy pattern',
        details: (error as Error).message,
      });
    }
  });

  // Get all learned patterns
  app.get('/api/admin/patterns', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('learned_patterns')
        .select('*')
        .order('field_name', { ascending: true })
        .order('priority', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      res.json({ patterns: data || [] });
    } catch (error) {
      console.error('Error getting patterns:', error);
      res.status(500).json({ error: 'Failed to get patterns' });
    }
  });

  // Toggle pattern active status
  app.put('/api/admin/patterns/:id/toggle', requireAuth, requireAdmin, async (req, res) => {
    try {
      const patternId = req.params.id;
      const { isActive } = req.body;

      if (isActive === undefined) {
        return res.status(400).json({ error: 'isActive required' });
      }

      const { error } = await supabaseAdmin
        .from('learned_patterns')
        .update({ is_active: isActive })
        .eq('id', patternId);

      if (error) {
        throw new Error(error.message);
      }

      console.log(`[Pattern Toggle] Pattern ${patternId} ${isActive ? 'activated' : 'deactivated'}`);

      res.json({ success: true });
    } catch (error) {
      console.error('Error toggling pattern:', error);
      res.status(500).json({ error: 'Failed to toggle pattern' });
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
    // Extend timeout for image generation (DALL-E can take 30-60+ seconds per image)
    req.setTimeout(5 * 60 * 1000); // 5 minutes
    res.setTimeout(5 * 60 * 1000);

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
    // Extend timeout for image generation (DALL-E can take 30-60+ seconds)
    req.setTimeout(2 * 60 * 1000); // 2 minutes
    res.setTimeout(2 * 60 * 1000);

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

      // Parse sections to get the title and content
      const { parseMarkdownSections } = await import('./services/sectionParser');
      const sections = parseMarkdownSections(artifact.content);
      const section = sections.find(s => s.number === parseInt(sectionNumber));

      if (!section) {
        return res.status(404).json({ error: 'Section not found' });
      }

      // Generate single image with section content for Claude analysis
      const { generateSingleSectionImage } = await import('./services/artifactImageService');
      const sectionImage = await generateSingleSectionImage({
        artifactId,
        artifactType: artifact.artifact_type as 'elia15' | 'business_narrative' | 'golden_circle',
        sectionNumber: parseInt(sectionNumber),
        sectionTitle: section.title,
        sectionContent: section.content, // Pass content for patent-specific prompts
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

  // Hero Image Routes

  // Get hero image for a patent
  app.get('/api/patent/:patentId/hero-image', async (req, res) => {
    try {
      const { patentId} = req.params;
      const heroImage = await supabaseStorage.getPatentHeroImage(patentId);

      if (!heroImage) {
        return res.status(404).json({ error: 'Hero image not found' });
      }

      res.json(heroImage);
    } catch (error) {
      console.error('Error fetching hero image:', error);
      res.status(500).json({ error: 'Failed to fetch hero image' });
    }
  });

  // Generate hero image for a patent
  app.post('/api/patent/:patentId/hero-image', async (req, res) => {
    req.setTimeout(2 * 60 * 1000);
    res.setTimeout(2 * 60 * 1000);

    try {
      const { patentId } = req.params;

      // Get patent and ELIA15
      const patent = await supabaseStorage.getPatent(patentId);
      const artifacts = await supabaseStorage.getArtifactsByPatent(patentId);
      const elia15 = artifacts.find(a => a.artifact_type === 'elia15');

      if (!patent || !elia15) {
        return res.status(404).json({ error: 'Patent or ELIA15 not found' });
      }

      const { generatePatentHeroImage } = await import('./services/patentHeroImageService');
      const heroImageResult = await generatePatentHeroImage({
        patentId,
        elia15Content: elia15.content,
        patentTitle: patent.title || 'Untitled Patent',
        friendlyTitle: patent.friendly_title || undefined,
      });

      // Save to database
      const heroImage = await supabaseStorage.upsertPatentHeroImage({
        patent_id: patentId,
        image_url: heroImageResult.imageUrl,
        prompt_used: heroImageResult.promptUsed,
        image_title: heroImageResult.revisedPrompt || 'Patent hero visualization',
        generation_metadata: {
          model: 'dall-e-3',
          size: '1024x1024',
          quality: 'standard',
          revisedPrompt: heroImageResult.revisedPrompt,
          costUSD: heroImageResult.costUSD,
          generationTimeSeconds: heroImageResult.generationTimeSeconds,
        },
      });

      res.json(heroImage);
    } catch (error) {
      console.error('Error generating hero image:', error);
      res.status(500).json({ error: 'Failed to generate hero image' });
    }
  });

  // Friendly Title Routes

  // Update patent friendly title
  app.put('/api/patent/:patentId/friendly-title', requireAuth, async (req, res) => {
    try {
      const { patentId } = req.params;
      const { friendlyTitle } = req.body;

      // Validate
      if (!friendlyTitle || friendlyTitle.length > 60) {
        return res.status(400).json({ error: 'Title must be 1-60 characters' });
      }

      // Check ownership
      const patent = await supabaseStorage.getPatent(patentId);
      if (!patent || patent.user_id !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await supabaseStorage.updatePatentFriendlyTitle(patentId, friendlyTitle);
      res.json({ success: true, friendlyTitle });
    } catch (error) {
      console.error('Error updating friendly title:', error);
      res.status(500).json({ error: 'Failed to update title' });
    }
  });

  // System Prompt Routes (Super Admin Only)

  // Get all active system prompts
  app.get('/api/admin/system-prompts', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { getAllActivePrompts } = await import('./services/SystemPromptService');
      const prompts = await getAllActivePrompts();
      res.json(prompts);
    } catch (error) {
      console.error('Error fetching system prompts:', error);
      res.status(500).json({ error: 'Failed to fetch system prompts' });
    }
  });

  // Get all versions of a specific prompt type
  app.get('/api/admin/system-prompts/:promptType/versions', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { promptType } = req.params;
      const { getAllPromptVersions } = await import('./services/SystemPromptService');
      const versions = await getAllPromptVersions(promptType as any);
      res.json(versions);
    } catch (error) {
      console.error('Error fetching prompt versions:', error);
      res.status(500).json({ error: 'Failed to fetch versions' });
    }
  });

  // Update a system prompt (creates new version)
  app.put('/api/admin/system-prompts/:promptType', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { promptType } = req.params;
      const { systemPrompt, notes } = req.body;

      if (!systemPrompt) {
        return res.status(400).json({ error: 'System prompt is required' });
      }

      const { updateSystemPrompt } = await import('./services/SystemPromptService');
      const updated = await updateSystemPrompt(
        promptType as any,
        systemPrompt,
        req.user!.id,
        notes
      );

      res.json(updated);
    } catch (error) {
      console.error('Error updating system prompt:', error);
      res.status(500).json({ error: 'Failed to update prompt' });
    }
  });

  // Rollback to a previous version
  app.post('/api/admin/system-prompts/rollback', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { promptType, versionId } = req.body;

      if (!promptType || !versionId) {
        return res.status(400).json({ error: 'promptType and versionId are required' });
      }

      const { rollbackToVersion } = await import('./services/SystemPromptService');
      const rolled = await rollbackToVersion(promptType, versionId);

      res.json(rolled);
    } catch (error) {
      console.error('Error rolling back prompt:', error);
      res.status(500).json({ error: 'Failed to rollback' });
    }
  });

  // Update section image prompt (for editing individual image prompts)
  app.put('/api/images/:imageId/prompt', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { imageId } = req.params;
      const { promptUsed } = req.body;

      if (!promptUsed) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const { error } = await supabaseAdmin
        .from('section_images')
        .update({ prompt_used: promptUsed })
        .eq('id', imageId);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating image prompt:', error);
      res.status(500).json({ error: 'Failed to update prompt' });
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
    // Stage 1: Generate Business Narrative (1/2)
    await updateProgress({
      patentId,
      stage: 'artifacts',
      current: 1,
      total: 2,
      message: 'Generating Business Narrative...',
      complete: false,
    });

    const narrativeResult = await generateBusinessNarrative(fullText, elia15Content);
    await supabaseStorage.createArtifact({
      patent_id: patentId,
      artifact_type: 'business_narrative',
      content: narrativeResult.content,
      tokens_used: narrativeResult.tokensUsed,
      generation_time_seconds: narrativeResult.generationTimeSeconds,
    });

    // Stage 2: Generate Golden Circle (2/2)
    await updateProgress({
      patentId,
      stage: 'artifacts',
      current: 2,
      total: 2,
      message: 'Generating Golden Circle...',
      complete: false,
    });

    const goldenCircleResult = await generateGoldenCircle(fullText, elia15Content);
    await supabaseStorage.createArtifact({
      patent_id: patentId,
      artifact_type: 'golden_circle',
      content: goldenCircleResult.content,
      tokens_used: goldenCircleResult.tokensUsed,
      generation_time_seconds: goldenCircleResult.generationTimeSeconds,
    });

    await supabaseStorage.updatePatentStatus(patentId, 'completed');
    console.log('All artifacts generated for patent:', patentId);

    // Stage 3: Generate hero image
    await updateProgress({
      patentId,
      stage: 'hero_image',
      current: 0,
      total: 1,
      message: 'Generating hero image...',
      complete: false,
    });

    try {
      const patent = await supabaseStorage.getPatent(patentId);
      const { generatePatentHeroImage } = await import('./services/patentHeroImageService');

      console.log(`[HeroImage] Starting hero image generation for patent ${patentId}`);

      const heroImageResult = await generatePatentHeroImage({
        patentId,
        elia15Content,
        patentTitle: patentTitle || 'Untitled Patent',
        friendlyTitle: patent?.friendly_title || undefined,
      });

      console.log(`[HeroImage] Hero image generated, saving to database...`);

      await supabaseStorage.upsertPatentHeroImage({
        patent_id: patentId,
        image_url: heroImageResult.imageUrl,
        prompt_used: heroImageResult.promptUsed,
        image_title: heroImageResult.revisedPrompt || 'Patent hero visualization',
        generation_metadata: {
          model: 'dall-e-3',
          size: '1024x1024',
          quality: 'standard',
          revisedPrompt: heroImageResult.revisedPrompt,
          costUSD: heroImageResult.costUSD,
          generationTimeSeconds: heroImageResult.generationTimeSeconds,
        },
      });

      console.log('✓ Generated hero image for patent', patentId);
    } catch (error) {
      console.error('❌ FAILED to generate hero image for patent', patentId);
      console.error('Error details:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      // Don't fail the whole process if hero image fails
    }

    // Stage 4: Auto-generate section images for all artifacts (parallel)
    console.log(`[SectionImages] Starting auto-generation for all artifacts...`);

    try {
      const artifacts = await supabaseStorage.getArtifactsByPatent(patentId);
      const { generateArtifactImagesParallel } = await import('./services/parallelImageGenerator');

      // Count total sections across all artifacts
      const { parseMarkdownSections } = await import('./services/sectionParser');
      let totalSections = 0;
      for (const artifact of artifacts) {
        const sections = parseMarkdownSections(artifact.content);
        totalSections += sections.length;
      }

      console.log(`[SectionImages] Generating images for ${totalSections} sections across ${artifacts.length} artifacts`);

      await updateProgress({
        patentId,
        stage: 'section_images',
        current: 0,
        total: totalSections,
        message: 'Generating section images...',
        complete: false,
      });

      // Generate images for all artifacts in parallel (3 at a time to respect rate limits)
      await generateArtifactImagesParallel(
        artifacts,
        patentId,
        totalSections,
        async (current: number) => {
          await updateProgress({
            patentId,
            stage: 'section_images',
            current,
            total: totalSections,
            message: `Generating images (${current}/${totalSections})...`,
            complete: false,
          });
        }
      );

      console.log(`✓ Generated all section images for patent ${patentId}`);
    } catch (error) {
      console.error('❌ FAILED to auto-generate section images for patent', patentId);
      console.error('Error details:', error);
      // Don't fail the whole process if section images fail
    }

    // Complete!
    await updateProgress({
      patentId,
      stage: 'section_images',
      current: 0,
      total: 0,
      message: 'Patent processing complete!',
      complete: true,
    });

    await NotificationService.sendPatentReady(userId, patentId, patentTitle);

  } catch (error) {
    console.error('Error generating remaining artifacts:', error);
    await supabaseStorage.updatePatentStatus(patentId, 'failed', 'Failed to generate all artifacts');

    await updateProgress({
      patentId,
      stage: 'artifacts',
      current: 0,
      total: 0,
      message: `Error: ${(error as Error).message}`,
      complete: true,
    });

    await NotificationService.sendProcessingError(userId, patentId, patentTitle, (error as Error).message);
  }
}
