export interface Patent {
  id: string;
  title: string;
  assignee: string | null;
  filingDate: string | null;
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

export interface User {
  id: string;
  email: string;
  credits: number;
  isAdmin: boolean;
}

const AUTH_TOKEN_KEY = 'ip_scaffold_access_token';
const REFRESH_TOKEN_KEY = 'ip_scaffold_refresh_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearStoredTokens(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
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
};
