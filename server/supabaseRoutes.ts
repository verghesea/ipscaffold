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

        generateRemainingArtifacts(patent.id, parsedPatent.fullText, elia15Result.content).catch(console.error);

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

      res.json({
        balance: profile?.credits || 0,
        transactions: [],
      });

    } catch (error) {
      console.error('Credits error:', error);
      res.status(500).json({ error: 'Failed to load credits' });
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
