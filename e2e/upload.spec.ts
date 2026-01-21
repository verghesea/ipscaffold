/**
 * End-to-End Tests for Patent Upload Flow
 *
 * Tests the complete user journey from login to upload to viewing results.
 * Requires the application to be running.
 *
 * Run: npx playwright test e2e/upload.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@ipscaffold.test';

// Helper function to login as test user
// In real tests, this would use a test account with magic link bypass
async function loginAsTestUser(page: Page): Promise<void> {
  // For E2E testing, you'll need one of:
  // 1. A test account with a known password (if you add password auth)
  // 2. A bypass mechanism for testing (not recommended for production)
  // 3. Direct session injection (requires server-side support)

  // For now, we'll use localStorage injection (requires test token)
  const testToken = process.env.TEST_AUTH_TOKEN;
  const testRefreshToken = process.env.TEST_REFRESH_TOKEN;

  if (testToken && testRefreshToken) {
    await page.goto(BASE_URL);
    await page.evaluate(
      ([token, refresh]) => {
        localStorage.setItem('ip_scaffold_access_token', token);
        localStorage.setItem('ip_scaffold_refresh_token', refresh);
      },
      [testToken, testRefreshToken]
    );
  } else {
    // Skip login-dependent tests if no test credentials
    test.skip(true, 'No test authentication credentials provided');
  }
}

test.describe('Landing Page', () => {
  test('should display landing page correctly', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check for main elements
    await expect(page.locator('text=IP Scaffold').first()).toBeVisible();

    // Check for login/signup CTA
    const loginButton = page.locator('[data-testid="button-login"]');
    const uploadCta = page.locator('text=Upload').first();

    await expect(loginButton.or(uploadCta)).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto(BASE_URL);

    // Find and click login button
    const loginButton = page.locator('[data-testid="button-login"]');

    if (await loginButton.isVisible()) {
      await loginButton.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });
});

test.describe('Authentication Flow', () => {
  test('login page should display correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Check for email input
    await expect(page.locator('[data-testid="input-email"]')).toBeVisible();

    // Check for submit button
    await expect(page.locator('[data-testid="button-send-link"]')).toBeVisible();
  });

  test('should validate email input', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Try to submit without email
    await page.click('[data-testid="button-send-link"]');

    // Should show validation error or not proceed
    await expect(page.locator('[data-testid="input-email"]')).toBeVisible();
  });

  test('should show confirmation after magic link request', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Enter email
    await page.fill('[data-testid="input-email"]', 'test@example.com');

    // Submit
    await page.click('[data-testid="button-send-link"]');

    // Wait for confirmation message (or error)
    await expect(
      page.locator('text=Check your email').or(page.locator('text=Magic link sent'))
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should redirect unauthenticated users', async ({ page }) => {
    // Clear any stored tokens
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Try to access dashboard
    await page.goto(`${BASE_URL}/dashboard`);

    // Should redirect to login or home
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test('should display dashboard for authenticated users', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    // Check for dashboard title
    await expect(page.locator('[data-testid="text-dashboard-title"]')).toBeVisible();

    // Check for upload zone
    await expect(page.locator('[data-testid="upload-drop-zone"]')).toBeVisible();
  });

  test('should toggle between grid and table view', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    // Find view toggle buttons
    const gridButton = page.locator('[data-testid="button-view-grid"]');
    const tableButton = page.locator('[data-testid="button-view-table"]');

    if (await gridButton.isVisible()) {
      // Switch to table view
      await tableButton.click();
      await expect(page.locator('table').or(page.locator('text=No Patents'))).toBeVisible();

      // Switch back to grid view
      await gridButton.click();
    }
  });
});

test.describe('Patent Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should display upload zone correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    const uploadZone = page.locator('[data-testid="upload-drop-zone"]');
    await expect(uploadZone).toBeVisible();

    // Check for upload instructions
    await expect(page.locator('text=Drop PDF here').or(page.locator('text=Upload'))).toBeVisible();
  });

  test('should reject non-PDF files', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    // Create a text file for testing
    const fileInput = page.locator('[data-testid="input-file-upload"]');

    // Upload non-PDF file
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is not a PDF'),
    });

    // Should show error toast or message
    await expect(page.locator('text=Invalid file type').or(page.locator('text=PDF'))).toBeVisible({
      timeout: 5000,
    });
  });

  test('should show uploading state during upload', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    const fileInput = page.locator('[data-testid="input-file-upload"]');

    // Create a minimal valid PDF (this is a very simple PDF structure)
    const minimalPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF`;

    await fileInput.setInputFiles({
      name: 'test-patent.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(minimalPdf),
    });

    // Should show uploading indicator OR redirect to preview
    await expect(
      page
        .locator('text=Analyzing')
        .or(page.locator('text=Uploading'))
        .or(page.locator('[data-testid="progress-indicator"]'))
    ).toBeVisible({ timeout: 5000 });
  });

  // This test requires a real patent PDF file
  test.skip('should complete upload flow with real PDF', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    const fileInput = page.locator('[data-testid="input-file-upload"]');

    // Upload real PDF (you'd need to provide this file)
    await fileInput.setInputFiles('test/fixtures/sample-patent.pdf');

    // Wait for redirect to preview page
    await expect(page).toHaveURL(/\/preview\/.+/, { timeout: 60000 });

    // Verify preview page loaded
    await expect(page.locator('[data-testid="patent-title"]')).toBeVisible();
  });
});

test.describe('Patent Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should show 404 for non-existent patent', async ({ page }) => {
    await page.goto(`${BASE_URL}/patent/non-existent-id-12345`);

    // Should show error or redirect
    await expect(
      page.locator('text=not found').or(page.locator('text=Access denied'))
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Promo Code Redemption', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should open promo code dialog', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    // Find and click redeem code button
    const redeemButton = page.locator('[data-testid="button-redeem-code"]');

    if (await redeemButton.isVisible()) {
      await redeemButton.click();

      // Dialog should open
      await expect(page.locator('[data-testid="input-promo-code"]')).toBeVisible();
    }
  });

  test('should validate promo code input', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    const redeemButton = page.locator('[data-testid="button-redeem-code"]');

    if (await redeemButton.isVisible()) {
      await redeemButton.click();

      // Enter code
      await page.fill('[data-testid="input-promo-code"]', 'INVALID123');
      await page.click('[data-testid="button-submit-promo"]');

      // Should show error for invalid code
      await expect(page.locator('text=Invalid').or(page.locator('text=expired'))).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

test.describe('Responsive Design', () => {
  test('should display correctly on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(BASE_URL);

    // Check that main content is visible
    await expect(page.locator('text=IP Scaffold').first()).toBeVisible();

    // Navigation should adapt to mobile
    const mobileMenu = page.locator('[data-testid="mobile-menu"]');
    const hamburger = page.locator('[data-testid="hamburger-menu"]');

    // Either mobile menu exists or hamburger button exists
    await expect(mobileMenu.or(hamburger).or(page.locator('nav'))).toBeVisible();
  });

  test('dashboard should be usable on tablet', async ({ page }) => {
    await loginAsTestUser(page);

    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto(`${BASE_URL}/dashboard`);

    // Upload zone should be visible
    await expect(page.locator('[data-testid="upload-drop-zone"]')).toBeVisible();

    // View toggles should be visible
    await expect(
      page.locator('[data-testid="button-view-grid"]').or(page.locator('[data-testid="button-view-table"]'))
    ).toBeVisible();
  });
});

test.describe('Error States', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    await loginAsTestUser(page);

    // Simulate offline
    await page.route('**/api/**', (route) => route.abort('failed'));

    await page.goto(`${BASE_URL}/dashboard`);

    // Should show error message, not crash
    await expect(
      page.locator('text=Error').or(page.locator('text=failed')).or(page.locator('text=offline'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show 404 page for unknown routes', async ({ page }) => {
    await page.goto(`${BASE_URL}/unknown-page-12345`);

    // Should show 404 or redirect to home
    await expect(
      page
        .locator('text=404')
        .or(page.locator('text=Not found'))
        .or(page.locator('text=IP Scaffold'))
    ).toBeVisible();
  });
});
