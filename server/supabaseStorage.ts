import { supabaseAdmin } from './lib/supabase';

export interface Profile {
  id: string;
  email: string;
  credits: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Patent {
  id: string;
  user_id: string | null;
  title: string | null;
  inventors: string | null;
  assignee: string | null;
  filing_date: string | null;
  issue_date: string | null;
  full_text: string;
  pdf_filename: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Artifact {
  id: string;
  patent_id: string;
  artifact_type: string;
  content: string;
  tokens_used: number | null;
  generation_time_seconds: number | null;
  created_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  transaction_type: string;
  description: string | null;
  patent_id: string | null;
  created_at: string;
}

export class SupabaseStorage {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) return null;
    return data;
  }

  async getProfileByEmail(email: string): Promise<Profile | null> {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    
    if (error) return null;
    return data;
  }

  async updateProfileCredits(userId: string, credits: number): Promise<void> {
    await supabaseAdmin
      .from('profiles')
      .update({ credits })
      .eq('id', userId);
  }

  async createProfile(profile: { id: string; email: string; credits: number; is_admin: boolean }): Promise<void> {
    const { error } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: profile.id,
        email: profile.email.toLowerCase(),
        credits: profile.credits,
        is_admin: profile.is_admin,
      });
    
    if (error) {
      console.error('Failed to create profile:', error);
      throw new Error(`Failed to create profile: ${error.message}`);
    }
  }

  async getPatent(id: string): Promise<Patent | null> {
    const { data, error } = await supabaseAdmin
      .from('patents')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data;
  }

  async getPatentsByUser(userId: string): Promise<Patent[]> {
    const { data, error } = await supabaseAdmin
      .from('patents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) return [];
    return data || [];
  }

  async createPatent(patent: Omit<Patent, 'id' | 'created_at' | 'updated_at'>): Promise<Patent> {
    const { data, error } = await supabaseAdmin
      .from('patents')
      .insert(patent)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create patent: ${error.message}`);
    return data;
  }

  async updatePatentStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    await supabaseAdmin
      .from('patents')
      .update({ status, error_message: errorMessage || null })
      .eq('id', id);
  }

  async updatePatentUserId(id: string, userId: string): Promise<void> {
    await supabaseAdmin
      .from('patents')
      .update({ user_id: userId })
      .eq('id', id);
  }

  async getArtifactsByPatent(patentId: string): Promise<Artifact[]> {
    const { data, error } = await supabaseAdmin
      .from('artifacts')
      .select('*')
      .eq('patent_id', patentId)
      .order('created_at', { ascending: true });
    
    if (error) return [];
    return data || [];
  }

  async createArtifact(artifact: Omit<Artifact, 'id' | 'created_at'>): Promise<Artifact> {
    const { data, error } = await supabaseAdmin
      .from('artifacts')
      .insert(artifact)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create artifact: ${error.message}`);
    return data;
  }

  async createCreditTransaction(transaction: Omit<CreditTransaction, 'id' | 'created_at'>): Promise<CreditTransaction> {
    const { data, error } = await supabaseAdmin
      .from('credit_transactions')
      .insert(transaction)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create transaction: ${error.message}`);
    return data;
  }

  async getCreditTransactionsByUser(userId: string): Promise<CreditTransaction[]> {
    const { data, error } = await supabaseAdmin
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) return [];
    return data || [];
  }

  async getAllProfiles(): Promise<Profile[]> {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) return [];
    return data || [];
  }

  async getAllPatents(): Promise<Patent[]> {
    const { data, error } = await supabaseAdmin
      .from('patents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) return [];
    return data || [];
  }

  async getSystemMetrics(): Promise<any> {
    const { data, error } = await supabaseAdmin.rpc('get_system_metrics');
    if (error) {
      console.error('Failed to get system metrics:', error);
      return {
        total_users: 0,
        total_patents: 0,
        patents_today: 0,
        total_credits_used: 0,
        status_breakdown: [],
      };
    }
    return data;
  }

  async updateProfileAdmin(userId: string, isAdmin: boolean): Promise<void> {
    await supabaseAdmin
      .from('profiles')
      .update({ is_admin: isAdmin })
      .eq('id', userId);
  }

  async adjustUserCredits(userId: string, amount: number, description: string): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) throw new Error('User not found');
    
    const newBalance = profile.credits + amount;
    await this.updateProfileCredits(userId, newBalance);
    await this.createCreditTransaction({
      user_id: userId,
      amount: amount,
      balance_after: newBalance,
      transaction_type: 'admin_adjustment',
      description: description,
      patent_id: null,
    });
  }

  async createAuditLog(adminId: string, action: string, targetType?: string, targetId?: string, details?: any): Promise<void> {
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    });
  }
}

export const supabaseStorage = new SupabaseStorage();
