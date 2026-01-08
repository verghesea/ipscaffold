import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, desc, and, lt } from "drizzle-orm";
import { 
  users, 
  patents, 
  artifacts, 
  magicTokens, 
  creditTransactions,
  type User, 
  type InsertUser,
  type Patent,
  type InsertPatent,
  type Artifact,
  type InsertArtifact,
  type MagicToken,
  type InsertMagicToken,
  type CreditTransaction,
  type InsertCreditTransaction
} from "@shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(id: number): Promise<void>;
  updateUserCredits(id: number, credits: number): Promise<void>;

  // Patent operations
  getPatent(id: number): Promise<Patent | undefined>;
  getPatentsByUser(userId: number): Promise<Patent[]>;
  createPatent(patent: InsertPatent): Promise<Patent>;
  updatePatentStatus(id: number, status: string, errorMessage?: string): Promise<void>;

  // Artifact operations
  getArtifactsByPatent(patentId: number): Promise<Artifact[]>;
  createArtifact(artifact: InsertArtifact): Promise<Artifact>;
  
  // Magic token operations
  getMagicToken(token: string): Promise<MagicToken | undefined>;
  createMagicToken(magicToken: InsertMagicToken): Promise<MagicToken>;
  markTokenUsed(token: string): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;

  // Credit transaction operations
  createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction>;
  getCreditTransactionsByUser(userId: number): Promise<CreditTransaction[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      email: insertUser.email.toLowerCase(),
    }).returning();
    return user;
  }

  async updateUserLastLogin(id: number): Promise<void> {
    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, id));
  }

  async updateUserCredits(id: number, credits: number): Promise<void> {
    await db.update(users).set({ credits }).where(eq(users.id, id));
  }

  // Patent operations
  async getPatent(id: number): Promise<Patent | undefined> {
    const [patent] = await db.select().from(patents).where(eq(patents.id, id));
    return patent;
  }

  async getPatentsByUser(userId: number): Promise<Patent[]> {
    return await db.select().from(patents)
      .where(eq(patents.userId, userId))
      .orderBy(desc(patents.createdAt));
  }

  async createPatent(insertPatent: InsertPatent): Promise<Patent> {
    const [patent] = await db.insert(patents).values(insertPatent).returning();
    return patent;
  }

  async updatePatentStatus(id: number, status: string, errorMessage?: string): Promise<void> {
    await db.update(patents).set({ 
      status, 
      errorMessage,
      updatedAt: new Date() 
    }).where(eq(patents.id, id));
  }

  // Artifact operations
  async getArtifactsByPatent(patentId: number): Promise<Artifact[]> {
    return await db.select().from(artifacts)
      .where(eq(artifacts.patentId, patentId))
      .orderBy(artifacts.createdAt);
  }

  async createArtifact(insertArtifact: InsertArtifact): Promise<Artifact> {
    const [artifact] = await db.insert(artifacts).values(insertArtifact).returning();
    return artifact;
  }

  // Magic token operations
  async getMagicToken(token: string): Promise<MagicToken | undefined> {
    const [magicToken] = await db.select().from(magicTokens).where(eq(magicTokens.token, token));
    return magicToken;
  }

  async createMagicToken(insertMagicToken: InsertMagicToken): Promise<MagicToken> {
    const [magicToken] = await db.insert(magicTokens).values(insertMagicToken).returning();
    return magicToken;
  }

  async markTokenUsed(token: string): Promise<void> {
    await db.update(magicTokens).set({ usedAt: new Date() }).where(eq(magicTokens.token, token));
  }

  async cleanupExpiredTokens(): Promise<void> {
    await db.delete(magicTokens).where(lt(magicTokens.expiresAt, new Date()));
  }

  // Credit transaction operations
  async createCreditTransaction(insertTransaction: InsertCreditTransaction): Promise<CreditTransaction> {
    const [transaction] = await db.insert(creditTransactions).values(insertTransaction).returning();
    return transaction;
  }

  async getCreditTransactionsByUser(userId: number): Promise<CreditTransaction[]> {
    return await db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt));
  }
}

export const storage = new DatabaseStorage();
