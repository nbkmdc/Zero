import type { IOutgoingMessage } from '../../../types';
import type { ManagerConfig } from '../types';
import type { SmtpConnection } from './connections';
import { createMimeMessage } from 'mimetext';

export class EmailSender {
  constructor(private config: ManagerConfig) {}

  async create(smtp: SmtpConnection, data: IOutgoingMessage): Promise<{ id?: string | null }> {
    // Create MIME message
    const mimeMessage = createMimeMessage();
    
    // Set basic headers
    mimeMessage.setSender({ 
      name: data.fromEmail?.split('@')[0] || 'User', 
      addr: data.fromEmail || this.config.auth.email 
    });
    mimeMessage.setSubject(data.subject);
    
    // Set recipients
    mimeMessage.setTo(data.to.map(recipient => ({
      name: recipient.name || recipient.email.split('@')[0],
      addr: recipient.email
    })));
    
    if (data.cc && data.cc.length > 0) {
      mimeMessage.setCc(data.cc.map(recipient => ({
        name: recipient.name || recipient.email.split('@')[0],
        addr: recipient.email
      })));
    }
    
    if (data.bcc && data.bcc.length > 0) {
      mimeMessage.setBcc(data.bcc.map(recipient => ({
        name: recipient.name || recipient.email.split('@')[0],
        addr: recipient.email
      })));
    }
    
    // Set custom headers
    Object.entries(data.headers || {}).forEach(([key, value]) => {
      mimeMessage.setHeader(key, value);
    });
    
    // Set thread headers if this is a reply
    if (data.threadId) {
      mimeMessage.setHeader('In-Reply-To', data.threadId);
      mimeMessage.setHeader('References', data.threadId);
    }
    
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
    
    // Generate a message ID
    const messageId = `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@${this.config.auth.email.split('@')[1]}>`;
    mimeMessage.setHeader('Message-ID', messageId);
    
    try {
      // Send the message using SMTP
      const messageString = mimeMessage.asRaw();
      
      // Prepare envelope information
      const envelope = {
        from: data.fromEmail || this.config.auth.email,
        to: [
          ...data.to.map(recipient => recipient.email),
          ...(data.cc || []).map(recipient => recipient.email),
          ...(data.bcc || []).map(recipient => recipient.email)
        ]
      };
      
      const info = await smtp.sendMessage(messageString, envelope);
      
      // Log successful send
      console.log('Email sent successfully:', {
        messageId,
        to: envelope.to,
        subject: data.subject,
        smtpInfo: info
      });
      
      return { id: messageId };
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
