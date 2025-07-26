/**
 * Email Processing Routes
 * 
 * API endpoints for managing the local AI email processing system
 */

import { Hono } from 'hono';
import { EmailImportanceService } from '../lib/email-importance';
import { EmailScheduler } from '../lib/email-scheduler';
import { LocalAIService } from '../lib/local-ai';
import { env } from 'cloudflare:workers';
import { z } from 'zod';

export const emailProcessingRouter = new Hono();

// Initialize services
const localAI = new LocalAIService();
const importanceService = new EmailImportanceService();
const scheduler = new EmailScheduler();

// Schema for email classification request
const ClassifyEmailSchema = z.object({
  subject: z.string(),
  from: z.string(),
  body: z.string(),
  receivedAt: z.string().optional(),
  isReply: z.boolean().optional(),
  hasAttachments: z.boolean().optional(),
});

// Schema for manual processing request
const ProcessEmailsSchema = z.object({
  connectionId: z.string(),
  dryRun: z.boolean().optional().default(false),
});

/**
 * Get status of local AI service
 */
emailProcessingRouter.get('/status', async (c) => {
  try {
    const [importanceStatus, localAIStatus] = await Promise.all([
      importanceService.getStatus(),
      localAI.getModelStatus()
    ]);

    return c.json({
      success: true,
      status: {
        localAI: importanceStatus.localAI,
        models: localAIStatus.models,
        isAvailable: localAIStatus.isAvailable,
        lastChecked: new Date().toISOString()
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Initialize local AI service
 */
emailProcessingRouter.post('/initialize', async (c) => {
  try {
    const initialized = await localAI.initialize();
    
    return c.json({
      success: initialized,
      message: initialized 
        ? 'Local AI service initialized successfully' 
        : 'Local AI service not available, will use fallback classification'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize'
    }, 500);
  }
});

/**
 * Classify a single email's importance
 */
emailProcessingRouter.post('/classify', async (c) => {
  try {
    const body = await c.req.json();
    const { success, data } = ClassifyEmailSchema.safeParse(body);
    
    if (!success) {
      return c.json({
        success: false,
        error: 'Invalid email data provided'
      }, 400);
    }

    const emailContent = {
      subject: data.subject,
      from: data.from,
      body: data.body,
      receivedAt: data.receivedAt ? new Date(data.receivedAt) : new Date(),
      isReply: data.isReply || false,
      hasAttachments: data.hasAttachments || false
    };

    const classification = await localAI.classifyEmailImportance(emailContent);
    
    return c.json({
      success: true,
      classification
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Classification failed'
    }, 500);
  }
});

/**
 * Process daily emails for a specific connection
 */
emailProcessingRouter.post('/process', async (c) => {
  try {
    const body = await c.req.json();
    const { success, data } = ProcessEmailsSchema.safeParse(body);
    
    if (!success) {
      return c.json({
        success: false,
        error: 'Invalid request data'
      }, 400);
    }

    // Initialize services if not already done
    await importanceService.initialize();

    // Get default user preferences (in a real implementation, fetch from DB)
    const userPreferences = {
      importanceRules: [],
      forwardingEmail: 'user@phone.com', // This should come from user settings
      dailyProcessingTime: '08:00',
      importanceThreshold: 0.7,
      maxDailyForwards: 10
    };

    const result = await importanceService.processDailyEmails(
      data.connectionId,
      userPreferences
    );

    return c.json({
      success: true,
      result: {
        processed: result.processed,
        forwarded: result.forwarded,
        summary: result.summary,
        important: data.dryRun ? result.important : undefined // Only return emails in dry run
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed'
    }, 500);
  }
});

/**
 * Trigger scheduled processing for all users (admin endpoint)
 */
emailProcessingRouter.post('/schedule/trigger', async (c) => {
  try {
    // Check for admin authorization
    const authHeader = c.req.header('X-Admin-Key');
    if (authHeader !== env.AUTUMN_SECRET_KEY) { // Using existing secret for now
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const results = await scheduler.processAllUsers();
    
    return c.json({
      success: true,
      results,
      summary: {
        totalUsers: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        totalProcessed: results.reduce((sum, r) => sum + r.processed, 0),
        totalForwarded: results.reduce((sum, r) => sum + r.forwarded, 0)
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Scheduled processing failed'
    }, 500);
  }
});

/**
 * Get user's processing statistics
 */
emailProcessingRouter.get('/stats/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const days = parseInt(c.req.query('days') || '7');
    
    const stats = await scheduler.getUserProcessingStats(userId, days);
    
    return c.json({
      success: true,
      stats
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get statistics'
    }, 500);
  }
});

/**
 * Test local AI connection
 */
emailProcessingRouter.get('/test', async (c) => {
  try {
    const testEmail = {
      subject: 'Urgent: Client Meeting Tomorrow',
      from: 'boss@company.com',
      body: 'We need to prepare for the important client meeting tomorrow at 9 AM. Please review the proposal.',
      receivedAt: new Date(),
      isReply: false,
      hasAttachments: false
    };

    await localAI.initialize();
    const classification = await localAI.classifyEmailImportance(testEmail);
    
    return c.json({
      success: true,
      test: {
        email: testEmail,
        classification
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed',
      fallback: 'Local AI not available, using rule-based fallback'
    });
  }
});

// Export the router
export default emailProcessingRouter;
