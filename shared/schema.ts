import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - stores user accounts
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  credits: integer("credits").notNull().default(100),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLogin: timestamp("last_login"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Patents table - stores uploaded patent documents
export const patents = pgTable("patents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  inventors: text("inventors"),
  assignee: text("assignee"),
  filingDate: text("filing_date"),
  issueDate: text("issue_date"),
  patentNumber: text("patent_number"),
  publicationNumber: text("publication_number"),
  fullText: text("full_text").notNull(),
  pdfFilename: text("pdf_filename"),
  status: text("status").notNull().default("processing"), // processing, elia15_complete, completed, failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPatentSchema = createInsertSchema(patents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectPatentSchema = createSelectSchema(patents);
export type InsertPatent = z.infer<typeof insertPatentSchema>;
export type Patent = typeof patents.$inferSelect;

// Artifacts table - stores AI-generated content
export const artifacts = pgTable("artifacts", {
  id: serial("id").primaryKey(),
  patentId: integer("patent_id").notNull().references(() => patents.id, { onDelete: "cascade" }),
  artifactType: text("artifact_type").notNull(), // elia15, business_narrative, golden_circle
  content: text("content").notNull(),
  tokensUsed: integer("tokens_used"),
  generationTimeSeconds: integer("generation_time_seconds"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertArtifactSchema = createInsertSchema(artifacts).omit({
  id: true,
  createdAt: true,
});
export const selectArtifactSchema = createSelectSchema(artifacts);
export type InsertArtifact = z.infer<typeof insertArtifactSchema>;
export type Artifact = typeof artifacts.$inferSelect;

// Magic tokens for passwordless authentication
export const magicTokens = pgTable("magic_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  patentId: integer("patent_id").references(() => patents.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMagicTokenSchema = createInsertSchema(magicTokens).omit({
  id: true,
  createdAt: true,
});
export const selectMagicTokenSchema = createSelectSchema(magicTokens);
export type InsertMagicToken = z.infer<typeof insertMagicTokenSchema>;
export type MagicToken = typeof magicTokens.$inferSelect;

// Credit transactions for audit trail
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // Negative for deduction, positive for addition
  balanceAfter: integer("balance_after").notNull(),
  transactionType: text("transaction_type").notNull(), // signup_bonus, ip_processing, purchase, refund, admin_adjustment
  description: text("description"),
  patentId: integer("patent_id").references(() => patents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});
export const selectCreditTransactionSchema = createSelectSchema(creditTransactions);
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;

// Promo codes for free credits
export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  creditAmount: integer("credit_amount").notNull(),
  maxRedemptions: integer("max_redemptions"),
  currentRedemptions: integer("current_redemptions").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({
  id: true,
  currentRedemptions: true,
  createdAt: true,
});
export const selectPromoCodeSchema = createSelectSchema(promoCodes);
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;

// Promo code redemptions
export const promoCodeRedemptions = pgTable("promo_code_redemptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  promoCodeId: integer("promo_code_id").notNull().references(() => promoCodes.id, { onDelete: "cascade" }),
  creditsAwarded: integer("credits_awarded").notNull(),
  redeemedAt: timestamp("redeemed_at").notNull().defaultNow(),
});

export const insertPromoCodeRedemptionSchema = createInsertSchema(promoCodeRedemptions).omit({
  id: true,
  redeemedAt: true,
});
export const selectPromoCodeRedemptionSchema = createSelectSchema(promoCodeRedemptions);
export type InsertPromoCodeRedemption = z.infer<typeof insertPromoCodeRedemptionSchema>;
export type PromoCodeRedemption = typeof promoCodeRedemptions.$inferSelect;
