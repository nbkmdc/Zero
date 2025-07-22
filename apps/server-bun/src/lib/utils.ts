import { kvNamespaces } from './cloudflare-proxy';
import { EProviders } from '../types';

export async function markAccountAsSubscribed(
  connectionId: string,
  providerId: EProviders,
): Promise<void> {
  return await kvNamespaces.subscribed_accounts.put(
    `${connectionId}__${providerId}`,
    new Date().toISOString(),
  );
}

export async function cleanupOnFailure(connectionId: string): Promise<void> {
  return await kvNamespaces.subscribed_accounts.delete(connectionId);
}

export const FOLDERS = {
  INBOX: 'INBOX',
  SENT: 'SENT',
  DRAFTS: 'DRAFTS',
  SPAM: 'SPAM',
  TRASH: 'TRASH',
  IMPORTANT: 'IMPORTANT',
  STARRED: 'STARRED',
  UNREAD: 'UNREAD',
  SNOOZED: 'SNOOZED',
};

export const defaultLabels = [
  { id: 'INBOX', name: 'Inbox', type: 'system' },
  { id: 'SENT', name: 'Sent', type: 'system' },
  { id: 'DRAFTS', name: 'Drafts', type: 'system' },
  { id: 'SPAM', name: 'Spam', type: 'system' },
  { id: 'TRASH', name: 'Trash', type: 'system' },
  { id: 'IMPORTANT', name: 'Important', type: 'system' },
  { id: 'STARRED', name: 'Starred', type: 'system' },
  { id: 'UNREAD', name: 'Unread', type: 'system' },
  { id: 'SNOOZED', name: 'Snoozed', type: 'system' },
];
