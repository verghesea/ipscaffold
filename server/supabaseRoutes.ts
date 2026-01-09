import type { Express } from "express";
import { createServer, type Server } from "http";
import { supabaseStorage } from "./supabaseStorage";
import { supabaseAdmin, supabase, supabaseUrl, supabaseAnonKey } from "./lib/supabase";
import multer from "multer";
import { nanoid } from "nanoid";
import fs from "fs/promises";
import { parsePatentPDF } from "./services/pdfParser";
import { generateELIA15, generateBusinessNarrative, generateGoldenCircle } from "./services/aiGenerator";

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

      const filePath = req.file.path;
      const filename = req.file.filename;
      const parsedPatent = await parsePatentPDF(filePath);

      const patent = await supabaseStorage.createPatent({
        user_id: req.session.userId || null,
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
        showEmailGate: !req.session.userId
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
      
      // Store patent ID in session for retrieval after auth
      if (patentId) {
        req.session.pendingPatentId = patentId;
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      const { data, error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: `${appUrl}/auth/confirm`,
          shouldCreateUser: true,
          data: patentId ? { pending_patent_id: patentId } : undefined,
        }
      });

      if (error) {
        console.error('Magic link error:', error);
        return res.status(500).json({ error: 'Failed to send magic link' });
      }

      console.log('Magic link sent to:', email);

      res.json({ success: true, message: 'Magic link sent to your email', patentId });

    } catch (error) {
      console.error('Magic link error:', error);
      res.status(500).json({ error: 'Failed to send magic link' });
    }
  });

  // Handle PKCE token verification (when using token_hash from email templates)
  app.get('/auth/confirm', async (req, res) => {
    try {
      const { token_hash, type } = req.query;
      const appUrl = process.env.APP_URL || 'https://ipscaffold.replit.app';
      
      console.log('Auth confirm request:', { token_hash: token_hash?.toString().substring(0, 10) + '...', type });
      
      if (!token_hash || !type) {
        console.error('Missing token_hash or type');
        return res.redirect(`${appUrl}/?error=missing_token`);
      }

      // Verify the OTP token
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token_hash as string,
        type: type as any,
      });

      console.log('Verify OTP result:', { 
        hasSession: !!data?.session, 
        hasUser: !!data?.user,
        error: error?.message 
      });

      if (error || !data.session || !data.user) {
        console.error('Token verification error:', error);
        return res.redirect(`${appUrl}/?error=invalid_token&message=${encodeURIComponent(error?.message || 'Unknown error')}`);
      }
      
      const { session, user } = data;

      // Get patent ID from user metadata
      const patentId = user.user_metadata?.pending_patent_id;
      
      // Set up session
      req.session.userId = user.id;
      req.session.accessToken = session.access_token;
      req.session.refreshToken = session.refresh_token;

      // Handle patent claiming if we have a patent ID
      if (patentId) {
        const profile = await supabaseStorage.getProfile(user.id);
        const patent = await supabaseStorage.getPatent(patentId);
        
        if (patent && !patent.user_id && profile && profile.credits >= 10) {
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
        }
      }

      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Redirect to patent page or dashboard
      const redirectTo = patentId ? `/patent/${patentId}` : '/dashboard';
      res.redirect(redirectTo);

    } catch (error) {
      console.error('Auth confirm error:', error);
      const appUrl = process.env.APP_URL || 'https://ipscaffold.replit.app';
      res.redirect(`${appUrl}/?error=auth_failed`);
    }
  });

  app.post('/api/auth/verify-session', async (req, res) => {
    try {
      const { accessToken, refreshToken, patentId } = req.body;

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token required' });
      }

      const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

      if (error || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      req.session.userId = user.id;
      req.session.accessToken = accessToken;
      req.session.refreshToken = refreshToken;

      const profile = await supabaseStorage.getProfile(user.id);

      if (patentId) {
        const patent = await supabaseStorage.getPatent(patentId);
        if (patent && !patent.user_id && profile) {
          if (profile.credits >= 10) {
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
          }
        }
      }

      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({ 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          credits: profile?.credits || 100,
        }
      });

    } catch (error) {
      console.error('Session verification error:', error);
      res.status(500).json({ error: 'Failed to verify session' });
    }
  });

  app.get('/api/user', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const profile = await supabaseStorage.getProfile(req.session.userId);
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
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get('/api/dashboard', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      const patents = await supabaseStorage.getPatentsByUser(req.session.userId);
      
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

  app.get('/api/patent/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      const patentId = req.params.id;
      const patent = await supabaseStorage.getPatent(patentId);

      if (!patent || patent.user_id !== req.session.userId) {
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
        },
        artifacts: artifacts.map(a => ({
          type: a.artifact_type,
          content: a.content,
        })),
      });

    } catch (error) {
      console.error('Patent detail error:', error);
      res.status(500).json({ error: 'Failed to load patent' });
    }
  });

  app.post('/api/patent/:id/generate', async (req, res) => {
    try {
      const patentId = req.params.id;
      const patent = await supabaseStorage.getPatent(patentId);

      if (!patent) {
        return res.status(404).json({ error: 'Patent not found' });
      }

      if (patent.status === 'completed' || patent.status === 'failed') {
        return res.json({ status: patent.status });
      }

      const artifacts = await supabaseStorage.getArtifactsByPatent(patentId);
      const hasElia15 = artifacts.some(a => a.artifact_type === 'elia15');
      const hasNarrative = artifacts.some(a => a.artifact_type === 'business_narrative');
      const hasGoldenCircle = artifacts.some(a => a.artifact_type === 'golden_circle');

      if (hasElia15 && hasNarrative && hasGoldenCircle) {
        await supabaseStorage.updatePatentStatus(patentId, 'completed');
        return res.json({ status: 'completed' });
      }

      const elia15 = artifacts.find(a => a.artifact_type === 'elia15');
      
      if (!hasElia15) {
        return res.json({ status: 'processing', message: 'ELIA15 not yet generated' });
      }

      try {
        if (!hasNarrative) {
          const narrativeResult = await generateBusinessNarrative(patent.full_text, elia15!.content);
          await supabaseStorage.createArtifact({
            patent_id: patentId,
            artifact_type: 'business_narrative',
            content: narrativeResult.content,
            tokens_used: narrativeResult.tokensUsed,
            generation_time_seconds: narrativeResult.generationTimeSeconds,
          });
        }

        if (!hasGoldenCircle) {
          const updatedArtifacts = await supabaseStorage.getArtifactsByPatent(patentId);
          const narrative = updatedArtifacts.find(a => a.artifact_type === 'business_narrative');
          
          const goldenCircleResult = await generateGoldenCircle(elia15!.content, narrative?.content || '');
          await supabaseStorage.createArtifact({
            patent_id: patentId,
            artifact_type: 'golden_circle',
            content: goldenCircleResult.content,
            tokens_used: goldenCircleResult.tokensUsed,
            generation_time_seconds: goldenCircleResult.generationTimeSeconds,
          });
        }

        await supabaseStorage.updatePatentStatus(patentId, 'completed');
        res.json({ status: 'completed' });

      } catch (error) {
        console.error('Error generating artifacts:', error);
        await supabaseStorage.updatePatentStatus(patentId, 'failed', 'Failed to generate artifacts');
        res.json({ status: 'failed' });
      }

    } catch (error) {
      console.error('Generate error:', error);
      res.status(500).json({ error: 'Failed to generate artifacts' });
    }
  });

  return httpServer;
}

async function generateRemainingArtifacts(
  patentId: string,
  fullText: string,
  elia15Content: string
): Promise<void> {
  try {
    const narrativeResult = await generateBusinessNarrative(fullText, elia15Content);
    await supabaseStorage.createArtifact({
      patent_id: patentId,
      artifact_type: 'business_narrative',
      content: narrativeResult.content,
      tokens_used: narrativeResult.tokensUsed,
      generation_time_seconds: narrativeResult.generationTimeSeconds,
    });

    const goldenCircleResult = await generateGoldenCircle(elia15Content, narrativeResult.content);
    await supabaseStorage.createArtifact({
      patent_id: patentId,
      artifact_type: 'golden_circle',
      content: goldenCircleResult.content,
      tokens_used: goldenCircleResult.tokensUsed,
      generation_time_seconds: goldenCircleResult.generationTimeSeconds,
    });

    await supabaseStorage.updatePatentStatus(patentId, 'completed');
    
  } catch (error) {
    console.error('Error generating remaining artifacts:', error);
    await supabaseStorage.updatePatentStatus(patentId, 'failed', 'Failed to generate all artifacts');
  }
}
