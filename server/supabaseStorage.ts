import { supabaseAdmin } from './lib/supabase';

export interface Profile {
  id: string;
  email: string;
  credits: number;
  is_admin: boolean;
  current_organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  credits: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'viewer';
  joined_at: string;
}

export interface Patent {
  id: string;
  user_id: string | null;
  organization_id: string | null;
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

  async getPromoCodes(): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) return [];
    return data || [];
  }

  async createPromoCode(promoCode: {
    code: string;
    creditAmount: number;
    maxRedemptions: number | null;
    expiresAt: Date | null;
    createdBy: number;
  }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .insert({
        code: promoCode.code,
        credit_amount: promoCode.creditAmount,
        max_redemptions: promoCode.maxRedemptions,
        expires_at: promoCode.expiresAt?.toISOString(),
        created_by: promoCode.createdBy,
      })
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create promo code: ${error.message}`);
    return data;
  }

  async updatePromoCodeStatus(id: string, isActive: boolean): Promise<void> {
    await supabaseAdmin
      .from('promo_codes')
      .update({ is_active: isActive })
      .eq('id', id);
  }

  async redeemPromoCode(userId: string, code: string): Promise<{ creditsAwarded: number }> {
    const { data: promoCode, error: codeError } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (codeError || !promoCode) {
      throw new Error('Invalid or expired promo code');
    }

    if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
      throw new Error('This promo code has expired');
    }

    if (promoCode.max_redemptions && promoCode.current_redemptions >= promoCode.max_redemptions) {
      throw new Error('This promo code has reached its redemption limit');
    }

    const { data: existingRedemption } = await supabaseAdmin
      .from('promo_code_redemptions')
      .select('id')
      .eq('user_id', userId)
      .eq('promo_code_id', promoCode.id)
      .single();

    if (existingRedemption) {
      throw new Error('You have already redeemed this code');
    }

    const profile = await this.getProfile(userId);
    if (!profile) throw new Error('User not found');

    const newBalance = profile.credits + promoCode.credit_amount;

    await supabaseAdmin
      .from('profiles')
      .update({ credits: newBalance })
      .eq('id', userId);

    await supabaseAdmin
      .from('promo_codes')
      .update({ current_redemptions: promoCode.current_redemptions + 1 })
      .eq('id', promoCode.id);

    await supabaseAdmin.from('promo_code_redemptions').insert({
      user_id: userId,
      promo_code_id: promoCode.id,
      credits_awarded: promoCode.credit_amount,
    });

    await this.createCreditTransaction({
      user_id: userId,
      amount: promoCode.credit_amount,
      balance_after: newBalance,
      transaction_type: 'promo_code',
      description: `Redeemed promo code: ${code}`,
      patent_id: null,
    });

    return { creditsAwarded: promoCode.credit_amount };
  }

  // Organization Methods

  async getOrganization(orgId: string): Promise<Organization | null> {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (error) return null;
    return data;
  }

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, organizations(*)')
      .eq('user_id', userId);

    if (error || !data) return [];
    return data.map(row => row.organizations as Organization).filter(Boolean);
  }

  async createOrganization(name: string, creatorUserId: string): Promise<Organization> {
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({ name, credits: 100 })
      .select()
      .single();

    if (orgError) throw new Error(`Failed to create organization: ${orgError.message}`);

    // Add creator as admin
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: creatorUserId,
        role: 'admin',
      });

    if (memberError) {
      console.error('Failed to add creator as admin:', memberError);
    }

    // Set as current organization
    await this.setCurrentOrganization(creatorUserId, org.id);

    return org;
  }

  async addOrganizationMember(orgId: string, userId: string, role: 'admin' | 'member' | 'viewer'): Promise<void> {
    const { error } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: orgId,
        user_id: userId,
        role: role,
      });

    if (error) throw new Error(`Failed to add member: ${error.message}`);
  }

  async removeOrganizationMember(orgId: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('organization_id', orgId)
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to remove member: ${error.message}`);
  }

  async updateOrganizationMemberRole(orgId: string, userId: string, role: 'admin' | 'member' | 'viewer'): Promise<void> {
    const { error } = await supabaseAdmin
      .from('organization_members')
      .update({ role })
      .eq('organization_id', orgId)
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to update member role: ${error.message}`);
  }

  async getOrganizationMembers(orgId: string): Promise<Array<OrganizationMember & { profile: Profile }>> {
    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .select('*, profiles(*)')
      .eq('organization_id', orgId)
      .order('joined_at', { ascending: true });

    if (error || !data) return [];
    return data.map(row => ({
      ...row,
      profile: row.profiles as Profile,
    }));
  }

  async updateOrganizationCredits(orgId: string, credits: number): Promise<void> {
    await supabaseAdmin
      .from('organizations')
      .update({ credits })
      .eq('id', orgId);
  }

  async setCurrentOrganization(userId: string, orgId: string): Promise<void> {
    await supabaseAdmin
      .from('profiles')
      .update({ current_organization_id: orgId })
      .eq('id', userId);
  }

  async getOrganizationMemberRole(userId: string, orgId: string): Promise<'admin' | 'member' | 'viewer' | null> {
    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .single();

    if (error || !data) return null;
    return data.role;
  }

  async getPatentsByOrganization(orgId: string): Promise<Patent[]> {
    const { data, error } = await supabaseAdmin
      .from('patents')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  }

  async updateOrganizationName(orgId: string, name: string): Promise<void> {
    await supabaseAdmin
      .from('organizations')
      .update({ name })
      .eq('id', orgId);
  }
}

export const supabaseStorage = new SupabaseStorage();
