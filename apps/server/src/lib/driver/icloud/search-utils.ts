export class SearchUtils {
  parseSearchQuery(query: string): string[] {
    // Convert common search terms to IMAP search criteria
    const criteria: string[] = [];
    
    // Basic text search
    if (query && !query.includes(':')) {
      // Search in both subject and body for basic queries
      return ['OR', 'SUBJECT', query, 'BODY', query];
    }
    
    // Parse Gmail-style search syntax
    const terms = query.split(/\s+/);
    let currentCriteria: string[] = [];
    
    for (const term of terms) {
      if (term.startsWith('subject:')) {
        const subject = term.substring(8).replace(/['"]/g, '');
        currentCriteria.push('SUBJECT', subject);
      } else if (term.startsWith('from:')) {
        const from = term.substring(5).replace(/['"]/g, '');
        currentCriteria.push('FROM', from);
      } else if (term.startsWith('to:')) {
        const to = term.substring(3).replace(/['"]/g, '');
        currentCriteria.push('TO', to);
      } else if (term.startsWith('cc:')) {
        const cc = term.substring(3).replace(/['"]/g, '');
        currentCriteria.push('CC', cc);
      } else if (term === 'is:unread') {
        currentCriteria.push('UNSEEN');
      } else if (term === 'is:read') {
        currentCriteria.push('SEEN');
      } else if (term === 'is:draft') {
        currentCriteria.push('DRAFT');
      } else if (term === 'is:starred' || term === 'is:flagged') {
        currentCriteria.push('FLAGGED');
      } else if (term.startsWith('newer_than:')) {
        const daysStr = term.substring(11).replace('d', '');
        const days = parseInt(daysStr, 10);
        if (!isNaN(days)) {
          const date = new Date();
          date.setDate(date.getDate() - days);
          const dateStr = date.toISOString().split('T')[0].replace(/-/g, '-');
          currentCriteria.push('SINCE', dateStr);
        }
      } else if (term.startsWith('older_than:')) {
        const daysStr = term.substring(11).replace('d', '');
        const days = parseInt(daysStr, 10);
        if (!isNaN(days)) {
          const date = new Date();
          date.setDate(date.getDate() - days);
          const dateStr = date.toISOString().split('T')[0].replace(/-/g, '-');
          currentCriteria.push('BEFORE', dateStr);
        }
      } else if (term.startsWith('has:')) {
        const attachment = term.substring(4);
        if (attachment === 'attachment') {
          // IMAP doesn't have a direct "has attachment" search
          // We can try searching for common attachment indicators
          currentCriteria.push('OR', 'HEADER', 'Content-Type', 'multipart/mixed', 'HEADER', 'Content-Disposition', 'attachment');
        }
      } else if (term.includes('@')) {
        // Email address search - check both FROM and TO
        currentCriteria.push('OR', 'FROM', term, 'TO', term);
      } else if (term.length > 0) {
        // General text search in body
        currentCriteria.push('BODY', term);
      }
    }
    
    // If we have multiple criteria, combine them with AND logic
    if (currentCriteria.length === 0) {
      return ['ALL'];
    } else if (currentCriteria.length <= 2) {
      return currentCriteria;
    } else {
      // For multiple criteria, we need to build a proper IMAP search expression
      // For simplicity, we'll use AND logic by default
      return currentCriteria;
    }
  }

  buildSearchCriteria(params: {
    query?: string;
    labelIds?: string[];
    folder?: string;
  }): string[] {
    let searchCriteria: string[] = ['ALL'];
    
    if (params.query) {
      searchCriteria = this.parseSearchQuery(params.query);
    }
    
    // Add folder-specific criteria if needed
    if (params.folder) {
      // Folder selection is handled by selectFolder, not search criteria
      // But we could add folder-specific logic here if needed
    }
    
    return searchCriteria;
  }

  async performSearch(
    imap: any,
    criteria: string[]
  ): Promise<string[]> {
    try {
      return await imap.search(criteria);
    } catch (error) {
      console.warn('IMAP search failed, falling back to ALL:', error);
      // Fallback to get all messages if search fails
      try {
        return await imap.search(['ALL']);
      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
        return [];
      }
    }
  }

  groupMessagesByThread(
    messages: any[],
    parseHeaders: (headerString: string) => Record<string, string>,
    generateThreadId: (headers: Record<string, string>) => string
  ): Map<string, { id: string; historyId: string | null; $raw?: unknown }> {
    const threadsMap = new Map<string, { id: string; historyId: string | null; $raw?: unknown }>();
    
    for (const message of messages) {
      try {
        const headers = parseHeaders(message.headers || '');
        const threadId = generateThreadId(headers);
        
        if (!threadsMap.has(threadId)) {
          threadsMap.set(threadId, {
            id: threadId,
            historyId: null, // iCloud doesn't have history IDs
            $raw: message
          });
        } else {
          // Update with the most recent message
          const existingThread = threadsMap.get(threadId)!;
          const existingDate = this.extractMessageDate(existingThread.$raw);
          const currentDate = this.extractMessageDate(message);
          
          if (currentDate > existingDate) {
            threadsMap.set(threadId, {
              id: threadId,
              historyId: null,
              $raw: message
            });
          }
        }
      } catch (error) {
        console.warn('Error processing message for threading:', error);
        // Include the message anyway with a fallback thread ID
        const fallbackId = `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        threadsMap.set(fallbackId, {
          id: fallbackId,
          historyId: null,
          $raw: message
        });
      }
    }
    
    return threadsMap;
  }

  private extractMessageDate(messageRaw: any): Date {
    try {
      if (messageRaw?.envelope?.date) {
        return new Date(messageRaw.envelope.date);
      }
      
      if (messageRaw?.headers) {
        const headers = typeof messageRaw.headers === 'string' 
          ? this.parseHeaderString(messageRaw.headers)
          : messageRaw.headers;
        
        if (headers.date) {
          return new Date(headers.date);
        }
      }
      
      // Fallback to current time
      return new Date();
    } catch (error) {
      return new Date();
    }
  }

  private parseHeaderString(headerString: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = headerString.split('\r\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^([^:]+):\s*(.*)$/);
      
      if (match) {
        const [, name, value] = match;
        headers[name.toLowerCase()] = value.trim();
      }
    }
    
    return headers;
  }

  sortThreadsByDate(threads: { id: string; historyId: string | null; $raw?: unknown }[]): typeof threads {
    return threads.sort((a, b) => {
      const dateA = this.extractMessageDate(a.$raw);
      const dateB = this.extractMessageDate(b.$raw);
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });
  }

  applyPagination<T>(
    items: T[],
    pageToken?: string | number,
    maxResults: number = 50
  ): {
    paginatedItems: T[];
    nextPageToken: string | null;
    startIndex: number;
    endIndex: number;
  } {
    const startIndex = typeof pageToken === 'number' ? pageToken : 
                       typeof pageToken === 'string' ? parseInt(pageToken, 10) || 0 : 0;
    const endIndex = Math.min(startIndex + maxResults, items.length);
    const paginatedItems = items.slice(startIndex, endIndex);
    const nextPageToken = endIndex < items.length ? endIndex.toString() : null;
    
    return {
      paginatedItems,
      nextPageToken,
      startIndex,
      endIndex
    };
  }
}
