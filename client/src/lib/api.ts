export interface Patent {
  id: string;
  title: string;
  friendlyTitle?: string | null;
  inventors?: string | null;
  assignee: string | null;
  filingDate: string | null;
  issueDate?: string | null;
  patentNumber?: string | null;
  applicationNumber?: string | null;
  patentClassification?: string | null;
  fullText?: string;
  pdfFilename?: string | null;
  status: string;
  artifactCount?: number;
  createdAt?: string;
}

export interface Artifact {
  id?: string;
  type: string;
  content: string;
}

export interface SectionImage {
  id: string;
  artifact_id: string;
  section_number: number;
  section_title: string;
  image_url: string;
  prompt_used: string;
  image_title?: string | null;
  generation_metadata: {
    model: string;
    size: string;
    quality: string;
    revised_prompt?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateImagesResult {
  success: boolean;
  imagesGenerated: number;
  sectionImages: SectionImage[];
  errors?: string[];
  costEstimate?: {
    costUSD: number;
    breakdown: string;
  };
}

export interface PatentHeroImage {
  id: string;
  patent_id: string;
  image_url: string;
  prompt_used: string;
  generation_metadata: {
    model: string;
    size: string;
    quality: string;
    revised_prompt?: string;
    cost_usd: number;
    generation_time_seconds: number;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface SystemPrompt {
  id: string;
  prompt_type: 'elia15' | 'business_narrative' | 'golden_circle';
  system_prompt: string;
  user_prompt_template?: string;
  version: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
}

export interface User {
  id: string;
  email: string;
  credits: number;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  displayName?: string | null;
  organization?: string | null;
  profileCompleted?: boolean;
}

const AUTH_TOKEN_KEY = 'ip_scaffold_access_token';
const REFRESH_TOKEN_KEY = 'ip_scaffold_refresh_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

  // Log token details for debugging
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    const exp = new Date(payload.exp * 1000);
    const iat = payload.iat ? new Date(payload.iat * 1000) : null;
    const ttlMinutes = iat ? Math.round((exp.getTime() - iat.getTime()) / (1000 * 60)) : 'unknown';
    const minutesUntilExpiry = Math.round((exp.getTime() - Date.now()) / (1000 * 60));
    const userId = payload.sub || 'unknown';

    // UUID MONITORING: Expected user ID is 0515a5f4-1401-4e0e-901a-c5484d3c0f4c
    // Alert if we see 4a0e instead of 4e0e (known intermittent issue)
    if (userId.includes('4a0e')) {
      console.error('🚨 [Auth] WARNING: Incorrect UUID detected in token!', {
        userId,
        expected: '0515a5f4-1401-4e0e-901a-c5484d3c0f4c',
        actual: userId,
        diff: 'Has 4a0e instead of 4e0e',
        timestamp: new Date().toISOString(),
      });
      alert('WARNING: Authentication token has incorrect user ID! This will cause empty dashboard. Please clear cache and re-login.');
    } else if (userId.includes('4e0e')) {
      console.log('[Auth] ✓ Correct UUID verified (4e0e)');
    }

    console.log('[Auth] Tokens stored:', {
      expiresAt: exp.toISOString(),
      issuedAt: iat?.toISOString() || 'unknown',
      ttlMinutes,
      minutesUntilExpiry,
      userId,
    });
  } catch (e) {
    console.log('[Auth] Tokens stored (could not parse details)');
  }
}

export function clearStoredTokens(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getTokenExpiration(): Date | null {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiration = new Date(payload.exp * 1000);

    // Debug logging to help diagnose token expiration issues
    if (typeof window !== 'undefined' && (window as any).__AUTH_DEBUG__) {
      const now = new Date();
      const minutesRemaining = (expiration.getTime() - now.getTime()) / (1000 * 60);
      console.log('[Auth Debug] Token expiration:', {
        exp: payload.exp,
        expiresAt: expiration.toISOString(),
        now: now.toISOString(),
        minutesRemaining: Math.round(minutesRemaining * 10) / 10,
        issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : 'unknown',
      });
    }

    return expiration;
  } catch (e) {
    console.error('[Auth] Failed to parse token expiration:', e);
    return null;
  }
}

// Enable auth debugging in browser console: window.__AUTH_DEBUG__ = true
export function enableAuthDebug(): void {
  if (typeof window !== 'undefined') {
    (window as any).__AUTH_DEBUG__ = true;
    console.log('[Auth Debug] Auth debugging enabled. Token expiration will be logged.');
    // Immediately log current token state
    const expiration = getTokenExpiration();
    if (expiration) {
      const now = new Date();
      const minutesRemaining = (expiration.getTime() - now.getTime()) / (1000 * 60);
      console.log('[Auth Debug] Current token expires in', Math.round(minutesRemaining), 'minutes');
    } else {
      console.log('[Auth Debug] No valid token found');
    }
  }
}

export async function refreshSession(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    console.warn('[Auth] Cannot refresh session: no refresh token available');
    return false;
  }

  try {
    console.log('[Auth] Attempting to refresh session...');
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const { accessToken, refreshToken: newRefreshToken } = await response.json();
      setStoredTokens(accessToken, newRefreshToken);
      console.log('[Auth] Session refreshed successfully');
      return true;
    }

    const error = await response.json().catch(() => ({}));
    console.warn('[Auth] Session refresh failed:', response.status, error);
    return false;
  } catch (e) {
    console.error('[Auth] Session refresh error:', e);
    return false;
  }
}

export function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  if (token) {
    // UUID MONITORING: Log which user ID is being used for API calls
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userId = payload.sub || 'unknown';

      if (userId.includes('4a0e')) {
        console.error('🚨 [Auth] Using WRONG UUID for API call:', userId);
      } else {
        console.log('[Auth] Using correct UUID (4e0e) for API call');
      }
    } catch (e) {
      // Token parsing failed, just continue
    }

    console.log('[Auth] Token found, length:', token.length);
    return { 'Authorization': `Bearer ${token}` };
  }
  console.warn('[Auth] No token found in localStorage');
  return {};
}

export const api = {
  async uploadPatent(file: File): Promise<{ success: boolean; patentId: string }> {
    console.log('[API] uploadPatent called with file:', file.name);

    const formData = new FormData();
    formData.append('pdf', file);

    const authHeaders = getAuthHeaders();
    console.log('[API] Auth headers present:', Object.keys(authHeaders).length > 0);

    console.log('[API] Making POST request to /api/upload...');
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });

    console.log('[API] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.json();
      console.error('[API] Upload failed with error:', error);
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();
    console.log('[API] Upload successful:', result);
    return result;
  },
  
  async getPreview(id: string): Promise<{
    patent: Partial<Patent>;
    elia15: string | null;
    showEmailGate: boolean;
  }> {
    const response = await fetch(`/api/preview/${id}`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to load preview');
    }
    
    return response.json();
  },
  
  async requestMagicLink(email: string, patentId?: string): Promise<void> {
    const response = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, patentId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const error: any = new Error(errorData.error || 'Failed to send magic link');
      error.code = errorData.code; // Preserve error code (e.g., SIGNUP_CAP_REACHED)
      error.details = errorData.details;
      throw error;
    }
  },
  
  async getUser(): Promise<User> {
    const response = await fetch('/api/user', {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Not authenticated');
    }

    return response.json();
  },

  async completeProfile(displayName: string, organization: string): Promise<void> {
    const response = await fetch('/api/user/complete-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ displayName, organization }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to complete profile');
    }
  },

  async skipProfile(): Promise<void> {
    const response = await fetch('/api/user/skip-profile', {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to skip profile');
    }
  },

  async getDashboard(): Promise<{ patents: Patent[] }> {
    const response = await fetch('/api/dashboard', {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to load dashboard');
    }

    return response.json();
  },

  async fixOrphanedPatents(): Promise<{
    success: boolean;
    totalNotificationPatents: number;
    totalOrphanedInDb: number;
    fixedCount: number;
    fixedPatents: string[];
    alreadyLinkedCount: number;
    notFoundCount: number;
    message: string;
  }> {
    const response = await fetch('/api/fix-orphaned-patents', {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fix orphaned patents');
    }

    return response.json();
  },

  async claimPatents(patentIds: string[]): Promise<{
    success: boolean;
    claimedCount: number;
    claimedPatents: string[];
    errors?: string[];
    message: string;
  }> {
    const response = await fetch('/api/claim-patents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ patentIds }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to claim patents');
    }

    return response.json();
  },

  async debugPatents(): Promise<{
    userId: string;
    summary: {
      totalPatentsInDB: number;
      userPatentsCount: number;
      orphanedPatentsCount: number;
      userNotificationsCount: number;
      uniquePatentIdsInNotifications: number;
    };
    userPatents: any[];
    orphanedPatents: any[];
    notificationPatentStatus: Record<string, any>;
    recentNotifications: any[];
    errors: Record<string, string | undefined>;
  }> {
    const response = await fetch('/api/debug/patents', {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Debug query failed');
    }

    return response.json();
  },
  
  async getPatentDetail(id: string): Promise<{
    patent: Partial<Patent>;
    artifacts: Artifact[];
  }> {
    const response = await fetch(`/api/patent/${id}`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to load patent');
    }
    
    return response.json();
  },
  
  async logout(): Promise<void> {
    clearStoredTokens();
    await fetch('/api/logout', { method: 'POST' });
  },

  async redeemPromoCode(code: string): Promise<{ creditsAwarded: number }> {
    const response = await fetch('/api/promo/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ code }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to redeem code');
    }
    
    return response.json();
  },

  async retryPatent(id: string): Promise<{ success: boolean }> {
    const response = await fetch(`/api/patent/${id}/retry`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to retry');
    }

    return response.json();
  },

  // Image generation methods
  async getSectionImages(artifactId: string): Promise<SectionImage[]> {
    const response = await fetch(`/api/images/${artifactId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to load section images');
    }

    return response.json();
  },

  async generateSectionImages(artifactId: string): Promise<GenerateImagesResult> {
    const response = await fetch(`/api/images/generate/${artifactId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate images');
    }

    return response.json();
  },

  async regenerateSectionImage(
    artifactId: string,
    sectionNumber: number
  ): Promise<SectionImage> {
    const response = await fetch(
      `/api/images/regenerate/${artifactId}/${sectionNumber}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to regenerate image');
    }

    return response.json();
  },

  async deleteSectionImage(imageId: string): Promise<void> {
    const response = await fetch(`/api/images/${imageId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to delete image');
    }
  },

  async updateImagePrompt(
    imageId: string,
    newPrompt: string
  ): Promise<SectionImage> {
    const response = await fetch(`/api/images/${imageId}/prompt`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ newPrompt }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update image prompt');
    }

    return response.json();
  },

  // Hero image methods
  async getPatentHeroImage(patentId: string): Promise<PatentHeroImage | null> {
    const response = await fetch(`/api/patent/${patentId}/hero-image`, {
      headers: getAuthHeaders(),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to load hero image');
    }

    return response.json();
  },

  async generatePatentHeroImage(patentId: string): Promise<PatentHeroImage> {
    const response = await fetch(`/api/patent/${patentId}/hero-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate hero image');
    }

    return response.json();
  },

  // Friendly title methods
  async updatePatentFriendlyTitle(
    patentId: string,
    friendlyTitle: string
  ): Promise<void> {
    const response = await fetch(`/api/patent/${patentId}/friendly-title`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ friendlyTitle }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update friendly title');
    }
  },

  // System prompt methods (super admin only)
  async getAllSystemPrompts(): Promise<SystemPrompt[]> {
    const response = await fetch('/api/admin/system-prompts', {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load system prompts');
    }

    return response.json();
  },

  async getSystemPromptVersions(
    promptType: 'elia15' | 'business_narrative' | 'golden_circle'
  ): Promise<SystemPrompt[]> {
    const response = await fetch(
      `/api/admin/system-prompts/${promptType}/versions`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load prompt versions');
    }

    return response.json();
  },

  async updateSystemPrompt(
    promptType: 'elia15' | 'business_narrative' | 'golden_circle',
    newPrompt: string,
    notes?: string
  ): Promise<SystemPrompt> {
    const response = await fetch(`/api/admin/system-prompts/${promptType}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ newPrompt, notes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update system prompt');
    }

    return response.json();
  },

  async rollbackSystemPrompt(
    promptType: 'elia15' | 'business_narrative' | 'golden_circle',
    versionId: string
  ): Promise<SystemPrompt> {
    const response = await fetch('/api/admin/system-prompts/rollback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ promptType, versionId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to rollback system prompt');
    }

    return response.json();
  },

  // User management methods (super admin only)
  async createUser(
    email: string,
    credits?: number,
    isAdmin?: boolean
  ): Promise<User> {
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ email, credits, isAdmin }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create user');
    }

    const data = await response.json();
    return data.user;
  },

  async deleteUser(userId: string): Promise<void> {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }
  },

  // Re-extract metadata from stored PDF (admin only)
  async reExtractMetadata(patentId: string): Promise<Patent> {
    const response = await fetch(`/api/admin/patent/${patentId}/re-extract`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to re-extract metadata');
    }

    const data = await response.json();
    return data.patent;
  },

  // Manually update patent metadata (admin only)
  async updatePatentMetadata(patentId: string, metadata: {
    inventors?: string | null;
    assignee?: string | null;
    filingDate?: string | null;
    issueDate?: string | null;
    patentNumber?: string | null;
    applicationNumber?: string | null;
    patentClassification?: string | null;
  }): Promise<{
    patent: Patent;
    opportunities?: Array<{
      fieldName: string;
      count: number;
      ready: boolean;
      message: string;
    }>;
  }> {
    const response = await fetch(`/api/admin/patent/${patentId}/metadata`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update metadata');
    }

    const data = await response.json();
    return {
      patent: data.patent,
      opportunities: data.opportunities,
    };
  },

  // ============================================================
  // SIGNUP CAP & WAITLIST MANAGEMENT (Super Admin)
  // ============================================================

  async getSignupStats(): Promise<{
    signupCap: number;
    signupsEnabled: boolean;
    currentCount: number;
    available: boolean;
    waitlistCount: number;
  }> {
    const response = await fetch('/api/admin/signup-stats', {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get signup stats');
    }

    return response.json();
  },

  async getAllSettings(): Promise<Array<{
    key: string;
    value: string;
    description: string | null;
    updated_at: string;
    updated_by: string | null;
  }>> {
    const response = await fetch('/api/admin/settings', {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get settings');
    }

    const data = await response.json();
    return data.settings;
  },

  async updateSignupCap(value: number): Promise<void> {
    const response = await fetch('/api/admin/settings/signup-cap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ value: value.toString() }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update signup cap');
    }
  },

  async toggleSignupsEnabled(enabled: boolean): Promise<void> {
    const response = await fetch('/api/admin/settings/signups-enabled', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to toggle signups');
    }
  },

  async getWaitlist(): Promise<Array<{
    id: string;
    email: string;
    source: string | null;
    referrer: string | null;
    metadata: any;
    approved: boolean;
    approved_by: string | null;
    approved_at: string | null;
    created_at: string;
  }>> {
    const response = await fetch('/api/admin/waitlist', {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get waitlist');
    }

    const data = await response.json();
    return data.waitlist;
  },

  async approveWaitlistEntry(id: string): Promise<void> {
    const response = await fetch(`/api/admin/waitlist/${id}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve waitlist entry');
    }
  },

  async deleteWaitlistEntry(id: string): Promise<void> {
    const response = await fetch(`/api/admin/waitlist/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete waitlist entry');
    }
  },
};
