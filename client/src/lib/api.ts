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
  type: string;
  content: string;
}

export interface User {
  id: string;
  email: string;
  credits: number;
  isAdmin: boolean;
}

export const api = {
  async uploadPatent(file: File): Promise<{ success: boolean; patentId: string }> {
    const formData = new FormData();
    formData.append('pdf', file);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
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
    const response = await fetch(`/api/preview/${id}`);
    
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
    const response = await fetch('/api/user');
    
    if (!response.ok) {
      throw new Error('Not authenticated');
    }
    
    return response.json();
  },
  
  async getDashboard(): Promise<{ patents: Patent[] }> {
    const response = await fetch('/api/dashboard');
    
    if (!response.ok) {
      throw new Error('Failed to load dashboard');
    }
    
    return response.json();
  },
  
  async getPatentDetail(id: string): Promise<{
    patent: Partial<Patent>;
    artifacts: Artifact[];
  }> {
    const response = await fetch(`/api/patent/${id}`);
    
    if (!response.ok) {
      throw new Error('Failed to load patent');
    }
    
    return response.json();
  },
  
  async logout(): Promise<void> {
    await fetch('/api/logout', { method: 'POST' });
  },
};
