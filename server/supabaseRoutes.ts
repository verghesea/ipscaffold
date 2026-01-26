import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { supabaseStorage, type Patent } from "./supabaseStorage";
import { supabaseAdmin, supabase, supabaseUrl, supabaseAnonKey } from "./lib/supabase";
import multer from "multer";
import { nanoid } from "nanoid";
import fs from "fs/promises";
import rateLimit from "express-rate-limit";
import { parsePatentPDF } from "./services/pdfParser";
import { generateELIA15, generateBusinessNarrative, generateGoldenCircle } from "./services/aiGenerator";
import { getProgress, getProgressFromDb, updateProgress } from "./services/progressService";
import { logMetadataCorrection, findValueContext, getPendingCorrections } from "./services/extractionLogger";
import { generateArtifactPDF, generatePatentPackagePDF } from "./services/pdfService";
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

// Rate limiter for upload endpoint to prevent abuse and control API costs
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 uploads per 15 minutes
  message: {
    error: 'Too many uploads. Please try again in 15 minutes.',
    details: 'Upload rate limit exceeded. This helps us maintain service quality and manage costs.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    console.log('[RateLimit] Upload rate limit exceeded for IP:', req.ip);
    res.status(429).json({
      error: 'Too many uploads',
      details: 'You have exceeded the upload limit. Please try again in 15 minutes.',
      retryAfter: 15 * 60 // seconds
    });
  }
});

// Rate limiter for magic link endpoint to prevent email spam abuse (HIGH-1 FIX)
const magicLinkLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests per minute per IP
  message: {
    error: 'Too many login attempts',
    details: 'Please wait a moment before requesting another magic link.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log('[RateLimit] Magic link rate limit exceeded for IP:', req.ip);
    res.status(429).json({
      error: 'Too many requests',
      details: 'Please wait a minute before requesting another magic link.',
      retryAfter: 60, // seconds
    });
  },
});

// Per-email rate limiting to prevent email bombing (independent of IP)
const emailLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkEmailLimit(email: string): boolean {
  const now = Date.now();
  const limit = emailLimitMap.get(email);

  // Reset if window expired (5 minute window)
  if (!limit || now > limit.resetTime) {
    emailLimitMap.set(email, { count: 1, resetTime: now + 5 * 60 * 1000 });
    return true;
  }

  // Check if under limit (5 per 5 minutes per email)
  if (limit.count < 5) {
    limit.count++;
    return true;
  }

  return false;
}

// Clean up old entries periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [email, limit] of emailLimitMap.entries()) {
    if (now > limit.resetTime) {
      emailLimitMap.delete(email);
    }
  }
}, 10 * 60 * 1000);

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

  app.post('/api/upload', uploadLimiter, upload.single('pdf'), async (req, res) => {
    console.log('[Upload] ========== NEW UPLOAD REQUEST ==========');
    console.log('[Upload] Timestamp:', new Date().toISOString());

    try {
      if (!req.file) {
        console.error('[Upload] ERROR: No file in request');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log('[Upload] File received:');
      console.log('[Upload]   - Original name:', req.file.originalname);
      console.log('[Upload]   - Size:', req.file.size, 'bytes');
      console.log('[Upload]   - Type:', req.file.mimetype);
      console.log('[Upload]   - Path:', req.file.path);

      // SECURITY: Validate PDF magic bytes (not just MIME type)
      try {
        const fileBuffer = await fs.readFile(req.file.path);
        const magicBytes = fileBuffer.slice(0, 4);
        const isPDF = magicBytes[0] === 0x25 && // %
                      magicBytes[1] === 0x50 && // P
                      magicBytes[2] === 0x44 && // D
                      magicBytes[3] === 0x46;   // F

        if (!isPDF) {
          console.log('[Upload] REJECTED: File does not have valid PDF magic bytes');
          await fs.unlink(req.file.path).catch(() => {});
          return res.status(400).json({
            error: 'Invalid file format',
            details: 'The file you uploaded is not a valid PDF document. Please upload a PDF file.'
          });
        }
        console.log('[Upload] ✓ PDF magic bytes validated');
      } catch (magicError) {
        console.error('[Upload] ERROR: Failed to validate PDF magic bytes:', magicError);
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(500).json({
          error: 'File validation failed',
          details: 'Unable to validate the uploaded file. Please try again.'
        });
      }

      // CRITICAL: Check if Authorization header was provided but user resolution failed
      const authHeader = req.headers.authorization;
      const user = await getUserFromToken(req);

      if (authHeader && !user) {
        // User tried to authenticate but failed - this is the root cause of orphaned patents!
        console.error('[Upload] CRITICAL WARNING: Authorization header present but user resolution FAILED!');
        console.error('[Upload] Auth header starts with Bearer:', authHeader.startsWith('Bearer '));
        console.error('[Upload] This would create an ORPHANED PATENT - rejecting request');
        return res.status(401).json({
          error: 'Authentication failed',
          details: 'Your session may have expired. Please refresh the page and try again.'
        });
      }

      console.log('[Upload] User authentication:', user ? `Authenticated (${user.id})` : 'Anonymous (no auth header)');

      // BLOCKER-2 FIX: Check credits BEFORE processing to prevent wasted API costs
      if (user) {
        console.log('[Upload] Checking user credits before processing...');
        const profile = await supabaseStorage.getProfile(user.id);

        if (!profile) {
          console.error('[Upload] ERROR: User profile not found');
          // Clean up uploaded file
          await fs.unlink(req.file.path).catch(() => {});
          return res.status(500).json({
            error: 'Profile not found',
            details: 'Unable to verify your account. Please try logging in again.'
          });
        }

        console.log('[Upload] User has', profile.credits, 'credits');

        if (profile.credits < 10) {
          console.log('[Upload] REJECTED: Insufficient credits (need 10, has', profile.credits + ')');
          // Clean up uploaded file
          await fs.unlink(req.file.path).catch(() => {});
          return res.status(402).json({
            error: 'Insufficient credits',
            details: 'You need at least 10 credits to upload a patent. Visit the dashboard to add credits.',
            currentCredits: profile.credits,
            required: 10
          });
        }

        console.log('[Upload] ✓ Credit check passed');
      } else {
        console.log('[Upload] Skipping credit check for anonymous upload');
      }

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

      // VERIFICATION: Ensure user_id was stored correctly
      if (user && patent.user_id !== user.id) {
        console.error('[Upload] CRITICAL: Patent created but user_id mismatch!');
        console.error('[Upload] Expected user_id:', user.id);
        console.error('[Upload] Got user_id:', patent.user_id);

        // Attempt to fix immediately
        await supabaseAdmin
          .from('patents')
          .update({ user_id: user.id })
          .eq('id', patent.id);

        console.log('[Upload] Attempted to fix user_id immediately');
      }

      console.log('[Upload] Patent created successfully:');
      console.log('[Upload]   - Patent ID:', patent.id);
      console.log('[Upload]   - User ID:', patent.user_id || 'NULL (anonymous)');
      console.log('[Upload]   - Title:', patent.title?.substring(0, 50) || 'None');

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

        // Deduct credits for authenticated users
        if (user?.id) {
          // Re-fetch profile to ensure we have current credit balance
          const currentProfile = await supabaseStorage.getProfile(user.id);
          if (currentProfile) {
            const newBalance = currentProfile.credits - 10;
            await supabaseStorage.updateProfileCredits(user.id, newBalance);
            await supabaseStorage.createCreditTransaction({
              user_id: user.id,
              amount: -10,
              balance_after: newBalance,
              transaction_type: 'ip_processing',
              description: `Patent analysis: ${parsedPatent.title || 'Untitled'}`,
              patent_id: patent.id,
            });
            console.log('[Upload] ✓ Credits deducted: 10 credits (new balance:', newBalance, ')');
          } else {
            console.error('[Upload] ERROR: Could not fetch profile for credit deduction');
          }
        }

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
        console.error('[Upload] ERROR: Failed to generate ELIA15');
        console.error('[Upload] Error details:', error);
        console.error('[Upload] Stack trace:', (error as Error).stack);
        await supabaseStorage.updatePatentStatus(patent.id, 'failed', 'Failed to generate ELIA15');
        res.status(500).json({ error: 'Failed to generate analysis' });
      }

    } catch (error) {
      console.error('[Upload] ERROR: Upload failed');
      console.error('[Upload] Error details:', error);
      console.error('[Upload] Error message:', (error as Error).message);
      console.error('[Upload] Stack trace:', (error as Error).stack);
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

  app.post('/api/auth/magic-link', magicLinkLimiter, async (req, res) => {
    try {
      const { email, patentId } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check per-email rate limit (prevents email bombing to a single address)
      if (!checkEmailLimit(normalizedEmail)) {
        console.log('[RateLimit] Per-email limit exceeded for:', normalizedEmail);
        return res.status(429).json({
          error: 'Too many requests for this email',
          details: 'Multiple magic links have been sent to this email. Please check your inbox (including spam) or wait 5 minutes.',
        });
      }

      const appUrl = process.env.APP_URL || 'https://ipscaffold.replit.app';

      // Check if user already exists to prevent duplicate account creation
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = users?.find(u => u.email?.toLowerCase() === normalizedEmail);

      console.log('[MagicLink] Existing user found:', !!existingUser, 'for email:', normalizedEmail);

      // SIGNUP CAP CHECK: Only for new users
      if (!existingUser) {
        const signupAvailable = await supabaseStorage.checkSignupAvailable();
        if (!signupAvailable) {
          console.log('[MagicLink] Signup cap reached, adding to waitlist:', normalizedEmail);

          // Add to waitlist
          try {
            await supabaseStorage.addToWaitlist(
              normalizedEmail,
              'magic_link_request',
              req.headers.referer,
              {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                patentId,
              }
            );

            return res.status(503).json({
              error: 'Alpha is currently full',
              code: 'SIGNUP_CAP_REACHED',
              details: 'We\'ve added you to the waitlist. You\'ll be notified when a spot opens up.',
            });
          } catch (waitlistError: any) {
            if (waitlistError.message === 'Email already on waitlist') {
              return res.status(503).json({
                error: 'Alpha is currently full',
                code: 'SIGNUP_CAP_REACHED',
                details: 'You\'re already on the waitlist. We\'ll notify you when a spot opens up.',
              });
            }
            throw waitlistError;
          }
        }
      }

      const { data, error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${appUrl}/auth/callback${patentId ? `?patent=${patentId}` : ''}`,
          shouldCreateUser: !existingUser,  // Only create if doesn't exist
        }
      });

      if (error) {
        console.error('Magic link error:', error);
        return res.status(500).json({ error: 'Failed to send magic link', details: error.message });
      }

      console.log('Magic link sent to:', normalizedEmail);

      res.json({ success: true, message: 'Magic link sent to your email', patentId });

    } catch (error: any) {
      console.error('Magic link error:', error);
      res.status(500).json({ error: 'Failed to send magic link', details: error?.message });
    }
  });

  // Public waitlist endpoint (no auth required)
  app.post('/api/waitlist/join', async (req, res) => {
    try {
      const { email, source, referrer } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }

      await supabaseStorage.addToWaitlist(
        normalizedEmail,
        source || 'direct_form',
        referrer,
        {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        }
      );

      console.log(`[Waitlist] Added ${normalizedEmail} to waitlist from ${source || 'direct_form'}`);

      res.json({ success: true, message: 'Added to waitlist' });
    } catch (error: any) {
      if (error.message === 'Email already on waitlist') {
        return res.status(409).json({ error: 'Email already on waitlist' });
      }
      console.error('Waitlist join error:', error);
      res.status(500).json({ error: 'Failed to join waitlist' });
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

      // Check if this is a newly created user (within last 30 seconds)
      // The trigger creates the profile immediately, so we need to check if user just signed up
      // Use both profile creation time AND auth user creation time as backup for reliability
      const profileAge = profile ? Date.now() - new Date(profile.created_at).getTime() : Infinity;
      const authUserAge = Date.now() - new Date(user.created_at).getTime();
      const isNewUser = profile && (profileAge < 30000 || authUserAge < 30000);

      // Detailed logging for debugging and monitoring
      console.log('[OAuth] User age check:', {
        email: user.email,
        profileCreatedAt: profile?.created_at,
        authUserCreatedAt: user.created_at,
        profileAgeMs: profileAge === Infinity ? 'N/A' : profileAge,
        authUserAgeMs: authUserAge,
        threshold: 30000,
        isNewUser,
        triggeredBy: profileAge < 30000 ? 'profile' : authUserAge < 30000 ? 'auth_user' : 'none'
      });

      if (isNewUser) {
        console.log('[OAuth] Detected new user signup:', user.email);

        // Check signup cap for new OAuth users
        const signupAvailable = await supabaseStorage.checkSignupAvailable();

        if (!signupAvailable) {
          console.log('[OAuth] Signup cap reached for user:', user.email);

          // Delete the profile created by trigger
          try {
            await supabaseAdmin.from('profiles').delete().eq('id', user.id);
            console.log('[OAuth] Deleted profile due to signup cap:', user.id);
          } catch (deleteError) {
            console.error('[OAuth] Failed to delete profile:', deleteError);
          }

          // Delete the OAuth user
          try {
            await supabaseAdmin.auth.admin.deleteUser(user.id);
            console.log('[OAuth] Deleted auth user due to signup cap:', user.id);
          } catch (deleteError) {
            console.error('[OAuth] Failed to delete user:', deleteError);
          }

          // Add to waitlist
          try {
            await supabaseStorage.addToWaitlist(
              user.email || '',
              'oauth_signup',
              'oauth_callback',
              {
                provider: 'google',
                timestamp: new Date().toISOString(),
              }
            );
          } catch (waitlistError: any) {
            if (waitlistError.message !== 'Email already on waitlist') {
              console.error('[OAuth] Failed to add to waitlist:', waitlistError);
            }
          }

          return res.status(503).json({
            error: 'Alpha is currently full',
            code: 'SIGNUP_CAP_REACHED',
            email: user.email,
            details: 'You\'ve been added to the waitlist. We\'ll notify you when a spot opens up.',
          });
        }
      }

      // If no profile exists (shouldn't happen with trigger, but handle it)
      if (!profile) {
        console.log('Creating new profile for user:', user.id);
        try {
          await supabaseStorage.createProfile({
            id: user.id,
            email: user.email || '',
            credits: 30, // 3 uploads max (10 credits each)
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
      displayName: profile.display_name,
      organization: profile.organization,
      profileCompleted: !!profile.profile_completed_at,
    });
  });

  // Complete user profile (name + organization)
  app.post('/api/user/complete-profile', requireAuth, async (req, res) => {
    try {
      const { displayName, organization } = req.body;

      if (!displayName || !organization) {
        return res.status(400).json({
          error: 'Both name and organization are required',
        });
      }

      if (displayName.trim().length < 2) {
        return res.status(400).json({
          error: 'Name must be at least 2 characters',
        });
      }

      if (organization.trim().length < 2) {
        return res.status(400).json({
          error: 'Organization must be at least 2 characters',
        });
      }

      await supabaseStorage.updateProfilePersonalization(
        req.user!.id,
        displayName.trim(),
        organization.trim()
      );

      console.log('[Profile] User completed profile:', req.user!.id, displayName, organization);

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Profile] Error completing profile:', error);
      res.status(500).json({ error: 'Failed to update profile', details: error?.message });
    }
  });

  // Skip profile completion (will re-prompt after 7 days)
  app.post('/api/user/skip-profile', requireAuth, async (req, res) => {
    try {
      await supabaseStorage.skipProfileCompletion(req.user!.id);
      console.log('[Profile] User skipped profile completion:', req.user!.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Profile] Error skipping profile:', error);
      res.status(500).json({ error: 'Failed to skip profile', details: error?.message });
    }
  });

  // DIAGNOSTIC ENDPOINT - Comprehensive database diagnosis
  app.get('/api/debug/patents', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      console.log('[DEBUG] ========== COMPREHENSIVE DIAGNOSIS ==========');
      console.log('[DEBUG] User ID:', userId);

      // 1. Direct database query to see ALL patents
      const { data: allPatents, error: allError } = await supabaseAdmin
        .from('patents')
        .select('id, user_id, title, friendly_title, status, created_at')
        .order('created_at', { ascending: false });

      // 2. Query for user's patents specifically
      const { data: userPatents, error: userError } = await supabaseAdmin
        .from('patents')
        .select('id, user_id, title, friendly_title, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // 3. Query for orphaned patents (user_id IS NULL)
      const { data: orphanedPatents, error: orphanError } = await supabaseAdmin
        .from('patents')
        .select('id, user_id, title, friendly_title, status, created_at')
        .is('user_id', null)
        .order('created_at', { ascending: false });

      // 4. Get user's notifications
      const { data: notifications, error: notifError } = await supabaseAdmin
        .from('webhook_notifications')
        .select('id, notification_type, payload, created_at, read')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      // 5. Extract patent IDs from notifications
      const notificationPatentIds = new Set<string>();
      notifications?.forEach((n: any) => {
        if (n.payload?.patent_id) {
          notificationPatentIds.add(n.payload.patent_id);
        }
      });

      // 6. Check which notification patents exist and their status
      const patentStatus: Record<string, any> = {};
      for (const patentId of notificationPatentIds) {
        const { data: patent } = await supabaseAdmin
          .from('patents')
          .select('id, user_id, title, status')
          .eq('id', patentId)
          .single();

        patentStatus[patentId] = patent ? {
          exists: true,
          user_id: patent.user_id,
          isOrphaned: patent.user_id === null,
          belongsToUser: patent.user_id === userId,
          title: patent.title?.substring(0, 50),
          status: patent.status
        } : { exists: false };
      }

      console.log('[DEBUG] Summary:');
      console.log('[DEBUG] - Total patents in DB:', allPatents?.length || 0);
      console.log('[DEBUG] - User patents:', userPatents?.length || 0);
      console.log('[DEBUG] - Orphaned patents:', orphanedPatents?.length || 0);
      console.log('[DEBUG] - User notifications:', notifications?.length || 0);
      console.log('[DEBUG] - Unique patents in notifications:', notificationPatentIds.size);

      res.json({
        userId,
        summary: {
          totalPatentsInDB: allPatents?.length || 0,
          userPatentsCount: userPatents?.length || 0,
          orphanedPatentsCount: orphanedPatents?.length || 0,
          userNotificationsCount: notifications?.length || 0,
          uniquePatentIdsInNotifications: notificationPatentIds.size,
        },
        userPatents: userPatents || [],
        orphanedPatents: orphanedPatents || [],
        notificationPatentStatus: patentStatus,
        recentNotifications: notifications?.slice(0, 10).map((n: any) => ({
          type: n.notification_type,
          patent_id: n.payload?.patent_id || 'NONE',
          patent_title: n.payload?.patent_title || 'Unknown',
          created_at: n.created_at,
          read: n.read,
        })) || [],
        errors: {
          allError: allError?.message,
          userError: userError?.message,
          orphanError: orphanError?.message,
          notifError: notifError?.message,
        }
      });
    } catch (error) {
      console.error('[DEBUG] Error:', error);
      res.status(500).json({ error: 'Debug query failed', details: (error as Error).message });
    }
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

    console.log('[Dashboard] ========== DASHBOARD REQUEST ==========');
    console.log('[Dashboard] Request from user:', req.user?.id);
    console.log('[Dashboard] Timestamp:', new Date().toISOString());

    try {
      console.log('[Dashboard] Fetching patents...');
      const patents = await Promise.race([
        supabaseStorage.getPatentsByUser(req.user!.id),
        new Promise((_, reject) => setTimeout(() => reject(new Error('getPatentsByUser timeout')), 10000))
      ]) as Patent[];

      console.log('[Dashboard] Found', patents.length, 'patents for user');

      if (patents.length === 0) {
        console.log('[Dashboard] No patents found, returning empty array');
        return res.json({ patents: [] });
      }

      console.log('[Dashboard] Fetching artifact counts for', patents.length, 'patents...');
      const patentsWithArtifactCount = await Promise.race([
        Promise.all(
          patents.map(async (patent, index) => {
            console.log(`[Dashboard] Processing patent ${index + 1}/${patents.length}: ${patent.id}`);
            try {
              const artifacts = await supabaseStorage.getArtifactsByPatent(patent.id);
              console.log(`[Dashboard] Patent ${patent.id} has ${artifacts.length} artifacts`);
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
            } catch (artifactError) {
              console.error(`[Dashboard] Error fetching artifacts for patent ${patent.id}:`, artifactError);
              // Return patent without artifact count if artifacts fail
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
                artifactCount: 0,
              };
            }
          })
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Artifact fetching timeout')), 30000))
      ]) as any[];

      console.log('[Dashboard] Successfully processed all patents');
      console.log('[Dashboard] Responding with', patentsWithArtifactCount.length, 'patents');
      res.json({ patents: patentsWithArtifactCount });

    } catch (error) {
      console.error('[Dashboard] ERROR:', error);
      console.error('[Dashboard] Error message:', (error as Error).message);
      console.error('[Dashboard] Stack trace:', (error as Error).stack);
      res.status(500).json({ error: 'Failed to load dashboard', details: (error as Error).message });
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

  // PDF Export: Download single artifact as PDF
  app.get('/api/artifact/:id/pdf', requireAuth, async (req, res) => {
    try {
      const artifactId = req.params.id;

      // Fetch artifact to verify ownership
      const artifact = await supabaseStorage.getArtifact(artifactId);
      if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      // Verify patent ownership
      const patent = await supabaseStorage.getPatent(artifact.patent_id);
      if (!patent || patent.user_id !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Generate PDF
      const pdfResult = await generateArtifactPDF(artifactId, {
        includeImages: true,
        watermarkImages: true,
      });

      // Send PDF as download
      res.setHeader('Content-Type', pdfResult.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);
      res.setHeader('Content-Length', pdfResult.buffer.length);
      res.send(pdfResult.buffer);

    } catch (error) {
      console.error('Artifact PDF generation error:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  });

  // PDF Export: Download complete patent package as PDF
  app.get('/api/patent/:id/pdf', requireAuth, async (req, res) => {
    try {
      const patentId = req.params.id;

      // Verify ownership
      const patent = await supabaseStorage.getPatent(patentId);
      if (!patent || patent.user_id !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Generate combined PDF
      const pdfResult = await generatePatentPackagePDF(patentId);

      // Send PDF as download
      res.setHeader('Content-Type', pdfResult.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);
      res.setHeader('Content-Length', pdfResult.buffer.length);
      res.send(pdfResult.buffer);

    } catch (error) {
      console.error('Patent package PDF generation error:', error);
      res.status(500).json({ error: 'Failed to generate PDF package' });
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

  // Fix orphaned patents - finds patents referenced in user's notifications but missing user_id
  app.post('/api/fix-orphaned-patents', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      console.log('[FixOrphaned] ========== STARTING FIX ==========');
      console.log('[FixOrphaned] User ID:', userId);

      // STEP 1: Get all notifications for this user
      const { data: notifications, error: notifError } = await supabaseAdmin
        .from('webhook_notifications')
        .select('id, notification_type, payload, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (notifError) {
        console.error('[FixOrphaned] Error fetching notifications:', notifError);
        return res.status(500).json({ error: 'Failed to fetch notifications' });
      }

      console.log('[FixOrphaned] Found', notifications?.length || 0, 'total notifications');

      // Debug: log all notification payloads
      notifications?.slice(0, 5).forEach((n: any, i: number) => {
        console.log(`[FixOrphaned] Notification ${i + 1}: type=${n.notification_type}, patent_id=${n.payload?.patent_id || 'NONE'}`);
      });

      // Extract unique patent IDs from notifications
      const patentIds = new Set<string>();
      notifications?.forEach((n: any) => {
        if (n.payload?.patent_id) {
          patentIds.add(n.payload.patent_id);
        }
      });

      console.log('[FixOrphaned] Found', patentIds.size, 'unique patent IDs in notifications');

      // STEP 2: Check all patents in the database
      const { data: allOrphanedPatents, error: orphanError } = await supabaseAdmin
        .from('patents')
        .select('id, user_id, title, status, created_at')
        .is('user_id', null)
        .order('created_at', { ascending: false });

      console.log('[FixOrphaned] Total orphaned patents in DB:', allOrphanedPatents?.length || 0);

      // Debug: Log first few orphaned patents
      allOrphanedPatents?.slice(0, 5).forEach((p: any, i: number) => {
        console.log(`[FixOrphaned] Orphaned patent ${i + 1}: id=${p.id}, title=${p.title?.substring(0, 50) || 'null'}`);
      });

      // STEP 3: Find patents that match notification patent_ids and need fixing
      let fixedCount = 0;
      const fixedPatents: string[] = [];
      const notFoundPatents: string[] = [];
      const alreadyLinkedPatents: string[] = [];

      for (const patentId of patentIds) {
        const { data: patent, error: patentError } = await supabaseAdmin
          .from('patents')
          .select('id, user_id, title')
          .eq('id', patentId)
          .single();

        if (patentError || !patent) {
          console.log('[FixOrphaned] Patent not found:', patentId);
          notFoundPatents.push(patentId);
          continue;
        }

        // If patent has no user_id, update it
        if (!patent.user_id) {
          console.log('[FixOrphaned] Fixing orphaned patent:', patentId, '- Title:', patent.title);

          const { error: updateError } = await supabaseAdmin
            .from('patents')
            .update({ user_id: userId })
            .eq('id', patentId);

          if (updateError) {
            console.error('[FixOrphaned] Failed to update patent:', patentId, updateError);
          } else {
            fixedCount++;
            fixedPatents.push(patentId);
            console.log('[FixOrphaned] Successfully fixed patent:', patentId);
          }
        } else if (patent.user_id === userId) {
          alreadyLinkedPatents.push(patentId);
        } else {
          console.log('[FixOrphaned] Patent belongs to different user:', patentId, 'owner:', patent.user_id);
        }
      }

      // STEP 4: Also check if there are orphaned patents created around the same time as notifications
      // This catches cases where notification was created but patent_id might not be in payload
      const recentNotifications = notifications?.filter((n: any) => {
        const created = new Date(n.created_at);
        const hourAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
        return created > hourAgo;
      }) || [];

      if (recentNotifications.length > 0 && allOrphanedPatents && allOrphanedPatents.length > 0) {
        console.log('[FixOrphaned] Checking recent orphaned patents for time-based matching...');

        for (const patent of allOrphanedPatents) {
          // Skip if already fixed
          if (fixedPatents.includes(patent.id)) continue;

          // Check if patent was created around the same time as a notification
          const patentCreated = new Date(patent.created_at);
          const matchingNotification = recentNotifications.find((n: any) => {
            const notifCreated = new Date(n.created_at);
            const timeDiff = Math.abs(patentCreated.getTime() - notifCreated.getTime());
            return timeDiff < 60 * 60 * 1000; // Within 1 hour
          });

          if (matchingNotification) {
            console.log('[FixOrphaned] Found time-matched orphan:', patent.id, '- Title:', patent.title);

            const { error: updateError } = await supabaseAdmin
              .from('patents')
              .update({ user_id: userId })
              .eq('id', patent.id);

            if (!updateError) {
              fixedCount++;
              fixedPatents.push(patent.id);
              console.log('[FixOrphaned] Fixed time-matched patent:', patent.id);
            }
          }
        }
      }

      console.log('[FixOrphaned] ========== COMPLETED ==========');
      console.log('[FixOrphaned] Fixed:', fixedCount);
      console.log('[FixOrphaned] Already linked:', alreadyLinkedPatents.length);
      console.log('[FixOrphaned] Not found:', notFoundPatents.length);

      res.json({
        success: true,
        totalNotificationPatents: patentIds.size,
        totalOrphanedInDb: allOrphanedPatents?.length || 0,
        fixedCount,
        fixedPatents,
        alreadyLinkedCount: alreadyLinkedPatents.length,
        notFoundCount: notFoundPatents.length,
        message: fixedCount > 0
          ? `Fixed ${fixedCount} orphaned patents. Your dashboard should now show them.`
          : allOrphanedPatents && allOrphanedPatents.length > 0
            ? `No patents matched your notifications, but ${allOrphanedPatents.length} orphaned patents exist in the database.`
            : 'No orphaned patents found. All your patents are properly linked.'
      });

    } catch (error) {
      console.error('[FixOrphaned] Error:', error);
      res.status(500).json({ error: 'Failed to fix orphaned patents' });
    }
  });

  // Detect duplicate auth accounts
  app.get('/api/debug/duplicate-accounts', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;

      // Get current user's email
      const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authError || !user?.email) {
        return res.status(500).json({ error: 'Could not get user email' });
      }

      // Find all auth users with this email
      const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
      if (usersError) {
        return res.status(500).json({ error: 'Could not list users' });
      }

      const duplicateAccounts = users.filter(
        u => u.email?.toLowerCase() === user.email.toLowerCase()
      );

      // Get patents for each account
      const accountDetails = await Promise.all(
        duplicateAccounts.map(async (account) => {
          const { data: patents } = await supabaseAdmin
            .from('patents')
            .select('id, title, created_at')
            .eq('user_id', account.id);

          return {
            userId: account.id,
            email: account.email,
            createdAt: account.created_at,
            patentCount: patents?.length || 0,
            isCurrentUser: account.id === userId,
          };
        })
      );

      res.json({
        email: user.email,
        currentUserId: userId,
        totalDuplicateAccounts: duplicateAccounts.length,
        accounts: accountDetails,
        hasDuplicates: duplicateAccounts.length > 1,
      });
    } catch (error) {
      console.error('[DuplicateAccounts] Error:', error);
      res.status(500).json({ error: 'Failed to check for duplicates' });
    }
  });

  // Direct query test - bypasses all logic to test raw database query
  app.get('/api/debug/direct-patent-query', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      console.log('[DirectQuery] Testing direct database query for user:', userId);

      // Test 1: Raw query with exact user_id
      const { data: directQuery, error: directError } = await supabaseAdmin
        .from('patents')
        .select('id, user_id, title, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      console.log('[DirectQuery] Direct query result:', directQuery?.length || 0, 'patents');

      // Test 2: Check if ANY patents exist in database
      const { data: allPatents, error: allError } = await supabaseAdmin
        .from('patents')
        .select('id, user_id, title')
        .order('created_at', { ascending: false })
        .limit(10);

      console.log('[DirectQuery] Total patents in DB (sample):', allPatents?.length || 0);

      // Test 3: Count patents with this exact user_id
      const { count, error: countError } = await supabaseAdmin
        .from('patents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      console.log('[DirectQuery] Count query result:', count);

      res.json({
        userId,
        directQueryResults: directQuery?.length || 0,
        directQueryError: directError ? {
          code: directError.code,
          message: directError.message,
          details: directError.details,
        } : null,
        samplePatents: allPatents?.map(p => ({
          id: p.id,
          user_id: p.user_id,
          title: p.title?.substring(0, 50),
          matches: p.user_id === userId,
        })) || [],
        totalPatientsInDb: allPatents?.length || 0,
        countWithUserId: count,
        countError: countError ? countError.message : null,
      });

    } catch (error: any) {
      console.error('[DirectQuery] Error:', error);
      res.status(500).json({ error: 'Direct query failed', details: error.message });
    }
  });

  // Clean up notifications for deleted patents
  app.post('/api/cleanup-notifications', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      console.log('[CleanupNotifications] Starting cleanup for user:', userId);

      // Get all notifications for this user
      const { data: notifications, error: notifError } = await supabaseAdmin
        .from('webhook_notifications')
        .select('id, payload')
        .eq('user_id', userId);

      if (notifError) {
        console.error('[CleanupNotifications] Error fetching notifications:', notifError);
        return res.status(500).json({ error: 'Failed to fetch notifications' });
      }

      console.log('[CleanupNotifications] Found', notifications?.length || 0, 'notifications');

      // Check which patents still exist
      const deletedNotificationIds: string[] = [];
      for (const notif of notifications || []) {
        const patentId = notif.payload?.patent_id;
        if (patentId) {
          // Check if patent exists
          const { data: patent } = await supabaseAdmin
            .from('patents')
            .select('id')
            .eq('id', patentId)
            .single();

          if (!patent) {
            // Patent doesn't exist, mark notification for deletion
            deletedNotificationIds.push(notif.id);
          }
        }
      }

      console.log('[CleanupNotifications] Found', deletedNotificationIds.length, 'orphaned notifications');

      // Delete orphaned notifications
      if (deletedNotificationIds.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('webhook_notifications')
          .delete()
          .in('id', deletedNotificationIds);

        if (deleteError) {
          console.error('[CleanupNotifications] Error deleting notifications:', deleteError);
          return res.status(500).json({ error: 'Failed to delete orphaned notifications' });
        }
      }

      console.log('[CleanupNotifications] Deleted', deletedNotificationIds.length, 'notifications');

      res.json({
        success: true,
        deletedCount: deletedNotificationIds.length,
        message: deletedNotificationIds.length > 0
          ? `Cleaned up ${deletedNotificationIds.length} notifications for deleted patents.`
          : 'No orphaned notifications found.'
      });

    } catch (error) {
      console.error('[CleanupNotifications] Error:', error);
      res.status(500).json({ error: 'Failed to cleanup notifications' });
    }
  });

  // Claim specific patents by ID - allows user to manually claim orphaned patents
  app.post('/api/claim-patents', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { patentIds } = req.body;

      if (!patentIds || !Array.isArray(patentIds) || patentIds.length === 0) {
        return res.status(400).json({ error: 'patentIds array is required' });
      }

      console.log('[ClaimPatents] User', userId, 'claiming patents:', patentIds);

      let claimedCount = 0;
      const claimedPatents: string[] = [];
      const errors: string[] = [];

      for (const patentId of patentIds) {
        const { data: patent, error: fetchError } = await supabaseAdmin
          .from('patents')
          .select('id, user_id, title')
          .eq('id', patentId)
          .single();

        if (fetchError || !patent) {
          errors.push(`Patent ${patentId} not found`);
          continue;
        }

        // Only allow claiming orphaned patents
        if (patent.user_id !== null) {
          if (patent.user_id === userId) {
            errors.push(`Patent ${patentId} already belongs to you`);
          } else {
            errors.push(`Patent ${patentId} belongs to another user`);
          }
          continue;
        }

        // Claim the patent
        const { error: updateError } = await supabaseAdmin
          .from('patents')
          .update({ user_id: userId })
          .eq('id', patentId);

        if (updateError) {
          errors.push(`Failed to claim patent ${patentId}: ${updateError.message}`);
        } else {
          claimedCount++;
          claimedPatents.push(patentId);
          console.log('[ClaimPatents] Successfully claimed:', patentId);
        }
      }

      res.json({
        success: true,
        claimedCount,
        claimedPatents,
        errors: errors.length > 0 ? errors : undefined,
        message: claimedCount > 0
          ? `Successfully claimed ${claimedCount} patents.`
          : 'No patents were claimed.'
      });

    } catch (error) {
      console.error('[ClaimPatents] Error:', error);
      res.status(500).json({ error: 'Failed to claim patents' });
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

  // ============================================================
  // SIGNUP CAP & WAITLIST MANAGEMENT (Super Admin Only)
  // ============================================================

  // Get signup statistics
  app.get('/api/admin/signup-stats', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const stats = await supabaseStorage.getSignupStats();
      res.json(stats);
    } catch (error) {
      console.error('Get signup stats error:', error);
      res.status(500).json({ error: 'Failed to get signup stats' });
    }
  });

  // Get all app settings
  app.get('/api/admin/settings', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const settings = await supabaseStorage.getAllAppSettings();
      res.json({ settings });
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  });

  // Update signup cap
  app.post('/api/admin/settings/signup-cap', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { value } = req.body;

      if (!value || isNaN(parseInt(value)) || parseInt(value) < 0) {
        return res.status(400).json({ error: 'Invalid signup cap value' });
      }

      await supabaseStorage.updateAppSetting('signup_cap', value, req.user!.id);

      console.log(`[Admin] Signup cap updated to ${value} by ${req.user!.id}`);
      res.json({ success: true, value });
    } catch (error) {
      console.error('Update signup cap error:', error);
      res.status(500).json({ error: 'Failed to update signup cap' });
    }
  });

  // Toggle signups enabled/disabled
  app.post('/api/admin/settings/signups-enabled', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Invalid enabled value' });
      }

      await supabaseStorage.updateAppSetting('signups_enabled', enabled.toString(), req.user!.id);

      console.log(`[Admin] Signups ${enabled ? 'enabled' : 'disabled'} by ${req.user!.id}`);
      res.json({ success: true, enabled });
    } catch (error) {
      console.error('Toggle signups error:', error);
      res.status(500).json({ error: 'Failed to toggle signups' });
    }
  });

  // Get waitlist
  app.get('/api/admin/waitlist', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const waitlist = await supabaseStorage.getWaitlist();
      res.json({ waitlist });
    } catch (error) {
      console.error('Get waitlist error:', error);
      res.status(500).json({ error: 'Failed to get waitlist' });
    }
  });

  // Approve waitlist entry (marks as approved for manual outreach)
  app.post('/api/admin/waitlist/:id/approve', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Get waitlist entry
      const waitlist = await supabaseStorage.getWaitlist();
      const entry = waitlist.find(w => w.id === id);

      if (!entry) {
        return res.status(404).json({ error: 'Waitlist entry not found' });
      }

      if (entry.approved) {
        return res.status(400).json({ error: 'Entry already approved' });
      }

      // Just mark as approved - no account creation
      // Admin will manually email them to sign up
      await supabaseStorage.approveWaitlistEntry(id, req.user!.id);

      console.log(`[Admin] Approved waitlist entry ${id} for email: ${entry.email}`);

      res.json({ success: true, email: entry.email });
    } catch (error: any) {
      console.error('Approve waitlist error:', error);
      res.status(500).json({ error: 'Failed to approve waitlist entry', details: error.message });
    }
  });

  // Delete waitlist entry
  app.delete('/api/admin/waitlist/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      await supabaseStorage.deleteWaitlistEntry(id);

      console.log(`[Admin] Deleted waitlist entry ${id}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete waitlist error:', error);
      res.status(500).json({ error: 'Failed to delete waitlist entry' });
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

      // Allow retry for failed, partial, or stuck processing patents
      const allowedStatuses = ['failed', 'partial', 'processing', 'elia15_complete'];
      if (!allowedStatuses.includes(patent.status)) {
        return res.status(400).json({ error: `Cannot retry patent with status: ${patent.status}` });
      }

      console.log(`[Retry] Retrying patent ${req.params.id} from status: ${patent.status}`);
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
