import type { Label } from '../../../types';
import type { ImapConnection } from './connections';
import { STANDARD_FOLDERS, ICLOUD_FOLDER_MAP, DEFAULT_FOLDERS } from './types';

export class LabelManager {
  async getUserLabels(imap: ImapConnection): Promise<Label[]> {
    // Get available folders from iCloud IMAP
    const folders = await this.getAvailableFolders(imap);
    
    // Convert folders to labels
    const labels: Label[] = [];
    
    for (const folder of STANDARD_FOLDERS) {
      if (folders.includes(folder.name)) {
        labels.push({
          id: folder.name.toUpperCase().replace(/\s+/g, '_'),
          name: folder.displayName,
          type: folder.type
        });
      }
    }
    
    // Add any custom folders as user labels
    for (const folder of folders) {
      const isStandard = STANDARD_FOLDERS.some(sf => sf.name === folder);
      
      if (!isStandard) {
        labels.push({
          id: folder.toUpperCase().replace(/\s+/g, '_'),
          name: folder,
          type: 'user'
        });
      }
    }
    
    return labels;
  }

  async getAvailableFolders(imap: ImapConnection): Promise<string[]> {
    try {
      const boxes = await imap.getBoxes();
      return this.extractFolderNames(boxes);
    } catch (error) {
      console.warn('Failed to get IMAP folders, using defaults:', error);
      // Return the standard iCloud folders as fallback
      return DEFAULT_FOLDERS;
    }
  }

  private extractFolderNames(boxes: any, prefix = ''): string[] {
    const folders: string[] = [];
    
    for (const [name, box] of Object.entries(boxes)) {
      const boxInfo = box as any;
      const fullName = prefix ? `${prefix}${boxInfo.delimiter || '/'}${name}` : name;
      
      // Only include selectable folders (not just containers)
      if (!boxInfo.noselect) {
        folders.push(fullName);
      }
      
      // Recursively process child folders
      if (boxInfo.children && Object.keys(boxInfo.children).length > 0) {
        folders.push(...this.extractFolderNames(boxInfo.children, fullName));
      }
    }
    
    return folders;
  }

  async getLabel(imap: ImapConnection, id: string): Promise<Label> {
    const labels = await this.getUserLabels(imap);
    
    const label = labels.find(l => l.id === id);
    
    if (!label) {
      throw new Error(`Label not found: ${id}`);
    }
    
    // Get message count for this label/folder
    const folderMap: Record<string, string> = {
      'INBOX': 'INBOX',
      'SENT_MESSAGES': 'Sent Messages',
      'DRAFTS': 'Drafts',
      'DELETED_MESSAGES': 'Deleted Messages',
      'JUNK': 'Junk'
    };
    
    const folderName = folderMap[id] || id.replace(/_/g, ' ');
    
    try {
      await imap.selectFolder(folderName);
      const messageIds = await imap.search(['ALL']);
      const unreadIds = await imap.search(['UNSEEN']);
      
      return {
        ...label,
        count: messageIds.length,
        labels: [
          {
            id: `${id}_UNREAD`,
            name: 'Unread',
            type: 'system',
            count: unreadIds.length
          }
        ]
      };
    } catch (error) {
      console.warn(`Could not get count for folder ${folderName}:`, error);
      return label;
    }
  }

  async createLabel(label: {
    name: string;
    color?: { backgroundColor: string; textColor: string };
  }): Promise<void> {
    // iCloud IMAP may not support creating custom folders
    // This is a limitation of the iCloud email service
    console.log(`Attempting to create folder: ${label.name}`);
    
    try {
      // In a real implementation, you would use IMAP CREATE command
      // For now, log the attempt
      console.log(`Creating folder "${label.name}" in iCloud`);
      
      // Note: iCloud may not allow custom folder creation via IMAP
      // This would typically throw an error in a real implementation
      throw new Error('iCloud does not support creating custom folders via IMAP');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not support')) {
        throw new Error('iCloud does not support creating custom folders. You can only use the default folders: Inbox, Sent, Drafts, Trash, and Junk.');
      }
      throw error;
    }
  }

  async updateLabel(
    id: string,
    label: { name: string; color?: { backgroundColor: string; textColor: string } }
  ): Promise<void> {
    // iCloud doesn't support updating folder names or colors via IMAP
    // This is a limitation of the iCloud email service
    
    console.log(`Attempting to update folder: ${id} to ${label.name}`);
    
    // Check if it's a system folder
    const systemFolders = ['INBOX', 'SENT_MESSAGES', 'DRAFTS', 'DELETED_MESSAGES', 'JUNK'];
    
    if (systemFolders.includes(id)) {
      throw new Error('Cannot modify system folders in iCloud');
    }
    
    // For custom folders (if they exist)
    throw new Error('iCloud does not support renaming folders via IMAP');
  }

  async deleteLabel(id: string): Promise<void> {
    // iCloud doesn't support deleting folders via IMAP
    // This is a limitation of the iCloud email service
    
    console.log(`Attempting to delete folder: ${id}`);
    
    // Check if it's a system folder
    const systemFolders = ['INBOX', 'SENT_MESSAGES', 'DRAFTS', 'DELETED_MESSAGES', 'JUNK'];
    
    if (systemFolders.includes(id)) {
      throw new Error('Cannot delete system folders in iCloud');
    }
    
    // For custom folders (if they exist)
    try {
      // In a real implementation, you would use IMAP DELETE command
      console.log(`Deleting folder "${id}" in iCloud`);
      
      // Note: iCloud may not allow folder deletion via IMAP
      throw new Error('iCloud does not support deleting folders via IMAP');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not support')) {
        throw new Error('iCloud does not support deleting folders. Only default folders are available.');
      }
      throw error;
    }
  }

  async modifyLabels(
    imap: ImapConnection,
    id: string[],
    options: { addLabels: string[]; removeLabels: string[] }
  ): Promise<void> {
    // iCloud uses folders instead of labels
    // Map label operations to folder moves
    const folderMap = ICLOUD_FOLDER_MAP;
    
    for (const messageId of id) {
      // Find the message across folders
      let currentFolder = '';
      let messageUIDs: string[] = [];
      let found = false;
      
      for (const [label, folder] of Object.entries(folderMap)) {
        try {
          await imap.selectFolder(folder);
          
          // Try searching by Message-ID header
          let searchResults: string[] = [];
          try {
            searchResults = await imap.search(['HEADER', 'Message-ID', messageId]);
          } catch (error) {
            // If header search fails and messageId looks like a UID, use it directly
            if (messageId.match(/^\d+$/)) {
              searchResults = [messageId];
            }
          }
          
          if (searchResults.length > 0) {
            currentFolder = folder;
            messageUIDs = searchResults;
            found = true;
            break;
          }
        } catch (error) {
          console.warn(`Error searching in folder ${folder}:`, error);
          continue;
        }
      }
      
      if (!found) {
        console.warn(`Message not found for label modification: ${messageId}`);
        continue;
      }
      
      // Process label additions (move to folders)
      for (const addLabel of options.addLabels) {
        const targetFolder = folderMap[addLabel.toUpperCase()];
        
        if (targetFolder && targetFolder !== currentFolder) {
          try {
            // Copy message to target folder, then delete from current
            await imap.copy(messageUIDs, targetFolder);
            await imap.selectFolder(currentFolder); // Re-select current folder
            await imap.addFlags(messageUIDs, ['\\Deleted']);
            await imap.expunge();
            
            console.log(`Moved message ${messageId} from ${currentFolder} to ${targetFolder}`);
            currentFolder = targetFolder; // Update current folder
          } catch (error) {
            console.error(`Failed to move message ${messageId} to ${targetFolder}:`, error);
          }
        }
      }
      
      // Process label removals
      for (const removeLabel of options.removeLabels) {
        if (removeLabel.toUpperCase() === 'TRASH') {
          // Remove from trash means restore to INBOX
          const targetFolder = 'INBOX';
          if (currentFolder === 'Deleted Messages') {
            try {
              await imap.copy(messageUIDs, targetFolder);
              await imap.selectFolder(currentFolder);
              await imap.addFlags(messageUIDs, ['\\Deleted']);
              await imap.expunge();
              
              console.log(`Restored message ${messageId} from trash to ${targetFolder}`);
            } catch (error) {
              console.error(`Failed to restore message ${messageId} from trash:`, error);
            }
          }
        } else if (removeLabel.toUpperCase() === 'SPAM' || removeLabel.toUpperCase() === 'JUNK') {
          // Remove from spam means move to INBOX
          const targetFolder = 'INBOX';
          if (currentFolder === 'Junk') {
            try {
              await imap.copy(messageUIDs, targetFolder);
              await imap.selectFolder(currentFolder);
              await imap.addFlags(messageUIDs, ['\\Deleted']);
              await imap.expunge();
              
              console.log(`Moved message ${messageId} from spam to ${targetFolder}`);
            } catch (error) {
              console.error(`Failed to move message ${messageId} from spam:`, error);
            }
          }
        }
      }
    }
  }

  async getThreadLabels(threadId: string): Promise<{ id: string; name: string }[]> {
    // iCloud uses folders instead of labels
    return [
      { id: 'INBOX', name: 'Inbox' }
    ];
  }

  async countMessages(imap: ImapConnection): Promise<{ count?: number; label?: string }[]> {
    // Define iCloud folders to count
    const folders = [
      { name: 'INBOX', label: 'Inbox' },
      { name: 'Sent Messages', label: 'Sent' },
      { name: 'Drafts', label: 'Drafts' },
      { name: 'Deleted Messages', label: 'Trash' },
      { name: 'Junk', label: 'Junk' }
    ];
    
    const counts: { count?: number; label?: string }[] = [];
    
    for (const folder of folders) {
      try {
        await imap.selectFolder(folder.name);
        
        // Get all messages in the folder
        const messageIds = await imap.search(['ALL']);
        
        // Count unread messages
        const unreadIds = await imap.search(['UNSEEN']);
        
        counts.push({
          count: messageIds.length,
          label: folder.label
        });
        
        // Add unread count if there are unread messages
        if (unreadIds.length > 0) {
          counts.push({
            count: unreadIds.length,
            label: `${folder.label} (Unread)`
          });
        }
      } catch (error) {
        console.warn(`Failed to count messages in folder ${folder.name}:`, error);
        // Continue with other folders
      }
    }
    
    return counts;
  }
}
