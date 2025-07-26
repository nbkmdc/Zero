/**
 * Email Processing Scheduler
 * 
 * This service handles the scheduled daily processing of emails.
 * It runs once per day to identify important emails and forward them.
 */

import { EmailImportanceService, type UserPreferences } from './email-importance';
import { createDb } from '../db';
import { env } from 'cloudflare:workers';

export interface ScheduledTaskResult {
  userId: string;
  connectionId: string;
  processed: number;
  forwarded: number;
  timestamp: string;
  success: boolean;
  error?: string;
}

export class EmailScheduler {
  private importanceService: EmailImportanceService;

  constructor() {
    this.importanceService = new EmailImportanceService();
  }

  /**
   * Process all users' daily emails
   * This should be called once per day via Cloudflare Workers Cron
   */
  async processAllUsers(): Promise<ScheduledTaskResult[]> {
    console.log('Starting daily email processing for all users');
    
    try {
      // Initialize the AI service
      await this.importanceService.initialize();
      
      // Get all active connections from the database
      const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
      
      const activeConnections = await db.query.connection.findMany({
        where: (connection, { isNotNull, and }) => 
          and(
            isNotNull(connection.accessToken),
            isNotNull(connection.refreshToken)
          ),
        with: {
          user: true
        }
      });

      await conn.end();

      console.log(`Found ${activeConnections.length} active connections to process`);

      const results: ScheduledTaskResult[] = [];

      // Process each connection
      for (const connection of activeConnections) {
        try {
          const result = await this.processUserEmails(connection);
          results.push(result);
        } catch (error) {
          console.error(`Error processing emails for connection ${connection.id}:`, error);
          results.push({
            userId: connection.userId,
            connectionId: connection.id,
            processed: 0,
            forwarded: 0,
            timestamp: new Date().toISOString(),
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log(`Completed daily email processing. Results: ${JSON.stringify(results)}`);
      return results;

    } catch (error) {
      console.error('Error in daily email processing:', error);
      throw error;
    }
  }

  /**
   * Process emails for a specific user connection
   */
  private async processUserEmails(connection: any): Promise<ScheduledTaskResult> {
    console.log(`Processing emails for user ${connection.userId}, connection ${connection.id}`);

    try {
      // Get user preferences (you'll need to implement this in your database schema)
      const userPreferences = await this.getUserPreferences(connection.userId);
      
      // Check if it's time to process for this user
      if (!this.shouldProcessForUser(userPreferences)) {
        console.log(`Skipping processing for user ${connection.userId} - not time yet`);
        return {
          userId: connection.userId,
          connectionId: connection.id,
          processed: 0,
          forwarded: 0,
          timestamp: new Date().toISOString(),
          success: true,
          error: 'Skipped - not scheduled time'
        };
      }

      // Process the emails
      const processingResult = await this.importanceService.processDailyEmails(
        connection.id, 
        userPreferences
      );

      // Store the processing result in the database for tracking
      await this.storeProcessingResult(connection.userId, connection.id, processingResult);

      return {
        userId: connection.userId,
        connectionId: connection.id,
        processed: processingResult.processed,
        forwarded: processingResult.forwarded,
        timestamp: new Date().toISOString(),
        success: true
      };

    } catch (error) {
      console.error(`Error processing emails for connection ${connection.id}:`, error);
      return {
        userId: connection.userId,
        connectionId: connection.id,
        processed: 0,
        forwarded: 0,
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user preferences for email processing
   * TODO: Implement user preferences storage in database
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    // For now, return default preferences
    // In a full implementation, you'd fetch this from the database
    return {
      importanceRules: [
        {
          id: 'urgent-boss',
          name: 'Messages from Boss',
          condition: {
            sender: ['boss@company.com', 'manager@company.com'],
          },
          importance: 'urgent',
          autoForward: true
        },
        {
          id: 'important-clients',
          name: 'Client Communications',
          condition: {
            keywords: ['client', 'urgent', 'meeting', 'deadline'],
          },
          importance: 'important',
          autoForward: true
        },
        {
          id: 'low-newsletters',
          name: 'Newsletters',
          condition: {
            keywords: ['newsletter', 'unsubscribe', 'marketing'],
          },
          importance: 'low',
          autoForward: false
        }
      ],
      forwardingEmail: await this.getUserForwardingEmail(userId), // Retrieve user's phone email from database
      dailyProcessingTime: '08:00', // 8 AM
      importanceThreshold: 0.7, // Forward emails with importance >= 0.7
      maxDailyForwards: 10 // Maximum 10 emails per day
    };
  }

  /**
   * Check if it's time to process emails for this user
   */
  private shouldProcessForUser(preferences: UserPreferences): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // For now, process if current time is within 1 hour of the user's preferred time
    const [prefHour, prefMinute] = preferences.dailyProcessingTime.split(':').map(Number);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Process if we're within 1 hour of the preferred time
    const preferredTimeInMinutes = prefHour * 60 + prefMinute;
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const timeDifference = Math.abs(currentTimeInMinutes - preferredTimeInMinutes);
    
    return timeDifference <= 60; // Within 1 hour
  }

  /**
   * Store processing result in database for tracking
   * TODO: Create a processing_logs table in your database schema
   */
  private async storeProcessingResult(
    userId: string, 
    connectionId: string, 
    result: any
  ): Promise<void> {
    try {
      // This would store the processing result in a database table
      // For now, just log it
      console.log(`Processing result for user ${userId}:`, {
        connectionId,
        processed: result.processed,
        forwarded: result.forwarded,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error storing processing result:', error);
    }
  }

  /**
   * Get processing statistics for a user
   */
  async getUserProcessingStats(userId: string, days: number = 7): Promise<{
    totalProcessed: number;
    totalForwarded: number;
    averagePerDay: number;
    lastProcessed?: string;
  }> {
    // TODO: Implement database query to get user's processing history
    return {
      totalProcessed: 0,
      totalForwarded: 0,
      averagePerDay: 0,
      lastProcessed: undefined
    };
  }
}
