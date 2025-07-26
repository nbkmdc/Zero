/**
 * API Routes for Historical Email Analysis
 * 
 * These routes provide endpoints to manage and monitor
 * historical email analysis batches and results.
 */

import { z } from 'zod';
import { Hono } from 'hono';
import { 
  HistoricalEmailAnalysisService,
  type HistoricalAnalysisSettings,
  type HistoricalAnalysisProgress,
  type HistoricalAnalysisResult
} from '../lib/historical-email-analysis';

// Type for email analysis result (matching the database schema)
type EmailAnalysisResult = {
  id: string;
  connectionId: string;
  messageId: string;
  threadId: string;
  subject: string | null;
  sender: string | null;
  receivedAt: Date | null;
  importanceScore: number;
  category: string | null;
  tags: string[] | null;
  isSpam: boolean;
  spamConfidence: string;
  reasoning: string | null;
  processedAt: Date;
  createdAt: Date;
};

const app = new Hono<{ 
  Bindings: { DATABASE_URL: string };
  Variables: { userId?: string; connectionId?: string };
}>();

// Schema for historical analysis settings
const analysisSettingsSchema = z.object({
  dateRangeStart: z.string().datetime().optional(),
  dateRangeEnd: z.string().datetime().optional(),
  batchSize: z.number().min(10).max(100).default(50),
  maxEmails: z.number().min(100).max(10000).optional(),
  deleteSpamAfterAnalysis: z.boolean().default(false),
  archiveOldAfterAnalysis: z.boolean().default(false),
  onlyUnreadEmails: z.boolean().default(true),
  includeFolders: z.array(z.string()).default(['INBOX']),
  spamConfidenceThreshold: z.number().min(0).max(1).default(0.8),
  importanceThreshold: z.number().min(0).max(1).default(0.7),
});

// Schema for analysis filters
const analysisFiltersSchema = z.object({
  isSpam: z.boolean().optional(),
  category: z.enum(['urgent', 'important', 'normal', 'low', 'spam']).optional(),
  minImportanceScore: z.number().min(0).max(1).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.number().min(1).max(1000).default(100),
});

/**
 * POST /initialize
 * Initialize the historical analysis service
 */
app.post('/initialize', async (c) => {
  try {
    const databaseUrl = c.env.DATABASE_URL;
    const service = new HistoricalEmailAnalysisService(databaseUrl);
    
    const isInitialized = await service.initialize();
    
    return c.json({
      success: isInitialized,
      message: isInitialized 
        ? 'Historical analysis service initialized successfully'
        : 'Failed to initialize local AI service. Check if Ollama is running.',
    });
  } catch (error) {
    console.error('Error initializing historical analysis service:', error);
    return c.json({
      success: false,
      message: 'Failed to initialize service',
      error: String(error),
    }, 500);
  }
});

/**
 * POST /start
 * Start historical email analysis for a connection
 */
app.post('/start', async (c) => {
  try {
    const userId = c.get('userId');
    const connectionId = c.get('connectionId');
    
    if (!userId || !connectionId) {
      return c.json({
        success: false,
        message: 'Missing user ID or connection ID',
      }, 400);
    }

    const body = await c.req.json();
    const settings = analysisSettingsSchema.parse(body);
    
    // Convert string dates to Date objects and create analysis filters
    const analysisFilters = {
      dateFrom: settings.dateRangeStart ? new Date(settings.dateRangeStart) : undefined,
      dateTo: settings.dateRangeEnd ? new Date(settings.dateRangeEnd) : undefined,
      limit: settings.batchSize || 1000,
    };

    const databaseUrl = c.env.DATABASE_URL;
    const service = new HistoricalEmailAnalysisService(databaseUrl);
    
    const batchId = await service.startHistoricalAnalysis(
      connectionId,
      userId,
      analysisFilters
    );

    return c.json({
      success: true,
      batchId,
      message: 'Historical analysis started successfully',
    });
  } catch (error) {
    console.error('Error starting historical analysis:', error);
    return c.json({
      success: false,
      message: 'Failed to start historical analysis',
      error: String(error),
    }, 500);
  }
});

/**
 * GET /progress/:batchId
 * Get progress of a historical analysis batch
 */
app.get('/progress/:batchId', async (c) => {
  try {
    const { batchId } = c.req.param();
    
    const databaseUrl = c.env.DATABASE_URL;
    const service = new HistoricalEmailAnalysisService(databaseUrl);
    
    const progress = await service.getAnalysisProgress(batchId);
    
    if (!progress) {
      return c.json({
        success: false,
        message: 'Analysis batch not found',
      }, 404);
    }

    return c.json({
      success: true,
      progress,
    });
  } catch (error) {
    console.error('Error getting analysis progress:', error);
    return c.json({
      success: false,
      message: 'Failed to get analysis progress',
      error: String(error),
    }, 500);
  }
});

/**
 * POST /cancel/:batchId
 * Cancel a running historical analysis
 */
app.post('/cancel/:batchId', async (c) => {
  try {
    const { batchId } = c.req.param();
    
    const databaseUrl = c.env.DATABASE_URL;
    const service = new HistoricalEmailAnalysisService(databaseUrl);
    
    const cancelled = await service.cancelAnalysis(batchId);
    
    return c.json({
      success: cancelled,
      message: cancelled 
        ? 'Analysis cancelled successfully'
        : 'Failed to cancel analysis',
    });
  } catch (error) {
    console.error('Error cancelling analysis:', error);
    return c.json({
      success: false,
      message: 'Failed to cancel analysis',
      error: String(error),
    }, 500);
  }
});

/**
 * GET /results/:batchId
 * Get results of a completed historical analysis
 */
app.get('/results/:batchId', async (c) => {
  try {
    const { batchId } = c.req.param();
    
    const databaseUrl = c.env.DATABASE_URL;
    const service = new HistoricalEmailAnalysisService(databaseUrl);
    
    const results = await service.getAnalysisResults(batchId);
    
    if (!results) {
      return c.json({
        success: false,
        message: 'Analysis results not found or not completed yet',
      }, 404);
    }

    return c.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error getting analysis results:', error);
    return c.json({
      success: false,
      message: 'Failed to get analysis results',
      error: String(error),
    }, 500);
  }
});

/**
 * GET /batches
 * Get all analysis batches for the current user
 */
app.get('/batches', async (c) => {
  try {
    const userId = c.get('userId');
    
    if (!userId) {
      return c.json({
        success: false,
        message: 'Missing user ID',
      }, 400);
    }

    const databaseUrl = c.env.DATABASE_URL;
    const service = new HistoricalEmailAnalysisService(databaseUrl);
    
    const batches = await service.getUserAnalysisBatches(userId);

    return c.json({
      success: true,
      batches,
    });
  } catch (error) {
    console.error('Error getting user analysis batches:', error);
    return c.json({
      success: false,
      message: 'Failed to get analysis batches',
      error: String(error),
    }, 500);
  }
});

/**
 * GET /emails
 * Get email analysis results with filters
 */
app.get('/emails', async (c) => {
  try {
    const connectionId = c.get('connectionId');
    
    if (!connectionId) {
      return c.json({
        success: false,
        message: 'Missing connection ID',
      }, 400);
    }

    const query = c.req.query();
    const filters = analysisFiltersSchema.parse({
      isSpam: query.isSpam === 'true' ? true : query.isSpam === 'false' ? false : undefined,
      category: query.category,
      minImportanceScore: query.minImportanceScore ? parseFloat(query.minImportanceScore) : undefined,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      limit: query.limit ? parseInt(query.limit) : 100,
    });

    const databaseUrl = c.env.DATABASE_URL;
    const service = new HistoricalEmailAnalysisService(databaseUrl);
    
    const emails = await service.getEmailAnalysisResults(connectionId, {
      ...filters,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
    });

    return c.json({
      success: true,
      emails,
      count: emails.length,
    });
  } catch (error) {
    console.error('Error getting email analysis results:', error);
    return c.json({
      success: false,
      message: 'Failed to get email analysis results',
      error: String(error),
    }, 500);
  }
});

/**
 * GET /stats
 * Get overall statistics for the connection
 */
app.get('/stats', async (c) => {
  try {
    const connectionId = c.get('connectionId');
    
    if (!connectionId) {
      return c.json({
        success: false,
        message: 'Missing connection ID',
      }, 400);
    }

    const databaseUrl = c.env.DATABASE_URL;
    const service = new HistoricalEmailAnalysisService(databaseUrl);
    
    // Get overall stats
    const allEmails = await service.getEmailAnalysisResults(connectionId, { limit: 10000 });
    const spamEmails = await service.getEmailAnalysisResults(connectionId, { isSpam: true, limit: 10000 });
    const importantEmails = await service.getEmailAnalysisResults(connectionId, { minImportanceScore: 0.7, limit: 10000 });
    
    // Calculate category distribution
    const categories = allEmails.reduce((acc: Record<string, number>, email: EmailAnalysisResult) => {
      const category = email.category || 'normal';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate sender stats
    const senderStats = allEmails.reduce((acc: Record<string, { total: number; spam: number; important: number }>, email: EmailAnalysisResult) => {
      const sender = email.sender || 'unknown';
      if (!acc[sender]) {
        acc[sender] = { total: 0, spam: 0, important: 0 };
      }
      acc[sender].total++;
      if (email.isSpam) acc[sender].spam++;
      if (parseFloat(email.importanceScore || '0.5') > 0.7) acc[sender].important++;
      return acc;
    }, {} as Record<string, { total: number; spam: number; important: number }>);

    // Get top spam senders
    const topSpamSenders = Object.entries(senderStats)
      .filter(([_, stats]) => (stats as { total: number; spam: number; important: number }).spam > 0)
      .sort(([_, a], [__, b]) => (b as any).spam - (a as any).spam)
      .slice(0, 10)
      .map(([sender, stats]) => ({ 
        sender, 
        spamCount: (stats as { total: number; spam: number; important: number }).spam, 
        totalCount: (stats as { total: number; spam: number; important: number }).total 
      }));

    // Get top important senders
    const topImportantSenders = Object.entries(senderStats)
      .filter(([_, stats]) => (stats as { total: number; spam: number; important: number }).important > 0)
      .sort(([_, a], [__, b]) => (b as any).important - (a as any).important)
      .slice(0, 10)
      .map(([sender, stats]) => ({ 
        sender, 
        importantCount: (stats as { total: number; spam: number; important: number }).important, 
        totalCount: (stats as { total: number; spam: number; important: number }).total 
      }));

    return c.json({
      success: true,
      stats: {
        totalEmails: allEmails.length,
        spamEmails: spamEmails.length,
        importantEmails: importantEmails.length,
        spamPercentage: allEmails.length > 0 ? (spamEmails.length / allEmails.length) * 100 : 0,
        importantPercentage: allEmails.length > 0 ? (importantEmails.length / allEmails.length) * 100 : 0,
        categories,
        topSpamSenders,
        topImportantSenders,
      },
    });
  } catch (error) {
    console.error('Error getting analysis stats:', error);
    return c.json({
      success: false,
      message: 'Failed to get analysis stats',
      error: String(error),
    }, 500);
  }
});

/**
 * DELETE /cleanup
 * Delete all spam emails that were identified by the analysis
 */
app.delete('/cleanup', async (c) => {
  try {
    const connectionId = c.get('connectionId');
    
    if (!connectionId) {
      return c.json({
        success: false,
        message: 'Missing connection ID',
      }, 400);
    }

    const body = await c.req.json();
    const { confirmDelete = false, spamConfidenceThreshold = 0.9 } = body;
    
    if (!confirmDelete) {
      return c.json({
        success: false,
        message: 'Confirmation required for spam cleanup',
      }, 400);
    }

    const databaseUrl = c.env.DATABASE_URL;
    const service = new HistoricalEmailAnalysisService(databaseUrl);
    
    // Get high-confidence spam emails
    const spamEmails = await service.getEmailAnalysisResults(connectionId, {
      isSpam: true,
      limit: 1000,
    }).then((emails: EmailAnalysisResult[]) => 
      emails.filter((email: EmailAnalysisResult) => parseFloat(email.spamConfidence || '0') >= spamConfidenceThreshold)
    );

    // TODO: Implement actual email deletion through the agent
    // This would require integrating with the email agent to delete threads
    
    return c.json({
      success: true,
      message: `Identified ${spamEmails.length} spam emails for cleanup`,
      spamEmailsFound: spamEmails.length,
      note: 'Actual deletion not implemented yet - this is a preview',
    });
  } catch (error) {
    console.error('Error during spam cleanup:', error);
    return c.json({
      success: false,
      message: 'Failed to cleanup spam emails',
      error: String(error),
    }, 500);
  }
});

export default app;
