import { supabaseAdmin } from './lib/supabase';

export interface Profile {
  id: string;
  email: string;
  credits: number;
  is_admin: boolean;
  is_super_admin: boolean;
  display_name: string | null;
  organization: string | null;
  profile_prompt_skipped_at: string | null;
  profile_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Patent {
  id: string;
  user_id: string | null;
  title: string | null;
  friendly_title?: string | null;
  inventors: string | null;
  assignee: string | null;
  filing_date: string | null;
  issue_date: string | null;
  patent_number: string | null;
  application_number: string | null;
  patent_classification: string | null;
  full_text: string;
  pdf_filename: string | null;
  pdf_storage_path: string | null;
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

export interface PatentHeroImage {
  id: string;
  patent_id: string;
  image_url: string;
  prompt_used: string;
  image_title: string | null;
  generation_metadata: any | null;
  created_at: string;
  updated_at: string;
}

export interface SectionImage {
  id: string;
  artifact_id: string;
  section_number: number;
  section_title: string;
  image_url: string;
  prompt_used: string;
  image_title: string | null;
  generation_metadata: any | null;
  created_at: string;
  updated_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  source: string | null;
  referrer: string | null;
  metadata: any | null;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface SignupStats {
  signupCap: number;
  signupsEnabled: boolean;
  currentCount: number;
  available: boolean;
  waitlistCount: number;
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

  async updateProfilePersonalization(
    userId: string,
    displayName: string,
    organization: string
  ): Promise<void> {
    await supabaseAdmin
      .from('profiles')
      .update({
        display_name: displayName,
        organization: organization,
        profile_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
  }

  async skipProfileCompletion(userId: string): Promise<void> {
    await supabaseAdmin
      .from('profiles')
      .update({
        profile_prompt_skipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
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
    console.log('[getPatentsByUser] ========== QUERYING PATENTS ==========');
    console.log('[getPatentsByUser] User ID:', userId);
    console.log('[getPatentsByUser] User ID type:', typeof userId, 'Length:', userId.length);
    console.log('[getPatentsByUser] Timestamp:', new Date().toISOString());

    // DIAGNOSTIC: Sample patents in database
    const { data: samplePatents, error: sampleError } = await supabaseAdmin
      .from('patents')
      .select('id, user_id, title, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (sampleError) {
      console.error('[getPatentsByUser] Error fetching sample patents:', sampleError);
    } else {
      console.log('[getPatentsByUser] Sample of ALL patents in DB (first 5):');
      samplePatents?.forEach((p, i) => {
        const userIdMatch = p.user_id === userId ? '✓ MATCH' : '✗ no match';
        console.log(`  ${i + 1}. user_id: ${p.user_id} ${userIdMatch}, title: ${p.title?.substring(0, 40) || 'null'}`);
      });
    }

    // MAIN QUERY: Get patents for this specific user
    console.log('[getPatentsByUser] Running main query with user_id:', userId);
    const { data, error } = await supabaseAdmin
      .from('patents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false});

    if (error) {
      console.error('[getPatentsByUser] ❌ ERROR querying user patents:', error);
      console.error('[getPatentsByUser] Error code:', error.code);
      console.error('[getPatentsByUser] Error message:', error.message);
      console.error('[getPatentsByUser] Error details:', JSON.stringify(error, null, 2));
      return [];
    }

    console.log('[getPatentsByUser] ✓ Query succeeded');
    console.log('[getPatentsByUser] Found', data?.length || 0, 'patents for user');

    if (data && data.length > 0) {
      console.log('[getPatentsByUser] First 3 patents:');
      data.slice(0, 3).forEach((p, i) => {
        console.log(`  ${i + 1}. ID: ${p.id}, Title: ${p.title?.substring(0, 40) || 'null'}, Status: ${p.status}`);
      });
    } else {
      console.log('[getPatentsByUser] ⚠️  NO PATENTS FOUND for user:', userId);
      console.log('[getPatentsByUser] This should not happen if patents exist in DB with this user_id');
    }

    return data || [];
  }

  async createPatent(patent: Omit<Patent, 'id' | 'created_at' | 'updated_at'>): Promise<Patent> {
    console.log('[createPatent] Creating patent with user_id:', patent.user_id);
    console.log('[createPatent] User ID type:', typeof patent.user_id);

    const { data, error } = await supabaseAdmin
      .from('patents')
      .insert(patent)
      .select()
      .single();

    if (error) {
      console.error('[createPatent] Failed to create patent:', error);
      throw new Error(`Failed to create patent: ${error.message}`);
    }

    console.log('[createPatent] Patent created with ID:', data.id);
    console.log('[createPatent] Stored user_id:', data.user_id);
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

    if (error) {
      console.error('[supabaseStorage] ERROR fetching artifacts for patent', patentId);
      console.error('[supabaseStorage] Error details:', error);
      console.error('[supabaseStorage] Error message:', error.message);
      console.error('[supabaseStorage] Error code:', error.code);
      return [];
    }
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

  // Section Images methods
  async getSectionImagesByArtifact(artifactId: string): Promise<SectionImage[]> {
    const { data, error } = await supabaseAdmin
      .from('section_images')
      .select('*')
      .eq('artifact_id', artifactId)
      .order('section_number', { ascending: true });

    if (error) return [];
    return data || [];
  }

  async getSectionImage(artifactId: string, sectionNumber: number): Promise<SectionImage | null> {
    const { data, error } = await supabaseAdmin
      .from('section_images')
      .select('*')
      .eq('artifact_id', artifactId)
      .eq('section_number', sectionNumber)
      .single();

    if (error) return null;
    return data;
  }

  async createSectionImage(sectionImage: Omit<SectionImage, 'id' | 'created_at' | 'updated_at'>): Promise<SectionImage> {
    const { data, error } = await supabaseAdmin
      .from('section_images')
      .insert(sectionImage)
      .select()
      .single();

    if (error) throw new Error(`Failed to create section image: ${error.message}`);
    return data;
  }

  async upsertSectionImage(sectionImage: Omit<SectionImage, 'id' | 'created_at' | 'updated_at'>): Promise<SectionImage> {
    const { data, error } = await supabaseAdmin
      .from('section_images')
      .upsert(sectionImage, {
        onConflict: 'artifact_id,section_number'
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to upsert section image: ${error.message}`);
    return data;
  }

  async deleteSectionImage(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('section_images')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete section image: ${error.message}`);
  }

  async deleteSectionImagesByArtifact(artifactId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('section_images')
      .delete()
      .eq('artifact_id', artifactId);

    if (error) throw new Error(`Failed to delete section images: ${error.message}`);
  }

  // Patent Hero Image methods
  async getPatentHeroImage(patentId: string): Promise<PatentHeroImage | null> {
    const { data, error } = await supabaseAdmin
      .from('patent_hero_images')
      .select('*')
      .eq('patent_id', patentId)
      .single();

    if (error) return null;
    return data;
  }

  async upsertPatentHeroImage(
    heroImage: Omit<PatentHeroImage, 'id' | 'created_at' | 'updated_at'>
  ): Promise<PatentHeroImage> {
    const { data, error } = await supabaseAdmin
      .from('patent_hero_images')
      .upsert(heroImage, { onConflict: 'patent_id' })
      .select()
      .single();

    if (error) throw new Error(`Failed to save hero image: ${error.message}`);
    return data;
  }

  async deletePatentHeroImage(patentId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('patent_hero_images')
      .delete()
      .eq('patent_id', patentId);

    if (error) throw new Error(`Failed to delete hero image: ${error.message}`);
  }

  // Patent Title methods
  async updatePatentFriendlyTitle(patentId: string, friendlyTitle: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('patents')
      .update({ friendly_title: friendlyTitle })
      .eq('id', patentId);

    if (error) throw new Error(`Failed to update friendly title: ${error.message}`);
  }

  // Super Admin User Management methods
  async createUserByAdmin(email: string, credits: number = 100): Promise<Profile> {
    // Use Supabase Admin API to create user
    const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: true, // Auto-confirm email
    });

    if (error) throw new Error(`Failed to create user: ${error.message}`);

    // Profile created automatically by trigger, but update credits
    await this.updateProfileCredits(authUser.user.id, credits);

    const profile = await this.getProfile(authUser.user.id);
    if (!profile) throw new Error('Failed to retrieve created profile');

    return profile;
  }

  async deleteUserByAdmin(userId: string): Promise<void> {
    // Use Supabase Admin API to delete user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) throw new Error(`Failed to delete user: ${error.message}`);
  }

  async logUserManagementAction(
    adminId: string,
    action: string,
    targetUserId: string,
    details: any
  ): Promise<void> {
    await supabaseAdmin.from('user_management_log').insert({
      admin_id: adminId,
      action,
      target_user_id: targetUserId,
      details,
    });
  }

  // PDF Storage methods
  async uploadPdfToStorage(
    fileBuffer: Buffer,
    filename: string,
    userId: string | null
  ): Promise<{ storagePath: string; publicUrl: string }> {
    const bucket = 'patent-pdfs';
    const folder = userId || 'anonymous';
    const storagePath = `${folder}/${filename}`;

    // Upload to Supabase Storage
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      throw new Error(`Failed to upload PDF to storage: ${error.message}`);
    }

    // Get public URL
    const { data } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    return {
      storagePath,
      publicUrl: data.publicUrl,
    };
  }

  async downloadPdfFromStorage(storagePath: string): Promise<Buffer> {
    const bucket = 'patent-pdfs';

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(storagePath);

    if (error) {
      throw new Error(`Failed to download PDF from storage: ${error.message}`);
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async deletePdfFromStorage(storagePath: string): Promise<void> {
    const bucket = 'patent-pdfs';

    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([storagePath]);

    if (error) {
      console.error(`Failed to delete PDF from storage: ${error.message}`);
      // Don't throw - deletion is not critical
    }
  }

  // ============================================================
  // APP SETTINGS & SIGNUP CAP METHODS
  // ============================================================

  async getAppSetting(key: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error) return null;
    return data.value;
  }

  async getAllAppSettings(): Promise<AppSetting[]> {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('*')
      .order('key');

    if (error) return [];
    return data || [];
  }

  async updateAppSetting(key: string, value: string, updatedBy: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('app_settings')
      .update({ value, updated_by: updatedBy, updated_at: new Date().toISOString() })
      .eq('key', key);

    if (error) {
      throw new Error(`Failed to update setting ${key}: ${error.message}`);
    }
  }

  async getSignupStats(): Promise<SignupStats> {
    // Get all settings
    const settings = await this.getAllAppSettings();
    const signupCap = parseInt(settings.find(s => s.key === 'signup_cap')?.value || '50');
    const signupsEnabled = settings.find(s => s.key === 'signups_enabled')?.value === 'true';

    // Get actual count from profiles
    const { count: currentCount } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Get waitlist count
    const { count: waitlistCount } = await supabaseAdmin
      .from('waitlist')
      .select('*', { count: 'exact', head: true })
      .eq('approved', false);

    return {
      signupCap,
      signupsEnabled,
      currentCount: currentCount || 0,
      available: signupsEnabled && (currentCount || 0) < signupCap,
      waitlistCount: waitlistCount || 0,
    };
  }

  async checkSignupAvailable(): Promise<boolean> {
    const stats = await this.getSignupStats();
    return stats.available;
  }

  // ============================================================
  // WAITLIST METHODS
  // ============================================================

  async addToWaitlist(
    email: string,
    source?: string,
    referrer?: string,
    metadata?: any
  ): Promise<WaitlistEntry> {
    const { data, error } = await supabaseAdmin
      .from('waitlist')
      .insert({
        email: email.toLowerCase(),
        source,
        referrer,
        metadata,
      })
      .select()
      .single();

    if (error) {
      // Check if it's a duplicate email error
      if (error.code === '23505') {
        throw new Error('Email already on waitlist');
      }
      throw new Error(`Failed to add to waitlist: ${error.message}`);
    }

    return data;
  }

  async getWaitlist(approvedOnly: boolean = false): Promise<WaitlistEntry[]> {
    let query = supabaseAdmin
      .from('waitlist')
      .select('*')
      .order('created_at', { ascending: false });

    if (approvedOnly) {
      query = query.eq('approved', true);
    }

    const { data, error } = await query;

    if (error) return [];
    return data || [];
  }

  async approveWaitlistEntry(
    id: string,
    approvedBy: string
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('waitlist')
      .update({
        approved: true,
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to approve waitlist entry: ${error.message}`);
    }
  }

  async deleteWaitlistEntry(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('waitlist')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete waitlist entry: ${error.message}`);
    }
  }
}

export const supabaseStorage = new SupabaseStorage();
