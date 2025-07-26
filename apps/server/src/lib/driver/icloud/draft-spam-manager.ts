import type { IOutgoingMessage, DeleteAllSpamResponse } from '../../../types';
import type { CreateDraftData } from '../../schemas';
import type { ManagerConfig, ParsedDraft } from '../types';
import type { ImapConnection, SmtpConnection } from './connections';
import { createMimeMessage } from 'mimetext';
import { parseAddressList, parseFrom } from '../../email-utils';
import * as he from 'he';

export class DraftManager {
  constructor(
    private config: ManagerConfig,
    private messageParser: any
  ) {}

  async createDraft(
    imap: ImapConnection,
    data: CreateDraftData
  ): Promise<{ id?: string | null; success?: boolean; error?: string }> {
    try {
      await imap.selectFolder('Drafts');
      
      // Create MIME message for draft
      const mimeMessage = createMimeMessage();
      
      // Set basic headers
      mimeMessage.setSender({ 
        name: data.fromEmail?.split('@')[0] || 'User', 
        addr: data.fromEmail || this.config.auth.email 
      });
      mimeMessage.setSubject(data.subject);
      
      // Parse and set recipients
      if (data.to) {
        const toAddresses = parseAddressList(data.to);
        mimeMessage.setTo(toAddresses.map(addr => ({
          name: addr.name || addr.email.split('@')[0],
          addr: addr.email
        })));
      }
      
      if (data.cc) {
        const ccAddresses = parseAddressList(data.cc);
        mimeMessage.setCc(ccAddresses.map(addr => ({
          name: addr.name || addr.email.split('@')[0],
          addr: addr.email
        })));
      }
      
      if (data.bcc) {
        const bccAddresses = parseAddressList(data.bcc);
        mimeMessage.setBcc(bccAddresses.map(addr => ({
          name: addr.name || addr.email.split('@')[0],
          addr: addr.email
        })));
      }
      
      // Set thread headers if this is a reply
      if (data.threadId) {
        mimeMessage.setHeader('In-Reply-To', data.threadId);
        mimeMessage.setHeader('References', data.threadId);
      }
      
      // Set draft flag
      mimeMessage.setHeader('X-Draft', 'true');
      
      // Set message content
      if (data.message.includes('<html') || data.message.includes('<body')) {
        mimeMessage.addMessage({
          contentType: 'text/html',
          data: data.message
        });
      } else {
        mimeMessage.addMessage({
          contentType: 'text/plain',
          data: data.message
        });
      }
      
      // Add attachments
      if (data.attachments && data.attachments.length > 0) {
        for (const attachment of data.attachments) {
          mimeMessage.addAttachment({
            filename: attachment.name,
            contentType: attachment.type,
            data: attachment.base64
          });
        }
      }
      
      // Generate a draft ID
      const draftId = data.id || `<draft-${Date.now()}.${Math.random().toString(36).substr(2, 9)}@${this.config.auth.email.split('@')[1]}>`;
      mimeMessage.setHeader('Message-ID', draftId);
      
      // Save to Drafts folder using IMAP APPEND
      const messageString = mimeMessage.asRaw();
      await imap.append(messageString, 'Drafts', ['\\Draft'], new Date());
      
      return {
        id: draftId,
        success: true
      };
    } catch (error) {
      console.error('Error creating draft:', error);
      return {
        id: null,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getDraft(imap: ImapConnection, id: string): Promise<ParsedDraft> {
    await imap.selectFolder('Drafts');
    
    // Search for the draft by Message-ID
    const messageIds = await imap.search(['HEADER', 'Message-ID', id]);
    
    if (messageIds.length === 0) {
      throw new Error(`Draft not found: ${id}`);
    }
    
    // Fetch the draft message
    const messages = await imap.fetch([messageIds[0]], {
      bodies: ['HEADER.FIELDS (FROM TO CC BCC SUBJECT DATE MESSAGE-ID)', 'TEXT'],
      struct: true
    });
    
    if (messages.length === 0) {
      throw new Error(`Draft message not found: ${id}`);
    }
    
    const message = messages[0];
    const headers = this.messageParser.parseHeaders(message.headers);
    const body = message.body || '';
    
    return {
      id,
      to: headers.to ? parseAddressList(headers.to).map(addr => addr.email) : [],
      cc: headers.cc ? parseAddressList(headers.cc).map(addr => addr.email) : [],
      bcc: headers.bcc ? parseAddressList(headers.bcc).map(addr => addr.email) : [],
      subject: headers.subject || '',
      content: he.decode(body),
      rawMessage: {
        internalDate: headers.date || null
      }
    };
  }

  async deleteDraft(imap: ImapConnection, id: string): Promise<void> {
    try {
      await imap.selectFolder('Drafts');
      
      // Find the draft message by Message-ID
      let messageIds: string[] = [];
      
      try {
        messageIds = await imap.search(['HEADER', 'Message-ID', id]);
      } catch (error) {
        // If header search fails and id looks like a UID, use it directly
        if (id.match(/^\d+$/)) {
          messageIds = [id];
        }
      }
      
      if (messageIds.length > 0) {
        // Mark as deleted and expunge
        await imap.addFlags(messageIds, ['\\Deleted']);
        await imap.expunge();
      }
    } catch (error) {
      console.error(`Error deleting draft ${id}:`, error);
      throw error;
    }
  }

  async listDrafts(
    imap: ImapConnection,
    params: { q?: string; maxResults?: number; pageToken?: string },
    searchUtils: any
  ): Promise<{
    threads: { id: string; historyId: string | null; $raw: unknown }[];
    nextPageToken: string | null;
  }> {
    await imap.selectFolder('Drafts');
    
    // Build search criteria
    const searchCriteria = ['ALL'];
    
    if (params.q) {
      // Parse search query and convert to IMAP search criteria
      const searchTerms = searchUtils.parseSearchQuery(params.q);
      searchCriteria.push(...searchTerms);
    }
    
    // Search for draft messages
    const messageIds = await imap.search(searchCriteria);
    
    // Apply pagination
    const { paginatedItems: paginatedIds, nextPageToken } = searchUtils.applyPagination(
      messageIds,
      params.pageToken,
      params.maxResults || 50
    );
    
    // Fetch message headers for the paginated results
    const threads: { id: string; historyId: string | null; $raw: unknown }[] = [];
    
    if (paginatedIds.length > 0) {
      const messages = await imap.fetch(paginatedIds, {
        bodies: ['HEADER.FIELDS (MESSAGE-ID DATE)'],
        envelope: true
      });
      
      for (const message of messages) {
        const headers = this.messageParser.parseHeaders(message.headers);
        threads.push({
          id: headers['message-id'] || `draft-${message.uid || Date.now()}`,
          historyId: null, // iCloud doesn't have history IDs like Gmail
          $raw: message
        });
      }
    }
    
    return {
      threads,
      nextPageToken
    };
  }

  async sendDraft(
    imap: ImapConnection,
    smtp: SmtpConnection,
    id: string,
    data: IOutgoingMessage,
    emailSender: any
  ): Promise<void> {
    // First, get the draft
    const draft = await this.getDraft(imap, id);
    
    // Merge draft data with provided data
    const mergedData: IOutgoingMessage = {
      to: data.to.length > 0 ? data.to : (draft.to?.map((email: string) => ({ email })) || []),
      cc: data.cc?.length ? data.cc : (draft.cc?.map((email: string) => ({ email })) || []),
      bcc: data.bcc?.length ? data.bcc : (draft.bcc?.map((email: string) => ({ email })) || []),
      subject: data.subject || draft.subject || '(No Subject)',
      message: data.message || draft.content || '',
      attachments: data.attachments || [],
      headers: data.headers || {},
      threadId: data.threadId,
      fromEmail: data.fromEmail || this.config.auth.email
    };
    
    // Send the email
    await emailSender.create(mergedData);
    
    // Delete the draft after sending
    await this.deleteDraft(imap, id);
  }
}

export class SpamManager {
  async deleteAllSpam(imap: ImapConnection): Promise<DeleteAllSpamResponse> {
    try {
      await imap.selectFolder('Junk');
      
      // Get all messages in the Junk folder
      const messageIds = await imap.search(['ALL']);
      
      if (messageIds.length === 0) {
        return {
          success: true,
          message: 'No spam messages found to delete',
          count: 0
        };
      }
      
      // Mark all messages as deleted
      await imap.addFlags(messageIds, ['\\Deleted']);
      
      // Expunge to permanently delete marked messages
      await imap.expunge();
      
      return {
        success: true,
        message: `Successfully deleted ${messageIds.length} spam messages`,
        count: messageIds.length
      };
    } catch (error) {
      console.error('Error deleting spam messages:', error);
      
      return {
        success: false,
        message: `Failed to delete spam messages: ${error}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
