import type { ParsedMessage } from '../../../types';
import { parseAddressList, parseFrom } from '../../email-utils';
import * as he from 'he';
import { simpleParser } from 'mailparser';
import type { ParsedMail } from 'mailparser';
import sanitizeHtml from 'sanitize-html';
import { stripHtml } from 'string-strip-html';

export class MessageParser {
  parseHeaders(headerString: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = headerString.split('\r\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^([^:]+):\s*(.*)$/);
      
      if (match) {
        const [, name, value] = match;
        headers[name.toLowerCase()] = value.trim();
      } else if (line.startsWith(' ') || line.startsWith('\t')) {
        // Continuation of previous header
        const lastHeader = Object.keys(headers).pop();
        if (lastHeader) {
          headers[lastHeader] += ' ' + line.trim();
        }
      }
    }
    
    return headers;
  }

  processMessageBody(body: string, contentType?: string): string {
    // Clean and process the message body
    let processed = body;
    
    // Handle different content types
    if (contentType?.includes('text/html')) {
      // Production-grade HTML sanitization using sanitize-html
      processed = sanitizeHtml(processed, {
        allowedTags: [
          'p', 'div', 'span', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'strong', 'b', 'em', 'i', 'u', 'strike', 'del', 'ins', 'sup', 'sub',
          'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'pre', 'code',
          'a', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
          'caption', 'col', 'colgroup'
        ],
        allowedAttributes: {
          'a': ['href', 'title', 'target'],
          'img': ['src', 'alt', 'title', 'width', 'height'],
          'table': ['border', 'cellpadding', 'cellspacing'],
          'td': ['colspan', 'rowspan'],
          'th': ['colspan', 'rowspan'],
          '*': ['class', 'style']
        },
        allowedSchemes: ['http', 'https', 'mailto'],
        allowedSchemesByTag: {
          'a': ['http', 'https', 'mailto'],
          'img': ['http', 'https', 'data']
        },
        allowedSchemesAppliedToAttributes: ['href', 'src'],
        // Remove script tags, event handlers, and dangerous attributes
        disallowedTagsMode: 'discard',
        allowedClasses: {
          '*': ['*'] // Allow all classes but sanitize them
        },
        transformTags: {
          'a': function(tagName, attribs) {
            // Ensure external links open in new tab
            return {
              tagName: 'a',
              attribs: {
                ...attribs,
                target: '_blank',
                rel: 'noopener noreferrer'
              }
            };
          }
        }
      });
    } else {
      // Plain text processing
      processed = he.decode(processed);
      // Convert line breaks to HTML for consistent display
      processed = processed.replace(/\r?\n/g, '<br>');
    }
    
    // Remove excessive whitespace
    processed = processed.replace(/\s+/g, ' ').trim();
    
    return processed;
  }

  generateThreadId(headers: Record<string, string>): string {
    // Generate a thread ID based on subject and references
    const subject = headers.subject || '';
    const references = headers.references || '';
    const inReplyTo = headers['in-reply-to'] || '';
    const messageId = headers['message-id'] || '';
    
    // Clean subject of common prefixes
    const cleanSubject = subject.replace(/^(re:|fwd?:)\s*/i, '').trim();
    
    if (references || inReplyTo) {
      // Use the first message-id in references as thread ID
      const refs = (references || inReplyTo).split(/\s+/);
      const firstRef = refs[0];
      if (firstRef && firstRef.match(/<[^>]+>/)) {
        return firstRef;
      }
    }
    
    // If no references, check if this looks like a reply based on subject
    if (subject.match(/^(re:|fwd?:)/i)) {
      // Generate thread ID based on cleaned subject
      const subjectHash = Buffer.from(cleanSubject.toLowerCase()).toString('base64').slice(0, 16);
      return `<thread-${subjectHash}@icloud-thread>`;
    }
    
    // Use message ID as thread ID for new conversations
    return messageId || `<thread-${Date.now()}@icloud-thread>`;
  }

  async parseRawMessage(rawMessage: string): Promise<ParsedMail> {
    try {
      const parsed = await simpleParser(rawMessage);
      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  extractTextContent(parsed: ParsedMail): string {
    // Extract plain text content, fallback to HTML if needed
    if (parsed.text) {
      return parsed.text;
    } else if (parsed.html) {
      // Production-grade HTML to text conversion using string-strip-html
      const { result } = stripHtml(parsed.html, {
        ignoreTags: ['script', 'style', 'noscript'],
        skipHtmlDecoding: false,
        trimOnlySpaces: false,
        dumpLinkHrefsNearby: {
          enabled: true,
          putOnNewLine: true,
          wrapHeads: '[',
          wrapTails: ']'
        },
        stripTogetherWithTheirContents: ['script', 'style', 'noscript', 'xml'],
        cb: ({ tag, deleteFrom, deleteTo, insert, rangesArr, proposedReturn }) => {
          // Custom callback for advanced HTML processing
          if (tag.name === 'br' && deleteFrom !== null && deleteTo !== null) {
            rangesArr.push(deleteFrom, deleteTo, '\n');
          }
          if ((tag.name === 'p' || tag.name === 'div') && deleteFrom !== null && deleteTo !== null) {
            rangesArr.push(deleteFrom, deleteTo, '\n\n');
          }
          if (tag.name === 'li' && deleteFrom !== null && deleteTo !== null) {
            rangesArr.push(deleteFrom, deleteTo, '\n• ');
          }
        }
      });
      
      return result
        .replace(/\n{3,}/g, '\n\n') // Normalize multiple line breaks
        .replace(/[ \t]+/g, ' ') // Normalize spaces
        .trim();
    }
    return '';
  }

  extractHtmlContent(parsed: ParsedMail): string {
    if (parsed.html) {
      return this.processMessageBody(parsed.html, 'text/html');
    } else if (parsed.text) {
      // Convert plain text to HTML
      return this.processMessageBody(parsed.text, 'text/plain');
    }
    return '';
  }

  extractAddressString(addressObject: any): string {
    if (!addressObject) return '';
    
    // Handle different address object formats from mailparser
    if (typeof addressObject === 'string') {
      return addressObject;
    }
    
    if (Array.isArray(addressObject)) {
      return addressObject.map(addr => {
        if (typeof addr === 'string') return addr;
        if (addr.address) return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
        return '';
      }).filter(Boolean).join(', ');
    }
    
    if (addressObject.address) {
      return addressObject.name ? `${addressObject.name} <${addressObject.address}>` : addressObject.address;
    }
    
    if (addressObject.text) {
      return addressObject.text;
    }
    
    return String(addressObject);
  }

  async parseMessage(imapMessage: any, connectionId: string, attachmentExtractor: (message: any) => Promise<any[]>): Promise<ParsedMessage> {
    let headers: Record<string, string> = {};
    let parsedMail: ParsedMail | null = null;
    
    // Parse headers
    if (imapMessage.headers) {
      headers = this.parseHeaders(imapMessage.headers);
    }
    
    // Parse the full message if available
    if (imapMessage.body) {
      try {
        // Combine headers and body for full message parsing
        const fullMessage = `${imapMessage.headers || ''}\r\n\r\n${imapMessage.body}`;
        parsedMail = await this.parseRawMessage(fullMessage);
        
        // Update headers from parsed mail
        if (parsedMail.headers) {
          for (const [key, value] of parsedMail.headers) {
            headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : (value?.toString() || '');
          }
        }
      } catch (error) {
        console.warn('Failed to parse full message, using header-only parsing:', error);
      }
    }
    
    // Parse email addresses
    const from = parseFrom(headers.from || (this.extractAddressString(parsedMail?.from) || ''));
    const to = parseAddressList(headers.to || (this.extractAddressString(parsedMail?.to) || ''));
    const cc = parseAddressList(headers.cc || (this.extractAddressString(parsedMail?.cc) || ''));
    const bcc = parseAddressList(headers.bcc || (this.extractAddressString(parsedMail?.bcc) || ''));
    
    // Extract message content
    const textContent = parsedMail ? this.extractTextContent(parsedMail) : (imapMessage.body || '');
    const htmlContent = parsedMail ? this.extractHtmlContent(parsedMail) : this.processMessageBody(imapMessage.body || '');
    
    // Determine if message is unread
    const isUnread = imapMessage.flags ? !imapMessage.flags.includes('\\Seen') : true;
    
    // Parse date
    const receivedDate = parsedMail?.date ? 
                        parsedMail.date.toISOString() : 
                        (headers.date ? new Date(headers.date).toISOString() : new Date().toISOString());
    
    // Generate message and thread IDs
    const messageId = headers['message-id'] || 
                     parsedMail?.messageId || 
                     `<icloud-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@generated>`;
    
    const threadId = headers['x-gm-thrid'] || this.generateThreadId(headers);
    
    return {
      id: messageId,
      connectionId,
      title: headers.subject || parsedMail?.subject || '(No Subject)',
      subject: headers.subject || parsedMail?.subject || '(No Subject)',
      tags: [], // iCloud doesn't support tags like Gmail
      sender: from,
      to,
      cc,
      bcc,
      tls: true, // iCloud always uses TLS
      listUnsubscribe: headers['list-unsubscribe'],
      listUnsubscribePost: headers['list-unsubscribe-post'],
      receivedOn: receivedDate,
      unread: isUnread,
      body: textContent,
      processedHtml: htmlContent,
      blobUrl: '', // Not applicable for iCloud
      decodedBody: textContent,
      references: headers.references,
      inReplyTo: headers['in-reply-to'],
      replyTo: headers['reply-to'] || parsedMail?.replyTo?.text,
      messageId,
      threadId,
      attachments: await attachmentExtractor(imapMessage),
      isDraft: false
    };
  }
}
