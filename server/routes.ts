import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs/promises";
import { parsePatentPDF } from "./services/pdfParser";
import { generateELIA15, generateBusinessNarrative, generateGoldenCircle } from "./services/aiGenerator";
import { sendMagicLinkEmail } from "./services/emailService";

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      const uniqueName = `${nanoid()}.pdf`;
      cb(null, uniqueName);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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
  
  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Upload patent PDF
  app.post('/api/upload', upload.single('pdf'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filePath = req.file.path;
      const filename = req.file.filename;

      // Parse PDF
      const parsedPatent = await parsePatentPDF(filePath);

      // Create patent record
      const patent = await storage.createPatent({
        userId: req.session.userId || null,
        title: parsedPatent.title,
        inventors: parsedPatent.inventors,
        assignee: parsedPatent.assignee,
        filingDate: parsedPatent.filingDate,
        issueDate: parsedPatent.issueDate,
        fullText: parsedPatent.fullText,
        pdfFilename: filename,
        status: 'processing',
      });

      // Generate ELIA15 (blocking)
      try {
        const elia15Result = await generateELIA15(
          parsedPatent.fullText,
          parsedPatent.title || 'Patent Document'
        );

        await storage.createArtifact({
          patentId: patent.id,
          artifactType: 'elia15',
          content: elia15Result.content,
          tokensUsed: elia15Result.tokensUsed,
          generationTimeSeconds: elia15Result.generationTimeSeconds,
        });

        await storage.updatePatentStatus(patent.id, 'elia15_complete');

        res.json({ 
          success: true, 
          patentId: patent.id,
          message: 'Patent uploaded and ELIA15 generated successfully'
        });

        // Generate remaining artifacts in background (non-blocking)
        generateRemainingArtifacts(patent.id, parsedPatent.fullText, elia15Result.content).catch(console.error);

      } catch (error) {
        console.error('Error generating ELIA15:', error);
        await storage.updatePatentStatus(patent.id, 'failed', 'Failed to generate ELIA15');
        res.status(500).json({ error: 'Failed to generate analysis' });
      }

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to process patent' });
    }
  });

  // Get patent preview (with ELIA15)
  app.get('/api/preview/:id', async (req, res) => {
    try {
      const patentId = parseInt(req.params.id);
      const patent = await storage.getPatent(patentId);

      if (!patent) {
        return res.status(404).json({ error: 'Patent not found' });
      }

      const artifacts = await storage.getArtifactsByPatent(patentId);
      const elia15 = artifacts.find(a => a.artifactType === 'elia15');

      res.json({
        patent: {
          id: patent.id,
          title: patent.title,
          assignee: patent.assignee,
          filingDate: patent.filingDate,
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

  // Request access (magic link)
  app.post('/api/request-access', async (req, res) => {
    try {
      const { email, patentId } = req.body;

      if (!email || !patentId) {
        return res.status(400).json({ error: 'Email and patent ID required' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      
      // Find or create user
      let user = await storage.getUserByEmail(normalizedEmail);
      
      if (!user) {
        user = await storage.createUser({
          email: normalizedEmail,
          credits: 100,
          isAdmin: false,
        });

        // Create signup bonus transaction
        await storage.createCreditTransaction({
          userId: user.id,
          amount: 100,
          balanceAfter: 100,
          transactionType: 'signup_bonus',
          description: 'Welcome bonus',
        });
      }

      // Assign patent to user if unclaimed and deduct credits
      const patent = await storage.getPatent(parseInt(patentId));
      if (patent && !patent.userId) {
        // Check if user has enough credits
        if (user.credits < 10) {
          return res.status(400).json({ error: 'Insufficient credits. You need 10 credits per patent.' });
        }

        // Assign patent to user
        await storage.updatePatentUserId(patent.id, user.id);
        
        // Deduct credits
        const newBalance = user.credits - 10;
        await storage.updateUserCredits(user.id, newBalance);
        
        // Record transaction
        await storage.createCreditTransaction({
          userId: user.id,
          amount: -10,
          balanceAfter: newBalance,
          transactionType: 'ip_processing',
          description: `Patent analysis: ${patent.title}`,
          patentId: patent.id,
        });
      }

      // Create magic token
      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.createMagicToken({
        userId: user.id,
        token,
        patentId: parseInt(patentId),
        expiresAt,
        usedAt: null,
      });

      // Send email
      await sendMagicLinkEmail(
        normalizedEmail,
        token,
        patent?.title || 'Your Patent'
      );

      res.json({ success: true, message: 'Magic link sent' });

    } catch (error) {
      console.error('Request access error:', error);
      res.status(500).json({ error: 'Failed to send magic link' });
    }
  });

  // Verify magic link token
  app.get('/api/auth/verify/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      const magicToken = await storage.getMagicToken(token);

      if (!magicToken) {
        return res.redirect('/?error=invalid_token');
      }

      if (magicToken.usedAt) {
        return res.redirect('/?error=token_used');
      }

      if (new Date() > magicToken.expiresAt) {
        return res.redirect('/?error=token_expired');
      }

      // Mark token as used
      await storage.markTokenUsed(token);

      // Update last login
      await storage.updateUserLastLogin(magicToken.userId);

      // Set session
      req.session.userId = magicToken.userId;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Redirect to dashboard
      res.redirect('/dashboard');

    } catch (error) {
      console.error('Verify token error:', error);
      res.redirect('/?error=auth_failed');
    }
  });

  // Get current user
  app.get('/api/user', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      credits: user.credits,
      isAdmin: user.isAdmin,
    });
  });

  // Logout
  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // Get dashboard (user's patents)
  app.get('/api/dashboard', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      const patents = await storage.getPatentsByUser(req.session.userId);
      
      const patentsWithArtifactCount = await Promise.all(
        patents.map(async (patent) => {
          const artifacts = await storage.getArtifactsByPatent(patent.id);
          return {
            id: patent.id,
            title: patent.title,
            assignee: patent.assignee,
            filingDate: patent.filingDate,
            status: patent.status,
            createdAt: patent.createdAt,
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

  // Get patent detail
  app.get('/api/patent/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      const patentId = parseInt(req.params.id);
      const patent = await storage.getPatent(patentId);

      if (!patent || patent.userId !== req.session.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const artifacts = await storage.getArtifactsByPatent(patentId);

      res.json({
        patent: {
          id: patent.id,
          title: patent.title,
          inventors: patent.inventors,
          assignee: patent.assignee,
          filingDate: patent.filingDate,
          issueDate: patent.issueDate,
          status: patent.status,
        },
        artifacts: artifacts.map(a => ({
          type: a.artifactType,
          content: a.content,
        })),
      });

    } catch (error) {
      console.error('Patent detail error:', error);
      res.status(500).json({ error: 'Failed to load patent' });
    }
  });

  // Check patent status and trigger remaining artifact generation if needed
  app.post('/api/patent/:id/generate', async (req, res) => {
    try {
      const patentId = parseInt(req.params.id);
      const patent = await storage.getPatent(patentId);

      if (!patent) {
        return res.status(404).json({ error: 'Patent not found' });
      }

      // If already completed or failed, just return status
      if (patent.status === 'completed' || patent.status === 'failed') {
        return res.json({ status: patent.status });
      }

      // Check existing artifacts
      const artifacts = await storage.getArtifactsByPatent(patentId);
      const hasElia15 = artifacts.some(a => a.artifactType === 'elia15');
      const hasNarrative = artifacts.some(a => a.artifactType === 'business_narrative');
      const hasGoldenCircle = artifacts.some(a => a.artifactType === 'golden_circle');

      // If all artifacts exist, mark as completed
      if (hasElia15 && hasNarrative && hasGoldenCircle) {
        await storage.updatePatentStatus(patentId, 'completed');
        return res.json({ status: 'completed' });
      }

      // Generate missing artifacts
      const elia15 = artifacts.find(a => a.artifactType === 'elia15');
      
      if (!hasElia15) {
        return res.json({ status: 'processing', message: 'ELIA15 not yet generated' });
      }

      // Generate remaining artifacts synchronously
      try {
        if (!hasNarrative) {
          const narrativeResult = await generateBusinessNarrative(patent.fullText, elia15!.content);
          await storage.createArtifact({
            patentId,
            artifactType: 'business_narrative',
            content: narrativeResult.content,
            tokensUsed: narrativeResult.tokensUsed,
            generationTimeSeconds: narrativeResult.generationTimeSeconds,
          });
        }

        if (!hasGoldenCircle) {
          const narrative = artifacts.find(a => a.artifactType === 'business_narrative') ||
            (await storage.getArtifactsByPatent(patentId)).find(a => a.artifactType === 'business_narrative');
          
          const goldenCircleResult = await generateGoldenCircle(elia15!.content, narrative?.content || '');
          await storage.createArtifact({
            patentId,
            artifactType: 'golden_circle',
            content: goldenCircleResult.content,
            tokensUsed: goldenCircleResult.tokensUsed,
            generationTimeSeconds: goldenCircleResult.generationTimeSeconds,
          });
        }

        await storage.updatePatentStatus(patentId, 'completed');
        res.json({ status: 'completed' });

      } catch (error) {
        console.error('Error generating artifacts:', error);
        await storage.updatePatentStatus(patentId, 'failed', 'Failed to generate artifacts');
        res.json({ status: 'failed' });
      }

    } catch (error) {
      console.error('Generate error:', error);
      res.status(500).json({ error: 'Failed to generate artifacts' });
    }
  });

  return httpServer;
}

// Background function to generate remaining artifacts
async function generateRemainingArtifacts(
  patentId: number,
  fullText: string,
  elia15Content: string
): Promise<void> {
  try {
    // Generate Business Narrative
    const narrativeResult = await generateBusinessNarrative(fullText, elia15Content);
    await storage.createArtifact({
      patentId,
      artifactType: 'business_narrative',
      content: narrativeResult.content,
      tokensUsed: narrativeResult.tokensUsed,
      generationTimeSeconds: narrativeResult.generationTimeSeconds,
    });

    // Generate Golden Circle
    const goldenCircleResult = await generateGoldenCircle(elia15Content, narrativeResult.content);
    await storage.createArtifact({
      patentId,
      artifactType: 'golden_circle',
      content: goldenCircleResult.content,
      tokensUsed: goldenCircleResult.tokensUsed,
      generationTimeSeconds: goldenCircleResult.generationTimeSeconds,
    });

    // Update patent status to completed
    await storage.updatePatentStatus(patentId, 'completed');
    
  } catch (error) {
    console.error('Error generating remaining artifacts:', error);
    await storage.updatePatentStatus(patentId, 'failed', 'Failed to generate all artifacts');
  }
}
