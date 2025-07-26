import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, desc, asc, count, gte, lte, isNull, isNotNull } from 'drizzle-orm';
import { emailAnalysis, historicalAnalysisBatch, emailPreferences } from '../db/schema';
import { LocalAIService, type EmailContent } from './local-ai';

// Types for the historical email analysis that match the API routes expectations
export interface EmailAnalysisResult {
  id: string;
  connectionId: string;
  threadId: string;
  messageId: string;
  subject: string;
  sender: string;
  receivedAt: Date;
  importanceScore: string;
  category: string;
  tags: string[];
  isSpam: boolean;
  spamConfidence: string;
  reasoning: string;
  processedAt: Date;
  createdAt: Date;
}

export interface HistoricalAnalysisBatch {
  id: string;
  connectionId: string;
  userId: string;
  status: string;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
  totalEmails: number;
  processedEmails: number;
  spamDetected: number;
  importantFound: number;
  processingStart: Date | null;
  processingEnd: Date | null;
  errorMessage: string | null;
  settings: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface HistoricalAnalysisSettings {
  spamThreshold: number;
  importanceThreshold: number;
  batchSize: number;
  maxDailyProcessing: number;
  analysisModel: string;
}

export interface HistoricalAnalysisProgress {
  batchId: string;
  status: string;
  totalEmails: number;
  processedEmails: number;
  spamDetected: number;
  importantFound: number;
  percentage: number;
  estimatedTimeRemaining?: number;
}

export interface HistoricalAnalysisResult {
  batchId: string;
  totalProcessed: number;
  spamFound: number;
  importantFound: number;
  categorized: Record<string, number>;
  processingTime: number;
}

export interface AnalysisFilters {
  dateFrom?: Date;
  dateTo?: Date;
  isSpam?: boolean;
  minImportanceScore?: number;
  category?: string;
  sender?: string;
  limit?: number;
  offset?: number;
}

export interface SpamPattern {
  pattern: string;
  confidence: number;
  description: string;
}

/**
 * Service for analyzing historical emails using local AI
 * Processes large batches of emails for spam detection, importance scoring, and categorization
 */
export class HistoricalEmailAnalysisService {
  private db: ReturnType<typeof drizzle>;
  private localAI: LocalAIService;
  private sql: postgres.Sql;
  private isInitialized: boolean = false;

  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl);
    this.db = drizzle(this.sql);
    this.localAI = new LocalAIService();
  }

  /**
   * Initialize the service and check readiness
   */
  async initialize(): Promise<boolean> {
    try {
      // Test database connection
      await this.db.select().from(emailAnalysis).limit(1);
      
      // Test AI service
      await this.localAI.initialize();
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize historical analysis service:', error);
      return false;
    }
  }

  /**
   * Initialize analysis preferences for a user
   */
  async initializePreferences(userId: string, connectionId: string): Promise<any> {
    try {
      // Check if preferences already exist
      const existing = await this.db
        .select()
        .from(emailPreferences)
        .where(eq(emailPreferences.userId, userId))
        .limit(1);

      if (existing.length > 0) {
        return existing[0];
      }

      // Create default preferences
      const defaultPrefs = {
        id: crypto.randomUUID(),
        userId,
        connectionId,
        importanceRules: [],
        spamKeywords: ['urgent', 'act now', 'limited time'],
        trustedSenders: [],
        autoDeleteSpam: false,
        autoArchiveOld: false,
        archiveDaysThreshold: 365,
        batchSize: 50,
        maxDailyProcessing: 1000,
      };

      await this.db.insert(emailPreferences).values(defaultPrefs);
      return defaultPrefs;
    } catch (error) {
      console.error('Error initializing preferences:', error);
      throw new Error('Failed to initialize analysis preferences');
    }
  }

  /**
   * Start a new historical analysis batch
   */
  async startHistoricalAnalysis(
    connectionId: string,
    userId: string,
    filters: AnalysisFilters = {}
  ): Promise<string> {
    try {
      const batchId = crypto.randomUUID();
      
      const batch = {
        id: batchId,
        connectionId,
        userId,
        status: 'pending',
        dateRangeStart: filters.dateFrom || null,
        dateRangeEnd: filters.dateTo || null,
        totalEmails: 0,
        processedEmails: 0,
        spamDetected: 0,
        importantFound: 0,
        processingStart: null,
        processingEnd: null,
        errorMessage: null,
        settings: filters,
      };

      await this.db.insert(historicalAnalysisBatch).values(batch);

      // Start processing in background
      this.processEmailBatch(batchId, connectionId, filters).catch(error => {
        console.error('Error in background processing:', error);
        this.updateBatchStatus(batchId, 'failed', String(error));
      });

      return batchId;
    } catch (error) {
      console.error('Error starting analysis batch:', error);
      throw new Error('Failed to start analysis batch');
    }
  }

  /**
   * Get analysis progress for a batch
   */
  async getAnalysisProgress(batchId: string): Promise<HistoricalAnalysisProgress | null> {
    try {
      const batch = await this.getBatchStatus(batchId);
      if (!batch) return null;

      const percentage = batch.totalEmails > 0 
        ? Math.round((batch.processedEmails / batch.totalEmails) * 100)
        : 0;

      return {
        batchId,
        status: batch.status,
        totalEmails: batch.totalEmails,
        processedEmails: batch.processedEmails,
        spamDetected: batch.spamDetected,
        importantFound: batch.importantFound,
        percentage,
        estimatedTimeRemaining: this.calculateEstimatedTime(batch),
      };
    } catch (error) {
      console.error('Error getting analysis progress:', error);
      return null;
    }
  }

  /**
   * Cancel a running analysis
   */
  async cancelAnalysis(batchId: string): Promise<boolean> {
    return this.cancelBatch(batchId);
  }

  /**
   * Get analysis results for a batch
   */
  async getAnalysisResults(batchId: string): Promise<HistoricalAnalysisResult | null> {
    try {
      const batch = await this.getBatchStatus(batchId);
      if (!batch) return null;

      // Get category distribution
      const emails = await this.getEmailAnalysisResults(batch.connectionId, { limit: 1000 });
      const categorized = emails.reduce((acc: Record<string, number>, email) => {
        const category = email.category || 'normal';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      const processingTime = batch.processingStart && batch.processingEnd 
        ? batch.processingEnd.getTime() - batch.processingStart.getTime()
        : 0;

      return {
        batchId,
        totalProcessed: batch.processedEmails,
        spamFound: batch.spamDetected,
        importantFound: batch.importantFound,
        categorized,
        processingTime,
      };
    } catch (error) {
      console.error('Error getting analysis results:', error);
      return null;
    }
  }

  /**
   * Get user analysis batches
   */
  async getUserAnalysisBatches(userId: string): Promise<HistoricalAnalysisBatch[]> {
    try {
      const results = await this.db
        .select()
        .from(historicalAnalysisBatch)
        .where(eq(historicalAnalysisBatch.userId, userId))
        .orderBy(desc(historicalAnalysisBatch.createdAt));

      return results as HistoricalAnalysisBatch[];
    } catch (error) {
      console.error('Error getting user analysis batches:', error);
      return [];
    }
  }

  /**
   * Process emails in a batch using local AI
   */
  private async processEmailBatch(
    batchId: string,
    connectionId: string,
    filters: AnalysisFilters
  ): Promise<void> {
    try {
      await this.updateBatchStatus(batchId, 'running');

      // For demo purposes, simulate processing with mock emails
      const mockEmails = this.generateMockEmails(100);
      
      await this.updateBatchProgress(batchId, mockEmails.length, 0);

      let processedCount = 0;
      let spamCount = 0;
      let importantCount = 0;

      for (const email of mockEmails) {
        try {
          const analysis = await this.analyzeEmail(email, connectionId);
          if (analysis.isSpam) spamCount++;
          if (parseFloat(analysis.importanceScore || '0') > 0.7) importantCount++;
          
          processedCount++;
          
          // Update progress every 10 emails
          if (processedCount % 10 === 0) {
            await this.updateBatchProgress(batchId, mockEmails.length, processedCount, spamCount, importantCount);
          }
        } catch (error) {
          console.error(`Error analyzing email ${email.messageId}:`, error);
        }

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await this.updateBatchProgress(batchId, mockEmails.length, processedCount, spamCount, importantCount);
      await this.updateBatchStatus(batchId, 'completed');

    } catch (error) {
      console.error('Error processing email batch:', error);
      await this.updateBatchStatus(batchId, 'failed', String(error));
    }
  }

  /**
   * Analyze a single email using local AI
   */
  private async analyzeEmail(email: any, connectionId: string): Promise<any> {
    try {
      // Check if email already analyzed
      const existing = await this.db
        .select()
        .from(emailAnalysis)
        .where(
          and(
            eq(emailAnalysis.connectionId, connectionId),
            eq(emailAnalysis.messageId, email.messageId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return existing[0];
      }

      // Simple analysis using rules + local AI
      const spamPatterns = this.detectSpamPatterns(email.content || email.subject || '', email);
      const isSpam = spamPatterns.some(p => p.confidence > 0.7);
      
      // Try AI analysis
      let aiAnalysis;
      try {
        const emailContent: EmailContent = {
          subject: email.subject || '',
          from: email.sender || '',
          body: email.content || '',
          receivedAt: new Date(email.receivedAt || Date.now()),
          isReply: false,
          hasAttachments: false,
        };
        
        aiAnalysis = await this.localAI.classifyEmailImportance(emailContent);
      } catch (error) {
        console.error('AI analysis failed, using fallback:', error);
        aiAnalysis = {
          score: 0.5,
          category: 'normal',
          reasoning: 'AI analysis unavailable',
          tags: [],
          shouldForward: false,
        };
      }

      // Save analysis results
      const analysisResult = {
        id: crypto.randomUUID(),
        connectionId,
        threadId: email.threadId || email.messageId,
        messageId: email.messageId,
        subject: email.subject || null,
        sender: email.sender || null,
        receivedAt: new Date(email.receivedAt || Date.now()),
        importanceScore: aiAnalysis.score.toString(),
        category: aiAnalysis.category,
        tags: aiAnalysis.tags,
        isSpam,
        spamConfidence: Math.max(...spamPatterns.map(p => p.confidence), 0).toString(),
        reasoning: aiAnalysis.reasoning,
      };

      await this.db.insert(emailAnalysis).values(analysisResult);
      return analysisResult;

    } catch (error) {
      console.error('Error analyzing email:', error);
      throw error;
    }
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateEstimatedTime(batch: HistoricalAnalysisBatch): number | undefined {
    if (!batch.processingStart || batch.processedEmails === 0) return undefined;

    const elapsed = Date.now() - batch.processingStart.getTime();
    const rate = batch.processedEmails / elapsed; // emails per ms
    const remaining = batch.totalEmails - batch.processedEmails;
    
    return Math.round(remaining / rate); // ms remaining
  }

  /**
   * Detect spam patterns using rule-based approach
   */
  private detectSpamPatterns(content: string, email: any): SpamPattern[] {
    const patterns: SpamPattern[] = [];
    const lowerContent = content.toLowerCase();
    const subject = (email.subject || '').toLowerCase();

    // Common spam indicators
    const spamKeywords = [
      'urgent', 'act now', 'limited time', 'exclusive offer', 'free money',
      'click here', 'unsubscribe', 'viagra', 'casino', 'lottery', 'winner',
      'congratulations', 'million dollars', 'inheritance', 'prince',
    ];

    const foundKeywords = spamKeywords.filter(keyword => 
      lowerContent.includes(keyword) || subject.includes(keyword)
    );

    if (foundKeywords.length > 0) {
      patterns.push({
        pattern: 'spam_keywords',
        confidence: Math.min(0.1 + (foundKeywords.length * 0.15), 0.9),
        description: `Contains spam keywords: ${foundKeywords.join(', ')}`,
      });
    }

    // Excessive capitalization
    const capsRatio = content.length > 0 ? (content.match(/[A-Z]/g) || []).length / content.length : 0;
    if (capsRatio > 0.3) {
      patterns.push({
        pattern: 'excessive_caps',
        confidence: 0.6,
        description: 'Excessive use of capital letters',
      });
    }

    return patterns;
  }

  /**
   * Generate mock emails for testing
   */
  private generateMockEmails(count: number): any[] {
    const emails = [];
    const subjects = [
      'Important: Meeting tomorrow',
      'URGENT: Act now to save!!!',
      'Weekly newsletter',
      'Re: Project update',
      'FREE MONEY - Click here!!!',
      'Invoice attached',
      'Lunch meeting reschedule',
      'Spam: Limited time offer',
    ];

    const senders = [
      'boss@company.com',
      'spam@suspicious.com',
      'newsletter@news.com',
      'colleague@work.com',
      'noreply@scam.com',
      'hr@company.com',
    ];

    for (let i = 0; i < count; i++) {
      emails.push({
        messageId: `msg_${crypto.randomUUID()}`,
        threadId: `thread_${crypto.randomUUID()}`,
        subject: subjects[Math.floor(Math.random() * subjects.length)],
        sender: senders[Math.floor(Math.random() * senders.length)],
        content: `Mock email content ${i}`,
        receivedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within 30 days
      });
    }

    return emails;
  }

  /**
   * Update batch status
   */
  private async updateBatchStatus(
    batchId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    const updates: any = { status };
    
    if (status === 'running') {
      updates.processingStart = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updates.processingEnd = new Date();
    }
    
    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    await this.db
      .update(historicalAnalysisBatch)
      .set(updates)
      .where(eq(historicalAnalysisBatch.id, batchId));
  }

  /**
   * Update batch progress
   */
  private async updateBatchProgress(
    batchId: string,
    totalEmails: number,
    processedEmails: number,
    spamDetected: number = 0,
    importantFound: number = 0
  ): Promise<void> {
    await this.db
      .update(historicalAnalysisBatch)
      .set({
        totalEmails,
        processedEmails,
        spamDetected,
        importantFound,
      })
      .where(eq(historicalAnalysisBatch.id, batchId));
  }

  /**
   * Get batch status and progress
   */
  async getBatchStatus(batchId: string): Promise<HistoricalAnalysisBatch | null> {
    try {
      const result = await this.db
        .select()
        .from(historicalAnalysisBatch)
        .where(eq(historicalAnalysisBatch.id, batchId))
        .limit(1);

      return result.length > 0 ? result[0] as HistoricalAnalysisBatch : null;
    } catch (error) {
      console.error('Error getting batch status:', error);
      return null;
    }
  }

  /**
   * Cancel a running batch
   */
  async cancelBatch(batchId: string): Promise<boolean> {
    try {
      await this.updateBatchStatus(batchId, 'cancelled');
      return true;
    } catch (error) {
      console.error('Error cancelling batch:', error);
      return false;
    }
  }

  /**
   * Get analysis results with filtering
   */
  async getEmailAnalysisResults(
    connectionId: string,
    filters: AnalysisFilters = {}
  ): Promise<EmailAnalysisResult[]> {
    try {
      // Build where conditions
      const conditions = [eq(emailAnalysis.connectionId, connectionId)];

      if (filters.dateFrom) {
        conditions.push(gte(emailAnalysis.receivedAt, filters.dateFrom));
      }
      if (filters.dateTo) {
        conditions.push(lte(emailAnalysis.receivedAt, filters.dateTo));
      }
      if (filters.isSpam !== undefined) {
        conditions.push(eq(emailAnalysis.isSpam, filters.isSpam));
      }
      if (filters.category) {
        conditions.push(eq(emailAnalysis.category, filters.category));
      }
      if (filters.sender) {
        conditions.push(eq(emailAnalysis.sender, filters.sender));
      }

      // Build the base query
      const baseQuery = this.db
        .select()
        .from(emailAnalysis)
        .where(and(...conditions))
        .orderBy(desc(emailAnalysis.receivedAt));
      
      // Apply pagination if specified
      const results = await (() => {
        if (filters.limit && filters.offset) {
          return baseQuery.limit(filters.limit).offset(filters.offset);
        } else if (filters.limit) {
          return baseQuery.limit(filters.limit);
        } else if (filters.offset) {
          return baseQuery.offset(filters.offset);
        } else {
          return baseQuery;
        }
      })();
      
      // Transform results to match expected interface
      return results.map(result => ({
        id: result.id,
        connectionId: result.connectionId,
        threadId: result.threadId,
        messageId: result.messageId,
        subject: result.subject || '',
        sender: result.sender || '',
        receivedAt: result.receivedAt || new Date(),
        importanceScore: result.importanceScore || '0.5',
        category: result.category || 'normal',
        tags: result.tags || [],
        isSpam: result.isSpam || false,
        spamConfidence: result.spamConfidence || '0',
        reasoning: result.reasoning || '',
        processedAt: result.processedAt,
        createdAt: result.createdAt,
      })) as EmailAnalysisResult[];
    } catch (error) {
      console.error('Error getting analysis results:', error);
      return [];
    }
  }

  /**
   * Get analysis batches for a connection
   */
  async getAnalysisBatches(connectionId: string): Promise<HistoricalAnalysisBatch[]> {
    try {
      const results = await this.db
        .select()
        .from(historicalAnalysisBatch)
        .where(eq(historicalAnalysisBatch.connectionId, connectionId))
        .orderBy(desc(historicalAnalysisBatch.createdAt));

      return results as HistoricalAnalysisBatch[];
    } catch (error) {
      console.error('Error getting analysis batches:', error);
      return [];
    }
  }

  /**
   * Delete spam emails (for cleanup)
   */
  async deleteSpamEmails(
    connectionId: string,
    options: { confidenceThreshold?: number } = {}
  ): Promise<EmailAnalysisResult[]> {
    try {
      const { confidenceThreshold = 0.9 } = options;

      // Get high-confidence spam emails
      const spamEmails = await this.db
        .select()
        .from(emailAnalysis)
        .where(
          and(
            eq(emailAnalysis.connectionId, connectionId),
            eq(emailAnalysis.isSpam, true)
          )
        );

      // Filter by confidence threshold and transform to expected interface
      const highConfidenceSpam = spamEmails
        .filter(email => parseFloat(email.spamConfidence || '0') >= confidenceThreshold)
        .map(result => ({
          id: result.id,
          connectionId: result.connectionId,
          threadId: result.threadId,
          messageId: result.messageId,
          subject: result.subject || '',
          sender: result.sender || '',
          receivedAt: result.receivedAt || new Date(),
          importanceScore: result.importanceScore || '0.5',
          category: result.category || 'normal',
          tags: result.tags || [],
          isSpam: result.isSpam || false,
          spamConfidence: result.spamConfidence || '0',
          reasoning: result.reasoning || '',
          processedAt: result.processedAt,
          createdAt: result.createdAt,
        })) as EmailAnalysisResult[];

      // TODO: Implement actual email deletion through email agent
      return highConfidenceSpam;
    } catch (error) {
      console.error('Error deleting spam emails:', error);
      return [];
    }
  }

  /**
   * Get email recommendations based on analysis
   */
  async getEmailRecommendations(connectionId: string): Promise<{
    importantUnread: EmailAnalysisResult[];
    highImportance: EmailAnalysisResult[];
    potentialSpam: EmailAnalysisResult[];
  }> {
    try {
      const [importantUnread, highImportance, potentialSpam] = await Promise.all([
        // Important unread emails
        this.getEmailAnalysisResults(connectionId, {
          isSpam: false,
          minImportanceScore: 0.7,
          limit: 10,
        }),

        // High importance emails
        this.getEmailAnalysisResults(connectionId, {
          isSpam: false,
          limit: 10,
        }),

        // Potential spam
        this.getEmailAnalysisResults(connectionId, {
          isSpam: true,
          limit: 10,
        }),
      ]);

      return {
        importantUnread,
        highImportance,
        potentialSpam,
      };
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return {
        importantUnread: [],
        highImportance: [],
        potentialSpam: [],
      };
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.sql.end();
  }
}
