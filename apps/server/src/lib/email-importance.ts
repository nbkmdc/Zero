/**
 * Email Importance Analysis Service
 * 
 * This service extends the existing email processing workflow to add
 * importance classification and automated forwarding capabilities.
 */

import { LocalAIService, type EmailContent, type EmailImportance } from './local-ai';
import type { ParsedMessage } from '../types';
import type { IGetThreadsResponse } from './driver/types';
import { getZeroAgent } from './server-utils';

export interface ImportanceRule {
  id: string;
  name: string;
  condition: {
    sender?: string[];
    subject?: string[];
    keywords?: string[];
    hasAttachments?: boolean;
  };
  importance: 'urgent' | 'important' | 'normal' | 'low';
  autoForward: boolean;
}

export interface UserPreferences {
  importanceRules: ImportanceRule[];
  forwardingEmail: string;
  dailyProcessingTime: string; // HH:MM format
  importanceThreshold: number; // 0-1, threshold for forwarding
  maxDailyForwards: number;
}

export class EmailImportanceService {
  private localAI: LocalAIService;
  
  constructor(modelEndpoint?: string) {
    this.localAI = new LocalAIService(modelEndpoint);
  }

  async initialize(): Promise<boolean> {
    return await this.localAI.initialize();
  }

  /**
   * Process daily emails for a user's connection
   */
  async processDailyEmails(
    connectionId: string, 
    userPreferences: UserPreferences
  ): Promise<{
    processed: number;
    forwarded: number;
    important: ParsedMessage[];
    summary: string;
  }> {
    try {
      console.log(`Starting daily email processing for connection: ${connectionId}`);
      
      // Get the user's email agent
      const agent = await getZeroAgent(connectionId);
      
      // Get emails from the last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const query = `after:${yesterday.toISOString().split('T')[0]}`;
      const emailThreads: IGetThreadsResponse = await agent.rawListThreads({
        folder: 'INBOX',
        query,
        maxResults: 50 // Limit to prevent overload
      });

      console.log(`Found ${emailThreads.threads.length} email threads to process`);

      const importantEmails: ParsedMessage[] = [];
      let processedCount = 0;
      let forwardedCount = 0;

      // Process each thread
      for (const thread of emailThreads.threads) {
        try {
          const threadData = await agent.getThread(thread.id);
          const latestMessage = threadData.latest;
          
          if (!latestMessage) continue;

          // Convert to EmailContent format for AI analysis
          const emailContent: EmailContent = {
            subject: latestMessage.subject || '',
            from: latestMessage.sender?.email || '',
            body: latestMessage.body || '',
            receivedAt: new Date(latestMessage.receivedOn || Date.now()),
            isReply: (latestMessage.subject || '').toLowerCase().startsWith('re:'),
            hasAttachments: (latestMessage.attachments?.length || 0) > 0
          };

          // Classify importance
          const importance = await this.classifyEmailImportance(emailContent, userPreferences);
          
          processedCount++;
          
          // Check if email should be forwarded
          if (importance.shouldForward && 
              importance.score >= userPreferences.importanceThreshold &&
              forwardedCount < userPreferences.maxDailyForwards) {
            
            importantEmails.push(latestMessage);
            
            // Forward the email
            await this.forwardEmail(latestMessage, userPreferences.forwardingEmail, importance, agent);
            forwardedCount++;
          }

          console.log(`Processed email: ${emailContent.subject} - Importance: ${importance.category} (${importance.score})`);
          
        } catch (error) {
          console.error(`Error processing thread ${thread.id}:`, error);
        }
      }

      // Generate daily summary
      const summary = this.generateDailySummary(processedCount, forwardedCount, importantEmails);

      return {
        processed: processedCount,
        forwarded: forwardedCount,
        important: importantEmails,
        summary
      };

    } catch (error) {
      console.error('Error in daily email processing:', error);
      throw error;
    }
  }

  /**
   * Classify email importance using AI + rules
   */
  async classifyEmailImportance(
    email: EmailContent, 
    userPreferences: UserPreferences
  ): Promise<EmailImportance> {
    // First, check user-defined rules
    const ruleBasedImportance = this.applyImportanceRules(email, userPreferences.importanceRules);
    
    if (ruleBasedImportance) {
      return ruleBasedImportance;
    }

    // Fallback to AI classification
    try {
      return await this.localAI.classifyEmailImportance(email, userPreferences);
    } catch (error) {
      console.error('AI classification failed, using fallback:', error);
      // This will use the fallback method in LocalAIService
      throw error;
    }
  }

  /**
   * Apply user-defined importance rules
   */
  private applyImportanceRules(
    email: EmailContent, 
    rules: ImportanceRule[]
  ): EmailImportance | null {
    for (const rule of rules) {
      let matches = true;

      // Check sender condition
      if (rule.condition.sender && rule.condition.sender.length > 0) {
        matches = matches && rule.condition.sender.some(sender => 
          email.from.toLowerCase().includes(sender.toLowerCase())
        );
      }

      // Check subject condition
      if (rule.condition.subject && rule.condition.subject.length > 0) {
        matches = matches && rule.condition.subject.some(subject => 
          email.subject.toLowerCase().includes(subject.toLowerCase())
        );
      }

      // Check keywords condition
      if (rule.condition.keywords && rule.condition.keywords.length > 0) {
        const content = `${email.subject} ${email.body}`.toLowerCase();
        matches = matches && rule.condition.keywords.some(keyword => 
          content.includes(keyword.toLowerCase())
        );
      }

      // Check attachments condition
      if (rule.condition.hasAttachments !== undefined) {
        matches = matches && (email.hasAttachments === rule.condition.hasAttachments);
      }

      // If rule matches, return the importance
      if (matches) {
        const importanceScores = {
          urgent: 0.95,
          important: 0.8,
          normal: 0.5,
          low: 0.2
        };

        return {
          score: importanceScores[rule.importance],
          category: rule.importance,
          reasoning: `Matched user rule: ${rule.name}`,
          tags: ['user-rule', rule.name],
          shouldForward: rule.autoForward
        };
      }
    }

    return null;
  }

  /**
   * Forward important email to user's phone
   */
  private async forwardEmail(
    message: ParsedMessage,
    forwardingEmail: string,
    importance: EmailImportance,
    agent: any
  ): Promise<void> {
    try {
      const forwardSubject = `[IMPORTANT] ${message.subject}`;
      const forwardBody = `
🚨 Important Email Alert

📧 From: ${message.sender?.email || 'Unknown'}
📅 Received: ${new Date(message.receivedOn || Date.now()).toLocaleString()}
⭐ Importance: ${importance.category.toUpperCase()} (${Math.round(importance.score * 100)}%)
🤖 Reason: ${importance.reasoning}

--- Original Message ---
${message.body?.substring(0, 1000)}${(message.body?.length || 0) > 1000 ? '...\n\n[Message truncated]' : ''}

📱 Forwarded by Zero Email AI Assistant
      `.trim();

      await agent.create({
        to: [{ email: forwardingEmail, name: 'Mobile Device' }],
        subject: forwardSubject,
        message: forwardBody,
        attachments: [], // Don't forward attachments to phone
        headers: {
          'X-Zero-Forward': 'true',
          'X-Zero-Importance': importance.category,
          'X-Zero-Score': importance.score.toString()
        }
      });

      console.log(`Forwarded email to ${forwardingEmail}: ${message.subject}`);
    } catch (error) {
      console.error('Error forwarding email:', error);
      throw error;
    }
  }

  /**
   * Generate daily summary of processed emails
   */
  private generateDailySummary(
    processed: number,
    forwarded: number,
    importantEmails: ParsedMessage[]
  ): string {
    const date = new Date().toLocaleDateString();
    
    let summary = `📊 Daily Email Summary - ${date}\n\n`;
    summary += `📧 Processed: ${processed} emails\n`;
    summary += `📱 Forwarded: ${forwarded} important emails\n\n`;
    
    if (importantEmails.length > 0) {
      summary += `🔥 Today's Important Emails:\n`;
      importantEmails.slice(0, 5).forEach((email, index) => {
        summary += `${index + 1}. ${email.subject} (from: ${email.sender?.email})\n`;
      });
      
      if (importantEmails.length > 5) {
        summary += `... and ${importantEmails.length - 5} more important emails\n`;
      }
    } else {
      summary += `✅ No urgent emails today - you're all caught up!\n`;
    }
    
    summary += `\n🤖 Powered by Zero Email AI Assistant`;
    
    return summary;
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    localAI: boolean;
    modelInfo: any;
  }> {
    const modelStatus = await this.localAI.getModelStatus();
    
    return {
      localAI: modelStatus.isAvailable,
      modelInfo: modelStatus
    };
  }
}
