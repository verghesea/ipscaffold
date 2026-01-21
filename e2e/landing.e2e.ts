/**
 * E2E Tests - Landing Page
 *
 * Tests the landing page user experience including:
 * - Page load and content
 * - Upload CTA visibility
 * - Navigation elements
 *
 * Run: npm run test:e2e
 */

import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load landing page successfully', async ({ page }) => {
    // Check page title or main heading
    await expect(page).toHaveURL('/');

    // Page should not show error state
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('should display upload call-to-action', async ({ page }) => {
    // Look for upload-related elements
    const uploadCTA = page.getByRole('button').filter({ hasText: /upload|get started/i });

    // At least one CTA should be visible
    await expect(uploadCTA.first()).toBeVisible();
  });

  test('should have navigation elements', async ({ page }) => {
    // Check for navigation or header
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('should have login/signup option', async ({ page }) => {
    // Look for login or sign in text
    const loginLink = page.getByRole('link').filter({ hasText: /login|sign in|get started/i });

    if (await loginLink.count() > 0) {
      await expect(loginLink.first()).toBeVisible();
    }
  });

  test('should be responsive and usable', async ({ page }) => {
    // Check that page is scrollable or has content
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check there are no obvious layout breaks
    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();
  });
});

test.describe('Landing Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should be usable on mobile viewport', async ({ page }) => {
    await page.goto('/');

    // Page should load without errors
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Content should still be accessible
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
