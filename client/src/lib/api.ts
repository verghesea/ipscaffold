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
  id: string;
  type: string;
  content: string;
}

export interface Organization {
  id: string;
  name: string;
  credits: number;
  role?: 'admin' | 'member' | 'viewer';
  isCurrent?: boolean;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  joinedAt: string;
}

export interface User {
  id: string;
  email: string;
  credits: number;
  isAdmin: boolean;
  currentOrganization?: Organization | null;
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

  // Organization methods

  async getOrganizations(): Promise<{ organizations: Organization[] }> {
    const response = await fetch('/api/organizations', {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to load organizations');
    }

    return response.json();
  },

  async createOrganization(name: string): Promise<{ organization: Organization }> {
    const response = await fetch('/api/organizations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create organization');
    }

    return response.json();
  },

  async switchOrganization(organizationId: string): Promise<{ success: boolean; organization: Organization }> {
    const response = await fetch('/api/organizations/switch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ organizationId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to switch organization');
    }

    return response.json();
  },

  async getOrganizationMembers(organizationId: string): Promise<{ members: OrganizationMember[] }> {
    const response = await fetch(`/api/organizations/${organizationId}/members`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to load members');
    }

    return response.json();
  },

  async inviteOrganizationMember(organizationId: string, email: string, role: 'admin' | 'member' | 'viewer'): Promise<{ success: boolean }> {
    const response = await fetch(`/api/organizations/${organizationId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ email, role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to invite member');
    }

    return response.json();
  },

  async removeOrganizationMember(organizationId: string, userId: string): Promise<{ success: boolean }> {
    const response = await fetch(`/api/organizations/${organizationId}/members/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove member');
    }

    return response.json();
  },

  async updateOrganizationMemberRole(organizationId: string, userId: string, role: 'admin' | 'member' | 'viewer'): Promise<{ success: boolean }> {
    const response = await fetch(`/api/organizations/${organizationId}/members/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update member role');
    }

    return response.json();
  },

  async updateOrganization(organizationId: string, name: string): Promise<{ success: boolean }> {
    const response = await fetch(`/api/organizations/${organizationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update organization');
    }

    return response.json();
  },
};
