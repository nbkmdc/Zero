import type { ImapConnection } from './connections';
import { simpleParser } from 'mailparser';
import type { ParsedMail, Attachment } from 'mailparser';

export interface AttachmentData {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  headers: { name: string; value: string }[];
  body: string;
}

export class AttachmentHandler {
  /**
   * Extract attachment information from IMAP message structure
   */
  extractAttachmentsFromStruct(struct: any, prefix = ''): AttachmentData[] {
    const attachments: AttachmentData[] = [];
    
    if (!struct) return attachments;
    
    if (Array.isArray(struct)) {
      struct.forEach((part, index) => {
        const partId = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
        attachments.push(...this.extractAttachmentsFromStruct(part, partId));
      });
    } else {
      const partId = prefix || '1';
      
      // Check if this part is an attachment
      const isAttachment = struct.disposition && 
                          (struct.disposition.type === 'attachment' || 
                           struct.disposition.type === 'inline');
      
      const hasFilename = struct.disposition?.params?.filename || 
                         struct.params?.name;
      
      if (isAttachment || hasFilename) {
        const filename = struct.disposition?.params?.filename || 
                        struct.params?.name || 
                        `attachment_${partId}`;
        
        const mimeType = struct.type && struct.subtype ? 
                        `${struct.type}/${struct.subtype}` : 
                        'application/octet-stream';
        
        attachments.push({
          filename,
          mimeType,
          size: struct.size || 0,
          attachmentId: partId,
          headers: this.extractHeadersFromStruct(struct),
          body: '' // Will be fetched separately
        });
      }
      
      // Process nested parts
      if (struct.childNodes && Array.isArray(struct.childNodes)) {
        struct.childNodes.forEach((child: any, index: number) => {
          const childId = `${partId}.${index + 1}`;
          attachments.push(...this.extractAttachmentsFromStruct(child, childId));
        });
      }
    }
    
    return attachments;
  }

  /**
   * Extract headers from IMAP message structure
   */
  private extractHeadersFromStruct(struct: any): { name: string; value: string }[] {
    const headers: { name: string; value: string }[] = [];
    
    if (struct.disposition?.params) {
      Object.entries(struct.disposition.params).forEach(([key, value]) => {
        headers.push({ name: `Content-Disposition-${key}`, value: String(value) });
      });
    }
    
    if (struct.params) {
      Object.entries(struct.params).forEach(([key, value]) => {
        headers.push({ name: `Content-Type-${key}`, value: String(value) });
      });
    }
    
    return headers;
  }

  /**
   * Parse email using mailparser to extract attachments
   */
  async parseEmailForAttachments(emailSource: string): Promise<{
    parsedMail: ParsedMail;
    attachments: AttachmentData[];
  }> {
    try {
      const parsedMail = await simpleParser(emailSource);
      
      const attachments: AttachmentData[] = [];
      
      if (parsedMail.attachments && parsedMail.attachments.length > 0) {
        parsedMail.attachments.forEach((attachment: Attachment, index: number) => {
          attachments.push({
            filename: attachment.filename || `attachment_${index + 1}`,
            mimeType: attachment.contentType || 'application/octet-stream',
            size: attachment.size || (attachment.content ? attachment.content.length : 0),
            attachmentId: attachment.contentId || `${index + 1}`,
            headers: this.extractHeadersFromAttachment(attachment),
            body: attachment.content ? attachment.content.toString('base64') : ''
          });
        });
      }
      
      return {
        parsedMail,
        attachments
      };
    } catch (error) {
      throw new Error(`Failed to parse email for attachments: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract headers from mailparser attachment
   */
  private extractHeadersFromAttachment(attachment: Attachment): { name: string; value: string }[] {
    const headers: { name: string; value: string }[] = [];
    
    if (attachment.contentType) {
      headers.push({ name: 'Content-Type', value: attachment.contentType });
    }
    
    if (attachment.contentDisposition) {
      headers.push({ name: 'Content-Disposition', value: attachment.contentDisposition });
    }
    
    if (attachment.contentId) {
      headers.push({ name: 'Content-ID', value: attachment.contentId });
    }
    
    // Note: transferEncoding may not be available in all versions of mailparser
    if ('transferEncoding' in attachment && attachment.transferEncoding) {
      headers.push({ name: 'Content-Transfer-Encoding', value: attachment.transferEncoding as string });
    }
    
    return headers;
  }

  /**
   * Extract attachments from IMAP message (legacy method for compatibility)
   */
  extractAttachments(message: any): AttachmentData[] {
    if (message.struct) {
      return this.extractAttachmentsFromStruct(message.struct);
    }
    
    // Fallback for messages without structure
    return [];
  }

  /**
   * Extract message attachments from IMAP message
   */
  async extractMessageAttachments(imapMessage: any): Promise<any[]> {
    const attachments: any[] = [];
    
    try {
      // First try to use message structure if available
      if (imapMessage.struct) {
        const structAttachments = this.extractAttachmentsFromStruct(imapMessage.struct);
        
        attachments.push(...structAttachments.map(att => ({
          attachmentId: att.attachmentId,
          filename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
          body: att.body,
          headers: att.headers
        })));
      }
      
      // If we have the full message body, try parsing with mailparser
      if (imapMessage.body && imapMessage.headers) {
        try {
          const fullMessage = `${imapMessage.headers}\r\n\r\n${imapMessage.body}`;
          const { attachments: parsedAttachments } = await this.parseEmailForAttachments(fullMessage);
          
          // Merge with struct attachments, avoiding duplicates
          parsedAttachments.forEach(parsedAtt => {
            const exists = attachments.find(att => 
              att.filename === parsedAtt.filename && att.size === parsedAtt.size
            );
            
            if (!exists) {
              attachments.push({
                attachmentId: parsedAtt.attachmentId,
                filename: parsedAtt.filename,
                mimeType: parsedAtt.mimeType,
                size: parsedAtt.size,
                body: parsedAtt.body,
                headers: parsedAtt.headers
              });
            }
          });
        } catch (parseError) {
          console.warn('Failed to parse message with mailparser:', parseError);
        }
      }
    } catch (error) {
      console.warn('Error extracting attachments:', error);
    }
    
    return attachments;
  }

  /**
   * Find attachment by ID in message structure
   */
  findAttachmentById(message: any, attachmentId: string): any {
    const findInStructure = (struct: any, currentId = ''): any => {
      if (Array.isArray(struct)) {
        for (let i = 0; i < struct.length; i++) {
          const partId = currentId ? `${currentId}.${i + 1}` : `${i + 1}`;
          const result = findInStructure(struct[i], partId);
          if (result) return result;
        }
      } else if (struct) {
        const partId = currentId || '1';
        
        if (partId === attachmentId) {
          const isAttachment = struct.disposition?.type === 'attachment' ||
                              struct.disposition?.type === 'inline' ||
                              struct.disposition?.params?.filename ||
                              struct.params?.name;
          
          if (isAttachment) {
            return struct;
          }
        }
        
        if (struct.childNodes) {
          for (let i = 0; i < struct.childNodes.length; i++) {
            const childId = `${partId}.${i + 1}`;
            const result = findInStructure(struct.childNodes[i], childId);
            if (result) return result;
          }
        }
      }
      return null;
    };
    
    return findInStructure(message.struct);
  }

  /**
   * Get specific attachment from message
   */
  async getAttachment(
    imap: ImapConnection,
    messageId: string,
    attachmentId: string,
    folders: string[] = ['INBOX', 'Sent Messages', 'Drafts']
  ): Promise<string | undefined> {
    // Search for the message across folders
    for (const folder of folders) {
      try {
        await imap.selectFolder(folder);
        
        // Search for the message by Message-ID header
        const messageIds = await imap.search(['HEADER', 'Message-ID', messageId]);
        
        if (messageIds.length > 0) {
          // Fetch the message with full body structure
          const messages = await imap.fetch(messageIds, {
            bodies: attachmentId, // Fetch specific part
            struct: true
          });
          
          if (messages.length > 0) {
            const message = messages[0];
            
            // Find the specific attachment by ID
            const attachment = this.findAttachmentById(message, attachmentId);
            
            if (attachment && message.body) {
              // Return base64 encoded attachment data
              const body: unknown = message.body;
              
              if (typeof body === 'string') {
                return Buffer.from(body, 'binary').toString('base64');
              } 
              
              if (Buffer.isBuffer(body)) {
                return body.toString('base64');
              } 
              
              if (body && typeof body === 'object') {
                // Handle case where body might be an object with content
                const bodyObj = body as any;
                const bodyContent = bodyObj.content || bodyObj;
                
                if (typeof bodyContent === 'string') {
                  return Buffer.from(bodyContent, 'binary').toString('base64');
                }
                
                if (Buffer.isBuffer(bodyContent)) {
                  return bodyContent.toString('base64');
                }
              }
              
              // Last resort: try to convert to string and then base64
              try {
                const bodyStr = String(body);
                return Buffer.from(bodyStr, 'binary').toString('base64');
              } catch (stringError) {
                console.warn('Failed to convert body to string:', stringError);
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to search in folder ${folder}:`, error);
        // Continue to next folder
      }
    }
    
    return undefined;
  }

  /**
   * Get all attachments for a message
   */
  async getMessageAttachments(imap: ImapConnection, id: string): Promise<AttachmentData[]> {
    try {
      await imap.selectFolder('INBOX');
      
      // Fetch the message with full structure and headers
      const messages = await imap.fetch([id], {
        bodies: 'HEADER.FIELDS (MESSAGE-ID)',
        struct: true
      });
      
      if (messages.length === 0) {
        return [];
      }
      
      const message = messages[0];
      
      // Extract attachments from message structure
      const attachments = this.extractAttachmentsFromStruct(message.struct);
      
      // For each attachment, try to fetch its content
      for (const attachment of attachments) {
        try {
          const content = await this.getAttachment(imap, id, attachment.attachmentId);
          if (content) {
            attachment.body = content;
          }
        } catch (error) {
          console.warn(`Failed to fetch attachment ${attachment.attachmentId}:`, error);
        }
      }
      
      return attachments;
    } catch (error) {
      console.error('Error getting message attachments:', error);
      return [];
    }
  }
}
