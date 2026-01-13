import { z } from "zod";

// Type definitions for Supabase tables

// Users/Profiles
export interface User {
  id: string;
  email: string;
  credits: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export const insertUserSchema = z.object({
  email: z.string().email(),
  credits: z.number().default(100),
  is_admin: z.boolean().default(false),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

// Patents
export interface Patent {
  id: string;
  user_id: string | null;
  title: string | null;
  inventors: string | null;
  assignee: string | null;
  filing_date: string | null;
  issue_date: string | null;
  patent_number: string | null;
  publication_number: string | null;
  full_text: string;
  pdf_filename: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const insertPatentSchema = z.object({
  user_id: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  inventors: z.string().nullable().optional(),
  assignee: z.string().nullable().optional(),
  filing_date: z.string().nullable().optional(),
  issue_date: z.string().nullable().optional(),
  patent_number: z.string().nullable().optional(),
  publication_number: z.string().nullable().optional(),
  full_text: z.string(),
  pdf_filename: z.string().nullable().optional(),
  status: z.string().default("processing"),
  error_message: z.string().nullable().optional(),
});

export type InsertPatent = z.infer<typeof insertPatentSchema>;

// Artifacts (AI-generated content)
export interface Artifact {
  id: string;
  patent_id: string;
  artifact_type: string; // elia15, business_narrative, golden_circle
  content: string;
  tokens_used: number | null;
  generation_time_seconds: number | null;
  created_at: string;
}

export const insertArtifactSchema = z.object({
  patent_id: z.string(),
  artifact_type: z.string(),
  content: z.string(),
  tokens_used: z.number().nullable().optional(),
  generation_time_seconds: z.number().nullable().optional(),
});

export type InsertArtifact = z.infer<typeof insertArtifactSchema>;

// Section Images (DALL-E generated images for artifact sections)
export interface SectionImage {
  id: string;
  artifact_id: string;
  section_heading: string;
  section_order: number;
  image_url: string;
  dalle_prompt: string;
  image_size: string | null;
  generation_cost: string | null;
  created_at: string;
}

export const insertSectionImageSchema = z.object({
  artifact_id: z.string(),
  section_heading: z.string(),
  section_order: z.number(),
  image_url: z.string(),
  dalle_prompt: z.string(),
  image_size: z.string().nullable().optional(),
  generation_cost: z.string().nullable().optional(),
});

export type InsertSectionImage = z.infer<typeof insertSectionImageSchema>;

// Credit transactions
export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  transaction_type: string; // signup_bonus, ip_processing, purchase, refund, admin_adjustment, promo_code
  description: string | null;
  patent_id: string | null;
  created_at: string;
}

export const insertCreditTransactionSchema = z.object({
  user_id: z.string(),
  amount: z.number(),
  balance_after: z.number(),
  transaction_type: z.string(),
  description: z.string().nullable().optional(),
  patent_id: z.string().nullable().optional(),
});

export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;

// Promo codes
export interface PromoCode {
  id: string;
  code: string;
  credit_amount: number;
  max_redemptions: number | null;
  current_redemptions: number;
  expires_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export const insertPromoCodeSchema = z.object({
  code: z.string(),
  credit_amount: z.number(),
  max_redemptions: z.number().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  created_by: z.string().nullable().optional(),
});

export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;

// Promo code redemptions
export interface PromoCodeRedemption {
  id: string;
  user_id: string;
  promo_code_id: string;
  credits_awarded: number;
  redeemed_at: string;
}

export const insertPromoCodeRedemptionSchema = z.object({
  user_id: z.string(),
  promo_code_id: z.string(),
  credits_awarded: z.number(),
});

export type InsertPromoCodeRedemption = z.infer<typeof insertPromoCodeRedemptionSchema>;

// Notifications
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  read: boolean;
  created_at: string;
}

export const insertNotificationSchema = z.object({
  user_id: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  data: z.record(z.any()).nullable().optional(),
  read: z.boolean().default(false),
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
