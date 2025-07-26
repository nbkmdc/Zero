export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

export interface ParsedDraft {
  id: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  content?: string;
  rawMessage?: {
    internalDate?: string | null;
  };
}

export interface ICloudFolderMapping {
  'INBOX': 'INBOX';
  'SENT': 'Sent Messages';
  'DRAFTS': 'Drafts';
  'TRASH': 'Deleted Messages';
  'SPAM': 'Junk';
  'ALL': 'INBOX';
}

export interface StandardFolder {
  name: string;
  displayName: string;
  type: 'system' | 'user';
}

export const ICLOUD_FOLDER_MAP: Record<string, string> = {
  'INBOX': 'INBOX',
  'SENT': 'Sent Messages',
  'DRAFTS': 'Drafts',
  'TRASH': 'Deleted Messages',
  'SPAM': 'Junk',
  'ALL': 'INBOX',
  'STARRED': 'INBOX',
  'IMPORTANT': 'INBOX'
};

export const STANDARD_FOLDERS: StandardFolder[] = [
  { name: 'INBOX', displayName: 'Inbox', type: 'system' },
  { name: 'Sent Messages', displayName: 'Sent', type: 'system' },
  { name: 'Drafts', displayName: 'Drafts', type: 'system' },
  { name: 'Deleted Messages', displayName: 'Trash', type: 'system' },
  { name: 'Junk', displayName: 'Junk', type: 'system' }
];

export const DEFAULT_FOLDERS = [
  'INBOX',
  'Sent Messages',
  'Drafts',
  'Deleted Messages',
  'Junk'
];

export const ICLOUD_IMAP_CONFIG = {
  host: 'imap.mail.me.com',
  port: 993,
  secure: true
} as const;

export const ICLOUD_SMTP_CONFIG = {
  host: 'smtp.mail.me.com',
  port: 587,
  secure: false
} as const;
