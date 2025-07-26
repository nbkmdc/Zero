import type { 
  IGetThreadResponse, 
  MailManager, 
  ManagerConfig, 
  IGetThreadsResponse 
} from '../types';
import type { IOutgoingMessage, ParsedMessage, Label, DeleteAllSpamResponse } from '../../../types';
import type { CreateDraftData } from '../../schemas';
import type { ParsedDraft } from './types';
import { parseAddressList, parseFrom } from '../../email-utils';
import { StandardizedError } from '../utils';
import * as he from 'he';

// Import modular components
import { ImapConnection, SmtpConnection } from './connections';
import { MessageParser } from './message-parser';
import { AttachmentHandler } from './attachment-handler';
import { SearchUtils } from './search-utils';
import { LabelManager } from './label-manager';
import { DraftManager, SpamManager } from './draft-spam-manager';
import { EmailSender } from './email-sender';
import { 
  ICLOUD_IMAP_CONFIG, 
  ICLOUD_SMTP_CONFIG, 
  ICLOUD_FOLDER_MAP 
} from './types';

/**
 * iCloud Mail Manager
 * 
 * This implementation provides email management for iCloud accounts.
 * It uses IMAP/SMTP protocols to interact with iCloud mail servers.
 * 
 * iCloud IMAP Settings:
 * - Server: imap.mail.me.com
 * - Port: 993 (SSL)
 * - Username: Full iCloud email address
 * - Password: App-specific password (required for 2FA accounts)
 * 
 * iCloud SMTP Settings:
 * - Server: smtp.mail.me.com
 * - Port: 587 (STARTTLS)
 */

export class ICloudMailManager implements MailManager {
  config: ManagerConfig;
  private imapConnection: ImapConnection | null = null;
  private smtpConnection: SmtpConnection | null = null;
  
  // Modular components
  private messageParser: MessageParser;
  private attachmentHandler: AttachmentHandler;
  private searchUtils: SearchUtils;
  private labelManager: LabelManager;
  private draftManager: DraftManager;
  private spamManager: SpamManager;
  private emailSender: EmailSender;

  constructor(config: ManagerConfig) {
    this.config = config;
    
    // Initialize modular components
    this.messageParser = new MessageParser();
    this.attachmentHandler = new AttachmentHandler();
    this.searchUtils = new SearchUtils();
    this.labelManager = new LabelManager();
    this.draftManager = new DraftManager(config, this.messageParser);
    this.spamManager = new SpamManager();
    this.emailSender = new EmailSender(config);
  }

  private async ensureImapConnection(): Promise<ImapConnection> {
    if (!this.imapConnection || !this.imapConnection.isConnected()) {
      this.imapConnection = new ImapConnection({
        ...ICLOUD_IMAP_CONFIG,
        username: this.config.auth.email,
        password: this.config.auth.accessToken, // Should be app-specific password
      });
      await this.imapConnection.connect();
    }
    return this.imapConnection;
  }

  private async ensureSmtpConnection(): Promise<SmtpConnection> {
    if (!this.smtpConnection || !this.smtpConnection.isConnected()) {
      this.smtpConnection = new SmtpConnection({
        ...ICLOUD_SMTP_CONFIG,
        username: this.config.auth.email,
        password: this.config.auth.accessToken, // Should be app-specific password
      });
      await this.smtpConnection.connect();
    }
    return this.smtpConnection;
  }

  private async withErrorHandler<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      console.error(`iCloud ${operation} error:`, error, context);
      
      if (error instanceof Error) {
        // Handle authentication errors
        if (error.message.includes('authentication') || error.message.includes('auth')) {
          const authError = new Error('Authentication failed - please check your app-specific password') as Error & { code: string };
          authError.code = 'INVALID_CREDENTIALS';
          throw new StandardizedError(authError, operation, context);
        }
        
        // Handle connection errors
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          const connError = new Error('Connection to iCloud mail servers failed') as Error & { code: string };
          connError.code = 'CONNECTION_ERROR';
          throw new StandardizedError(connError, operation, context);
        }
      }
      
      const unknownError = new Error(`iCloud ${operation} failed: ${error}`) as Error & { code: string };
      unknownError.code = 'UNKNOWN_ERROR';
      throw new StandardizedError(unknownError, operation, { ...context, originalError: error });
    }
  }

  // Attachment methods
  async getMessageAttachments(id: string): Promise<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
    headers: { name: string; value: string }[];
    body: string;
  }[]> {
    return this.withErrorHandler('getMessageAttachments', async () => {
      const imap = await this.ensureImapConnection();
      return await this.attachmentHandler.getMessageAttachments(imap, id);
    }, { messageId: id });
  }

  async getAttachment(messageId: string, attachmentId: string): Promise<string | undefined> {
    return this.withErrorHandler('getAttachment', async () => {
      const imap = await this.ensureImapConnection();
      return await this.attachmentHandler.getAttachment(imap, messageId, attachmentId);
    }, { messageId, attachmentId });
  }

  // Message retrieval methods
  async get(id: string): Promise<IGetThreadResponse> {
    return this.withErrorHandler('get', async () => {
      const imap = await this.ensureImapConnection();
      await imap.selectFolder('INBOX');
      
      // Search for messages in the thread
      const messageIds = await imap.search(['X-GM-THRID', id]);
      
      if (messageIds.length === 0) {
        throw new Error(`Thread not found: ${id}`);
      }
      
      // Fetch all messages in the thread
      const messages = await imap.fetch(messageIds, {
        bodies: ['HEADER.FIELDS (FROM TO CC BCC SUBJECT DATE MESSAGE-ID IN-REPLY-TO REFERENCES)', 'TEXT'],
        struct: true
      });
      
      const parsedMessages: ParsedMessage[] = [];
      let hasUnread = false;
      
      for (const message of messages) {
        const parsedMessage = await this.messageParser.parseMessage(
          message, 
          this.config.auth.userId,
          this.attachmentHandler.extractMessageAttachments.bind(this.attachmentHandler)
        );
        parsedMessages.push(parsedMessage);
        
        if (parsedMessage.unread) {
          hasUnread = true;
        }
      }
      
      // Sort messages by date
      parsedMessages.sort((a, b) => new Date(a.receivedOn).getTime() - new Date(b.receivedOn).getTime());
      
      const latest = parsedMessages[parsedMessages.length - 1];
      const labels = await this.labelManager.getThreadLabels(id);
      
      return {
        messages: parsedMessages,
        latest,
        hasUnread,
        totalReplies: parsedMessages.length - 1,
        labels
      };
    }, { threadId: id });
  }

  async list(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string | number;
  }): Promise<IGetThreadsResponse> {
    return this.withErrorHandler('list', async () => {
      const imap = await this.ensureImapConnection();
      
      const iCloudFolder = ICLOUD_FOLDER_MAP[params.folder.toUpperCase()] || params.folder;
      await imap.selectFolder(iCloudFolder);
      
      // Build search criteria
      let searchCriteria = ['ALL'];
      
      if (params.query) {
        searchCriteria = this.searchUtils.parseSearchQuery(params.query);
      }
      
      // Filter by label IDs (map to iCloud folders)
      if (params.labelIds && params.labelIds.length > 0) {
        const labelFolders = params.labelIds.map(labelId => ICLOUD_FOLDER_MAP[labelId.toUpperCase()]).filter(Boolean);
        if (labelFolders.length > 0 && !labelFolders.includes(iCloudFolder)) {
          return {
            threads: [],
            nextPageToken: null
          };
        }
      }
      
      // Search for messages
      const messageIds = await imap.search(searchCriteria);
      
      // Apply pagination
      const { paginatedItems: paginatedIds, nextPageToken } = this.searchUtils.applyPagination(
        messageIds,
        params.pageToken,
        params.maxResults || 50
      );
      
      // Group messages by thread (based on subject and references)
      let threadsMap = new Map<string, { id: string; historyId: string | null; $raw?: unknown }>();
      
      if (paginatedIds.length > 0) {
        const messages = await imap.fetch(paginatedIds, {
          bodies: ['HEADER.FIELDS (MESSAGE-ID SUBJECT REFERENCES IN-REPLY-TO DATE)'],
          envelope: true
        });
        
        threadsMap = this.searchUtils.groupMessagesByThread(
          messages,
          this.messageParser.parseHeaders.bind(this.messageParser),
          this.messageParser.generateThreadId.bind(this.messageParser)
        );
      }
      
      // Convert map to array and sort by date (most recent first)
      const threads = this.searchUtils.sortThreadsByDate(Array.from(threadsMap.values()));
      
      return {
        threads,
        nextPageToken
      };
    }, { folder: params.folder, query: params.query, maxResults: params.maxResults });
  }

  // Email sending methods
  async create(data: IOutgoingMessage): Promise<{ id?: string | null }> {
    return this.withErrorHandler('create', async () => {
      const smtp = await this.ensureSmtpConnection();
      return await this.emailSender.create(smtp, data);
    }, { subject: data.subject, to: data.to });
  }

  // Draft methods
  async createDraft(data: CreateDraftData): Promise<{ 
    id?: string | null; 
    success?: boolean; 
    error?: string 
  }> {
    return this.withErrorHandler('createDraft', async () => {
      const imap = await this.ensureImapConnection();
      return await this.draftManager.createDraft(imap, data);
    }, { subject: data.subject });
  }

  async getDraft(id: string): Promise<ParsedDraft> {
    return this.withErrorHandler('getDraft', async () => {
      const imap = await this.ensureImapConnection();
      return await this.draftManager.getDraft(imap, id);
    }, { draftId: id });
  }

  async listDrafts(params: { 
    q?: string; 
    maxResults?: number; 
    pageToken?: string 
  }): Promise<{
    threads: { id: string; historyId: string | null; $raw: unknown }[];
    nextPageToken: string | null;
  }> {
    return this.withErrorHandler('listDrafts', async () => {
      const imap = await this.ensureImapConnection();
      return await this.draftManager.listDrafts(imap, params, this.searchUtils);
    }, { query: params.q, maxResults: params.maxResults });
  }

  async sendDraft(id: string, data: IOutgoingMessage): Promise<void> {
    return this.withErrorHandler('sendDraft', async () => {
      const imap = await this.ensureImapConnection();
      const smtp = await this.ensureSmtpConnection();
      await this.draftManager.sendDraft(imap, smtp, id, data, this.emailSender);
    }, { draftId: id });
  }

  // Message management methods
  async delete(id: string): Promise<void> {
    return this.withErrorHandler('delete', async () => {
      const imap = await this.ensureImapConnection();
      
      // Search across all folders for the message
      const folders = ['INBOX', 'Sent Messages', 'Drafts'];
      let found = false;
      
      for (const folder of folders) {
        await imap.selectFolder(folder);
        
        // Search for the message by ID (could be Message-ID or UID)
        let messageIds: string[] = [];
        
        // Try searching by Message-ID header first
        try {
          messageIds = await imap.search(['HEADER', 'Message-ID', id]);
        } catch (error) {
          // If header search fails, try searching by UID
          if (id.match(/^\d+$/)) {
            messageIds = [id];
          }
        }
        
        if (messageIds.length > 0) {
          // Move messages to trash (Deleted Messages folder)
          try {
            await imap.move(messageIds, 'Deleted Messages');
            found = true;
            break;
          } catch (moveError) {
            // If move fails, try marking as deleted and expunging
            await imap.addFlags(messageIds, ['\\Deleted']);
            await imap.expunge();
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        throw new Error(`Message not found: ${id}`);
      }
    }, { messageId: id });
  }

  async markAsRead(threadIds: string[]): Promise<void> {
    return this.withErrorHandler('markAsRead', async () => {
      const imap = await this.ensureImapConnection();
      
      // Search across folders for the thread messages
      const folders = ['INBOX', 'Sent Messages', 'Drafts'];
      
      for (const threadId of threadIds) {
        let found = false;
        
        for (const folder of folders) {
          await imap.selectFolder(folder);
          
          // Search for messages in the thread
          let messageIds: string[] = [];
          
          // Try searching by thread ID first
          try {
            messageIds = await imap.search(['HEADER', 'X-GM-THRID', threadId]);
          } catch (error) {
            // If thread search fails, try Message-ID
            try {
              messageIds = await imap.search(['HEADER', 'Message-ID', threadId]);
            } catch (msgIdError) {
              // If all searches fail and threadId looks like a UID, use it directly
              if (threadId.match(/^\d+$/)) {
                messageIds = [threadId];
              }
            }
          }
          
          if (messageIds.length > 0) {
            // Mark all messages in the thread as read by adding \Seen flag
            await imap.addFlags(messageIds, ['\\Seen']);
            found = true;
            break;
          }
        }
        
        if (!found) {
          console.warn(`Thread not found for marking as read: ${threadId}`);
        }
      }
    }, { threadIds });
  }

  async markAsUnread(threadIds: string[]): Promise<void> {
    return this.withErrorHandler('markAsUnread', async () => {
      const imap = await this.ensureImapConnection();
      
      // Search across folders for the thread messages
      const folders = ['INBOX', 'Sent Messages', 'Drafts'];
      
      for (const threadId of threadIds) {
        let found = false;
        
        for (const folder of folders) {
          await imap.selectFolder(folder);
          
          // Search for messages in the thread
          let messageIds: string[] = [];
          
          // Try searching by thread ID first
          try {
            messageIds = await imap.search(['HEADER', 'X-GM-THRID', threadId]);
          } catch (error) {
            // If thread search fails, try Message-ID
            try {
              messageIds = await imap.search(['HEADER', 'Message-ID', threadId]);
            } catch (msgIdError) {
              // If all searches fail and threadId looks like a UID, use it directly
              if (threadId.match(/^\d+$/)) {
                messageIds = [threadId];
              }
            }
          }
          
          if (messageIds.length > 0) {
            // Mark all messages in the thread as unread by removing \Seen flag
            await imap.delFlags(messageIds, ['\\Seen']);
            found = true;
            break;
          }
        }
        
        if (!found) {
          console.warn(`Thread not found for marking as unread: ${threadId}`);
        }
      }
    }, { threadIds });
  }

  // Label management methods
  async getUserLabels(): Promise<Label[]> {
    return this.withErrorHandler('getUserLabels', async () => {
      const imap = await this.ensureImapConnection();
      return await this.labelManager.getUserLabels(imap);
    });
  }

  async getLabel(id: string): Promise<Label> {
    return this.withErrorHandler('getLabel', async () => {
      const imap = await this.ensureImapConnection();
      return await this.labelManager.getLabel(imap, id);
    }, { labelId: id });
  }

  async createLabel(label: {
    name: string;
    color?: { backgroundColor: string; textColor: string };
  }): Promise<void> {
    return this.withErrorHandler('createLabel', async () => {
      return await this.labelManager.createLabel(label);
    }, { labelName: label.name });
  }

  async updateLabel(
    id: string,
    label: { name: string; color?: { backgroundColor: string; textColor: string } }
  ): Promise<void> {
    return this.withErrorHandler('updateLabel', async () => {
      return await this.labelManager.updateLabel(id, label);
    }, { labelId: id, newName: label.name });
  }

  async deleteLabel(id: string): Promise<void> {
    return this.withErrorHandler('deleteLabel', async () => {
      return await this.labelManager.deleteLabel(id);
    }, { labelId: id });
  }

  async modifyLabels(
    id: string[],
    options: { addLabels: string[]; removeLabels: string[] }
  ): Promise<void> {
    return this.withErrorHandler('modifyLabels', async () => {
      const imap = await this.ensureImapConnection();
      return await this.labelManager.modifyLabels(imap, id, options);
    }, { messageIds: id, options });
  }

  async count(): Promise<{ count?: number; label?: string }[]> {
    return this.withErrorHandler('count', async () => {
      const imap = await this.ensureImapConnection();
      return await this.labelManager.countMessages(imap);
    });
  }

  // Authentication and user info methods
  async getTokens(code: string): Promise<{ 
    tokens: { 
      access_token?: string; 
      refresh_token?: string; 
      expiry_date?: number 
    } 
  }> {
    return this.withErrorHandler('getTokens', async () => {
      // iCloud uses app-specific passwords instead of OAuth tokens
      // The 'code' parameter should be the app-specific password
      
      // Validate the app-specific password by attempting a connection
      try {
        const testConnection = new ImapConnection({
          ...ICLOUD_IMAP_CONFIG,
          username: this.config.auth.email,
          password: code
        });
        
        await testConnection.connect();
        await testConnection.close();
        
        // Return the app-specific password as the access token
        return {
          tokens: {
            access_token: code,
            refresh_token: code, // Same as access token for iCloud
            expiry_date: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year from now
          }
        };
      } catch (error) {
        throw new Error(`Invalid app-specific password: ${error}`);
      }
    }, { email: this.config.auth.email });
  }

  async getUserInfo(tokens?: ManagerConfig['auth']): Promise<{ 
    address: string; 
    name: string; 
    photo: string 
  }> {
    return this.withErrorHandler('getUserInfo', async () => {
      const imap = await this.ensureImapConnection();
      
      // Try to get user info from IMAP
      let userName = 'iCloud User';
      
      try {
        // Select INBOX to get some basic info
        await imap.selectFolder('INBOX');
        
        // Try to extract name from sent messages
        const sentMessages = await imap.search(['FROM', this.config.auth.email]);
        
        if (sentMessages.length > 0) {
          const messages = await imap.fetch([sentMessages[0]], {
            bodies: ['HEADER.FIELDS (FROM)']
          });
          
          if (messages.length > 0) {
            const headers = this.messageParser.parseHeaders(messages[0].headers);
            const fromHeader = headers.from;
            
            if (fromHeader) {
              const parsed = parseFrom(fromHeader);
              userName = parsed.name || userName;
            }
          }
        }
      } catch (error) {
        console.warn('Could not extract user name from IMAP:', error);
      }
      
      return {
        address: this.config.auth.email,
        name: userName,
        photo: '' // iCloud doesn't provide profile photos via IMAP
      };
    });
  }

  getScope(): string {
    // iCloud doesn't use OAuth scopes, return empty string
    return '';
  }

  async revokeToken(token: string): Promise<boolean> {
    // iCloud doesn't use OAuth tokens to revoke
    return true;
  }

  // Utility methods
  normalizeIds(id: string[]): { threadIds: string[] } {
    // iCloud uses different ID format than Gmail
    return { threadIds: id };
  }

  async listHistory<T>(historyId: string): Promise<{ 
    history: T[]; 
    historyId: string 
  }> {
    return this.withErrorHandler('listHistory', async () => {
      // iCloud IMAP doesn't have a native history API like Gmail
      // We can simulate this by checking for recent changes
      
      const imap = await this.ensureImapConnection();
      await imap.selectFolder('INBOX');
      
      // Get recent messages (last 24 hours) as a proxy for history
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const recentMessages = await imap.search([
        'SINCE',
        yesterday.toISOString().split('T')[0].replace(/-/g, '-')
      ]);
      
      const history: T[] = [];
      
      if (recentMessages.length > 0) {
        const messages = await imap.fetch(recentMessages, {
          bodies: ['HEADER.FIELDS (MESSAGE-ID DATE SUBJECT FROM)'],
          envelope: true
        });
        
        // Convert messages to history format
        for (const message of messages) {
          history.push(message as T);
        }
      }
      
      // Generate a new history ID based on current timestamp
      const newHistoryId = Date.now().toString();
      
      return {
        history,
        historyId: newHistoryId
      };
    }, { historyId });
  }

  async getEmailAliases(): Promise<{ 
    email: string; 
    name?: string; 
    primary?: boolean 
  }[]> {
    return this.withErrorHandler('getEmailAliases', async () => {
      // iCloud supports email aliases, but they're not easily discoverable via IMAP
      // We can try to detect them by looking at sent messages
      
      const aliases: { email: string; name?: string; primary?: boolean }[] = [];
      
      // Add the primary email
      aliases.push({
        email: this.config.auth.email,
        name: 'Primary',
        primary: true
      });
      
      try {
        const imap = await this.ensureImapConnection();
        await imap.selectFolder('Sent Messages');
        
        // Get recent sent messages to detect aliases
        const messageIds = await imap.search(['ALL']);
        
        if (messageIds.length > 0) {
          // Limit to recent messages to avoid processing too many
          const recentIds = messageIds.slice(-20);
          
          const messages = await imap.fetch(recentIds, {
            bodies: ['HEADER.FIELDS (FROM)']
          });
          
          const seenEmails = new Set<string>();
          seenEmails.add(this.config.auth.email.toLowerCase());
          
          for (const message of messages) {
            const headers = this.messageParser.parseHeaders(message.headers);
            const fromHeader = headers.from;
            
            if (fromHeader) {
              const parsed = parseFrom(fromHeader);
              const email = parsed.email.toLowerCase();
              
              // Check if this is a different email address from the same domain
              if (!seenEmails.has(email)) {
                const primaryDomain = this.config.auth.email.split('@')[1];
                const aliasDomain = email.split('@')[1];
                
                // Only add if it's from the same domain (likely an alias)
                if (aliasDomain === primaryDomain) {
                  aliases.push({
                    email: parsed.email,
                    name: parsed.name || 'Alias',
                    primary: false
                  });
                  seenEmails.add(email);
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('Could not detect email aliases:', error);
      }
      
      return aliases;
    });
  }

  async deleteAllSpam(): Promise<DeleteAllSpamResponse> {
    return this.withErrorHandler('deleteAllSpam', async () => {
      const imap = await this.ensureImapConnection();
      return await this.spamManager.deleteAllSpam(imap);
    });
  }
}
