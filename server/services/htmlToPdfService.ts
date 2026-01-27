/**
 * HTML-to-PDF Service using Puppeteer
 * Renders actual web pages to PDF for pixel-perfect output
 * 
 * Architecture:
 * - Uses headless Chrome/Chromium via Puppeteer
 * - Renders the actual PatentDetailPage component
 * - Captures exact CSS styling, fonts, and layout
 * - No manual PDF layout code needed - uses browser rendering
 */

import puppeteer, { type Browser, type Page } from 'puppeteer';

let browserInstance: Browser | null = null;

/**
 * Get or create a singleton browser instance
 * Reuses browser to avoid startup overhead
 */
/**
 * Find system Chrome/Chromium executable
 */
function findChrome(): string | undefined {
  const { execSync } = require('child_process');

  try {
    // Try common paths and commands
    const commands = [
      'which chromium',
      'which chromium-browser',
      'which google-chrome',
      'which google-chrome-stable',
    ];

    for (const cmd of commands) {
      try {
        const path = execSync(cmd, { encoding: 'utf8' }).trim();
        if (path) {
          console.log(`[Puppeteer] Found Chrome at: ${path}`);
          return path;
        }
      } catch {
        // Command failed, try next
      }
    }
  } catch (error) {
    console.warn('[Puppeteer] Could not auto-detect Chrome');
  }

  return undefined;
}

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  console.log('[Puppeteer] Launching browser...');

  // Auto-detect Chrome or use environment variable
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || findChrome();

  if (executablePath) {
    console.log(`[Puppeteer] Using Chrome at: ${executablePath}`);
  } else {
    console.warn('[Puppeteer] No Chrome found, using Puppeteer default (may fail)');
  }

  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    executablePath,
  });

  console.log('[Puppeteer] Browser launched successfully');

  return browserInstance;
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    console.log('[Puppeteer] Browser closed');
  }
}

interface RenderOptions {
  /**
   * Wait for specific selector before rendering
   */
  waitForSelector?: string;
  
  /**
   * Additional wait time in milliseconds after page load
   */
  additionalWaitMs?: number;
  
  /**
   * PDF format options
   */
  format?: 'Letter' | 'A4' | 'Legal';
  
  /**
   * Print background graphics
   */
  printBackground?: boolean;
  
  /**
   * Page margins
   */
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

/**
 * Render a URL to PDF using Puppeteer
 * @param url - The URL to render
 * @param options - Rendering options
 * @returns PDF buffer
 */
export async function renderUrlToPdf(
  url: string,
  options: RenderOptions = {}
): Promise<Buffer> {
  const {
    waitForSelector,
    additionalWaitMs = 2000,
    format = 'Letter',
    printBackground = true,
    margin = { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
  } = options;

  console.log(`[HTML-to-PDF] Starting render for: ${url}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Viewport optimized for Letter paper with 0.5" margins
    // 7.5" content width at 96 DPI = 720px, but we use higher for quality
    // 1000px viewport scales better to 7.5" while maintaining readability
    await page.setViewport({
      width: 1000,
      height: 1400,
      deviceScaleFactor: 2, // High DPI for crisp text
    });

    console.log('[HTML-to-PDF] Navigating to page...');

    // Navigate to the URL (increased timeout for image-heavy pages)
    await page.goto(url, {
      waitUntil: 'networkidle0', // Wait for network to be idle
      timeout: 60000, // 60 seconds for image-heavy pages
    });

    console.log('[HTML-to-PDF] Page loaded, waiting for content...');

    // Debug: Check what's on the page
    const pageContent = await page.content();
    const hasSelector = waitForSelector ? await page.$(waitForSelector) : null;
    console.log('[HTML-to-PDF] Page title:', await page.title());
    console.log('[HTML-to-PDF] Has selector?', !!hasSelector);

    if (!hasSelector && waitForSelector) {
      console.log('[HTML-to-PDF] Selector not found, page HTML length:', pageContent.length);
      console.log('[HTML-to-PDF] Page URL:', page.url());
      // Save screenshot for debugging
      try {
        await page.screenshot({ path: '/tmp/puppeteer-debug.png' });
        console.log('[HTML-to-PDF] Debug screenshot saved to /tmp/puppeteer-debug.png');
      } catch (e) {
        console.log('[HTML-to-PDF] Could not save screenshot');
      }
    }

    // Wait for specific selector if provided (longer timeout for React apps)
    if (waitForSelector) {
      try {
        await page.waitForSelector(waitForSelector, { timeout: 30000 });
      } catch (error) {
        console.error('[HTML-to-PDF] Timeout waiting for selector, generating PDF anyway');
        // Continue anyway - maybe the content is there but selector is wrong
      }
    }

    // Wait for all images to load
    console.log('[HTML-to-PDF] Waiting for images to load...');
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise((resolve) => {
            img.onload = img.onerror = resolve;
            // Timeout after 10s per image
            setTimeout(resolve, 10000);
          }))
      );
    });

    const imageCount = await page.evaluate(() => document.images.length);
    console.log(`[HTML-to-PDF] All images loaded (${imageCount} total)`);

    // Additional wait for dynamic content (images, lazy loading, etc.)
    if (additionalWaitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, additionalWaitMs));
    }

    console.log('[HTML-to-PDF] Generating PDF...');

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format,
      printBackground,
      margin,
      preferCSSPageSize: false,
    });

    console.log('[HTML-to-PDF] PDF generated successfully');

    // Convert Uint8Array to Buffer for compatibility
    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('[HTML-to-PDF] Error rendering PDF:', error);
    throw error;
  } finally {
    await page.close();
  }
}

/**
 * Render patent detail page to PDF
 * @param patentId - Patent ID
 * @param baseUrl - Base URL of the application (e.g., http://localhost:5000)
 * @param printToken - Optional print token for authentication-free access
 * @returns PDF buffer
 */
export async function renderPatentToPdf(
  patentId: string,
  baseUrl: string,
  printToken?: string
): Promise<Buffer> {
  const token = printToken || generatePrintToken(patentId);
  const url = `${baseUrl}/patent/${patentId}?print=true&token=${token}`;

  return renderUrlToPdf(url, {
    waitForSelector: '[data-patent-content]', // Wait for main content
    additionalWaitMs: 5000, // Extra time for images and React to render
    format: 'Letter',
    printBackground: true,
    // Reduced margins for wider content area (7.5" instead of 7.0")
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
  });
}

/**
 * Render single artifact to PDF
 * @param artifactId - Artifact ID
 * @param baseUrl - Base URL of the application
 * @returns PDF buffer
 */
export async function renderArtifactToPdf(
  artifactId: string,
  baseUrl: string
): Promise<Buffer> {
  // This would require a dedicated artifact view page
  // For now, we'll use the patent page with artifact selection
  const url = `${baseUrl}/artifact/${artifactId}?print=true`;
  
  return renderUrlToPdf(url, {
    waitForSelector: '[data-artifact-content]',
    additionalWaitMs: 2000,
    format: 'Letter',
    printBackground: true,
  });
}

/**
 * Generate a temporary print token for authentication-free printing
 * Token expires after 5 minutes
 */
export function generatePrintToken(patentId: string): string {
  const crypto = require('crypto');
  const secret = process.env.JWT_SECRET || 'default-secret';
  const timestamp = Date.now();
  const payload = `${patentId}:${timestamp}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**
 * Verify and decode a print token
 * Returns patentId if valid, null if invalid or expired
 */
export function verifyPrintToken(token: string): string | null {
  try {
    const crypto = require('crypto');
    const secret = process.env.JWT_SECRET || 'default-secret';
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [patentId, timestamp, signature] = decoded.split(':');
    
    // Check expiration (5 minutes)
    const now = Date.now();
    const tokenAge = now - parseInt(timestamp, 10);
    if (tokenAge > 5 * 60 * 1000) {
      console.log('[Print Token] Token expired');
      return null;
    }
    
    // Verify signature
    const expected = crypto.createHmac('sha256', secret).update(`${patentId}:${timestamp}`).digest('hex');
    if (signature !== expected) {
      console.log('[Print Token] Invalid signature');
      return null;
    }
    
    return patentId;
  } catch (error) {
    console.error('[Print Token] Verification error:', error);
    return null;
  }
}
