/**
 * Local AI Service for Email Processing
 * 
 * This service provides local AI inference capabilities for:
 * 1. Email importance classification
 * 2. Content analysis
 * 3. Intent detection
 * 
 * Hardware Requirements:
 * - RTX 3080 (10GB VRAM) - Sufficient for models up to 13B parameters
 * - 128GB RAM - Can handle large models and batching
 * - Ryzen 5 CPU - Good for preprocessing
 * 
 * Recommended Models:
 * - Classification: Llama-3.2-3B-Instruct (fits in VRAM)
 * - Analysis: Llama-3.1-8B-Instruct (good balance of speed/quality)
 * - Fallback: Phi-3.5-mini-instruct (very fast, lower quality)
 */

import { z } from 'zod';

// Email importance classification schema
export const EmailImportanceSchema = z.object({
  score: z.number().min(0).max(1).describe('Importance score from 0 (not important) to 1 (very important)'),
  category: z.enum(['urgent', 'important', 'normal', 'low', 'spam']),
  reasoning: z.string().describe('Brief explanation of the importance assessment'),
  tags: z.array(z.string()).describe('Relevant tags for categorization'),
  shouldForward: z.boolean().describe('Whether this email should be forwarded to phone'),
});

export type EmailImportance = z.infer<typeof EmailImportanceSchema>;

// Email content for analysis
export interface EmailContent {
  subject: string;
  from: string;
  body: string;
  receivedAt: Date;
  isReply: boolean;
  hasAttachments: boolean;
}

export class LocalAIService {
  private modelEndpoint: string;
  private modelName: string;
  private isInitialized: boolean = false;

  constructor(
    modelEndpoint: string = 'http://localhost:11434',
    modelName: string = process.env.LOCAL_AI_MODEL_NAME || 'llama3.2:3b'
  ) {
    this.modelEndpoint = modelEndpoint;
    this.modelName = modelName;
  }

  /**
   * Initialize the local AI service
   * This will check if the local model server is running
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if Ollama or similar local inference server is running
      const response = await fetch(`${this.modelEndpoint}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        this.isInitialized = true;
        console.log('Local AI service initialized successfully');
        return true;
      }
    } catch (error) {
      console.warn('Local AI service not available, falling back to cloud AI:', error);
    }
    
    this.isInitialized = false;
    return false;
  }

  /**
   * Classify email importance using local AI model
   */
  async classifyEmailImportance(email: EmailContent, userPreferences?: any): Promise<EmailImportance> {
    if (!this.isInitialized) {
      throw new Error('Local AI service not initialized');
    }

    const prompt = this.buildImportancePrompt(email, userPreferences);
    
    try {
      const response = await fetch(`${this.modelEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName, // Configurable model name
          prompt,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.1, // Low temperature for consistent classification
            top_p: 0.9,
            max_tokens: 200
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Local AI request failed: ${response.statusText}`);
      }

      const result = await response.json() as { response: string };
      const classification = JSON.parse(result.response);
      
      // Validate the response against our schema
      return EmailImportanceSchema.parse(classification);
    } catch (error) {
      console.error('Error classifying email importance:', error);
      // Fallback to simple rule-based classification
      return this.fallbackClassification(email);
    }
  }

  /**
   * Batch process multiple emails for importance classification
   * Useful for daily email processing
   */
  async batchClassifyEmails(emails: EmailContent[], userPreferences?: any): Promise<EmailImportance[]> {
    const results: EmailImportance[] = [];
    
    // Process in batches to avoid overwhelming the GPU
    const batchSize = 5;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchPromises = batch.map(email => 
        this.classifyEmailImportance(email, userPreferences)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Batch classification error:', result.reason);
          // Add fallback result
          results.push(this.fallbackClassification(batch[results.length % batch.length]));
        }
      }
      
      // Small delay between batches to prevent overload
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Build prompt for email importance classification
   */
  private buildImportancePrompt(email: EmailContent, userPreferences?: any): string {
    return `You are an AI assistant that classifies email importance for busy professionals.

Analyze the following email and classify its importance:

Subject: ${email.subject}
From: ${email.from}
Body: ${email.body.substring(0, 500)}${email.body.length > 500 ? '...' : ''}
Received: ${email.receivedAt.toISOString()}
Is Reply: ${email.isReply}
Has Attachments: ${email.hasAttachments}

${userPreferences ? `User Preferences: ${JSON.stringify(userPreferences)}` : ''}

Classification Guidelines:
- URGENT (0.9-1.0): Time-sensitive, requires immediate action, from boss/important contacts
- IMPORTANT (0.7-0.9): Requires action within 24 hours, work-related, personal important
- NORMAL (0.4-0.7): Regular correspondence, can wait 1-3 days
- LOW (0.1-0.4): Newsletters, promotions, non-critical updates
- SPAM (0.0-0.1): Obvious spam, phishing, irrelevant content

shouldForward should be true only for URGENT and IMPORTANT emails that require daily attention.

Respond with valid JSON matching this schema:
{
  "score": number,
  "category": "urgent" | "important" | "normal" | "low" | "spam",
  "reasoning": "string",
  "tags": ["string"],
  "shouldForward": boolean
}`;
  }

  /**
   * Fallback classification when local AI fails
   */
  private fallbackClassification(email: EmailContent): EmailImportance {
    let score = 0.5;
    let category: EmailImportance['category'] = 'normal';
    const tags: string[] = [];
    
    // Simple rule-based scoring
    const subject = email.subject.toLowerCase();
    const from = email.from.toLowerCase();
    const body = email.body.toLowerCase();
    
    // Urgent indicators
    if (subject.includes('urgent') || subject.includes('asap') || subject.includes('immediate')) {
      score = 0.9;
      category = 'urgent';
      tags.push('urgent');
    }
    
    // Important indicators
    else if (subject.includes('important') || subject.includes('action required') || 
             from.includes('boss') || from.includes('manager')) {
      score = 0.8;
      category = 'important';
      tags.push('important');
    }
    
    // Spam indicators
    else if (subject.includes('prize') || subject.includes('winner') || 
             body.includes('click here') || body.includes('free money')) {
      score = 0.1;
      category = 'spam';
      tags.push('spam');
    }
    
    // Low priority indicators
    else if (subject.includes('newsletter') || subject.includes('unsubscribe') ||
             from.includes('noreply') || from.includes('newsletter')) {
      score = 0.2;
      category = 'low';
      tags.push('newsletter');
    }
    
    return {
      score,
      category,
      reasoning: 'Rule-based fallback classification',
      tags,
      shouldForward: score >= 0.7
    };
  }

  /**
   * Get model status and performance metrics
   */
  async getModelStatus(): Promise<{
    isAvailable: boolean;
    models: string[];
    memoryUsage?: number;
    gpuUsage?: number;
  }> {
    if (!this.isInitialized) {
      return { isAvailable: false, models: [] };
    }

    try {
      const response = await fetch(`${this.modelEndpoint}/api/tags`);
      const data = await response.json() as { models?: { name: string }[] };
      
      return {
        isAvailable: true,
        models: data.models?.map((m) => m.name) || [],
      };
    } catch (error) {
      return { isAvailable: false, models: [] };
    }
  }
}
