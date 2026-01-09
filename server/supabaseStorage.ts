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
}

export const supabaseStorage = new SupabaseStorage();
