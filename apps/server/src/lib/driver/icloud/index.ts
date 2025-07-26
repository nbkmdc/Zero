// Main iCloud Mail Manager export
export { ICloudMailManager } from './manager';

// Export types for external use
export type {
  ImapConfig,
  SmtpConfig,
  ICloudFolderMapping,
  StandardFolder,
  ParsedDraft
} from './types';

// Export utility classes for advanced usage
export { ImapConnection, SmtpConnection } from './connections';
export { MessageParser } from './message-parser';
export { AttachmentHandler } from './attachment-handler';
export { SearchUtils } from './search-utils';
export { LabelManager } from './label-manager';
export { DraftManager, SpamManager } from './draft-spam-manager';
export { EmailSender } from './email-sender';
