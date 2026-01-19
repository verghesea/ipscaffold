export interface Patent {
  id: string;
  title: string;
  friendlyTitle?: string | null;
  assignee: string | null;
  filingDate: string | null;
  patentNumber?: string | null;
  applicationNumber?: string | null;
  patentClassification?: string | null;
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
  isSuperAdmin: boolean;
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
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

export async function refreshSession(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const { accessToken, refreshToken: newRefreshToken } = await response.json();
      setStoredTokens(accessToken, newRefreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  if (token) {
    return { 'Authorization': `Bearer ${token}` };
  }
  return {};
}

export const api = {
  async uploadPatent(file: File): Promise<{ success: boolean; patentId: string }> {
    const formData = new FormData();
    formData.append('pdf', file);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    
    return response.json();
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
      const error = await response.json();
      throw new Error(error.error || 'Failed to send magic link');
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
  
  async getDashboard(): Promise<{ patents: Patent[] }> {
    const response = await fetch('/api/dashboard', {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to load dashboard');
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
};
