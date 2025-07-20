import { useCallback } from 'react';
import { useSyncService } from '@/lib/sync-service';
import { useActiveConnection } from '@/hooks/use-connections';
import { SyncActionType } from '@/types/sync';
import { useMail } from '@/components/mail/use-mail';
import { useQueryState } from 'nuqs';
import { toast } from 'sonner';
import useBackgroundQueue from '@/hooks/ui/use-background-queue';
import type { ThreadDestination } from '@/lib/thread-actions';

export function useDirectActions() {
  const { data: activeConnection } = useActiveConnection();
  const { sendSyncMessage } = useSyncService(activeConnection?.id || null);
  const [mail, setMail] = useMail();
  const [threadId, setThreadId] = useQueryState('threadId');
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const { addToQueue, deleteFromQueue } = useBackgroundQueue();

  const executeAction = useCallback(async (
    actionType: SyncActionType,
    threadIds: string[],
    params: any = {},
    toastMessage?: string
  ) => {
    if (!threadIds.length) return;

    threadIds.forEach(id => addToQueue(id));

    try {
      sendSyncMessage({
        type: 'sync_action' as any,
        data: {
          action: actionType,
          threadIds,
          params,
        }
      });

      if (toastMessage) {
        toast.success(toastMessage);
      }

      if (mail.bulkSelected.length > 0) {
        setMail((prev) => ({ ...prev, bulkSelected: [] }));
      }
    } catch (error) {
      console.error('Action failed:', error);
      toast.error('Action failed');
      threadIds.forEach(id => deleteFromQueue(id));
    }
  }, [sendSyncMessage, addToQueue, deleteFromQueue, mail.bulkSelected, setMail]);

  const directMarkAsRead = useCallback(
    async (threadIds: string[], silent = false) => {
      await executeAction(
        SyncActionType.MARK_READ, 
        threadIds, 
        { read: true }, 
        silent ? undefined : 'Marked as read'
      );
    },
    [executeAction]
  );

  const directMarkAsUnread = useCallback(
    async (threadIds: string[]) => {
      await executeAction(
        SyncActionType.MARK_UNREAD, 
        threadIds, 
        { read: false }, 
        'Marked as unread'
      );
    },
    [executeAction]
  );

  const directToggleStar = useCallback(
    async (threadIds: string[], starred: boolean) => {
      await executeAction(
        SyncActionType.TOGGLE_STAR, 
        threadIds, 
        { starred }, 
        starred ? 'Added to favorites' : 'Removed from favorites'
      );
    },
    [executeAction]
  );

  const directToggleImportant = useCallback(
    async (threadIds: string[], isImportant: boolean) => {
      await executeAction(
        SyncActionType.TOGGLE_IMPORTANT, 
        threadIds, 
        { important: isImportant }, 
        isImportant ? 'Marked as important' : 'Unmarked as important'
      );
    },
    [executeAction]
  );

  const directMoveThreadsTo = useCallback(
    async (threadIds: string[], currentFolder: string, destination: ThreadDestination) => {
      if (!threadIds.length || !destination) return;

      try {
        if (destination === 'archive') {
          await executeAction(
            SyncActionType.BULK_ARCHIVE, 
            threadIds, 
            {}, 
            'Archived'
          );
        } else if (destination === 'bin') {
          await executeAction(
            SyncActionType.BULK_DELETE, 
            threadIds, 
            {}, 
            'Moved to bin'
          );
        } else {
          const addLabels = destination === 'inbox' ? ['INBOX'] : destination === 'spam' ? ['SPAM'] : [];
          const removeLabels = currentFolder === 'inbox' ? ['INBOX'] : currentFolder === 'spam' ? ['SPAM'] : [];
          
          await executeAction(
            SyncActionType.MODIFY_LABELS,
            threadIds,
            { addLabels, removeLabels },
            destination === 'inbox' ? 'Moved to inbox' : 
            destination === 'spam' ? 'Moved to spam' : 
            'Moved successfully'
          );
        }

        if (threadId && threadIds.includes(threadId)) {
          setThreadId(null);
          setActiveReplyId(null);
        }
      } catch (error) {
        console.error('Failed to move threads:', error);
        toast.error('Failed to move emails');
      }
    },
    [executeAction, threadId, setThreadId, setActiveReplyId]
  );

  const directDeleteThreads = useCallback(
    async (threadIds: string[], _currentFolder: string) => {
      await executeAction(
        SyncActionType.BULK_DELETE, 
        threadIds, 
        {}, 
        'Moved to bin'
      );

      if (threadId && threadIds.includes(threadId)) {
        setThreadId(null);
        setActiveReplyId(null);
      }
    },
    [executeAction, threadId, setThreadId, setActiveReplyId]
  );

  const directToggleLabel = useCallback(
    async (threadIds: string[], labelId: string, add: boolean) => {
      if (!threadIds.length || !labelId) return;

      await executeAction(
        SyncActionType.MODIFY_LABELS,
        threadIds,
        {
          addLabels: add ? [labelId] : [],
          removeLabels: add ? [] : [labelId],
        },
        add
          ? `Label added${threadIds.length > 1 ? ` to ${threadIds.length} threads` : ''}`
          : `Label removed${threadIds.length > 1 ? ` from ${threadIds.length} threads` : ''}`
      );
    },
    [executeAction]
  );

  return {
    directMarkAsRead,
    directMarkAsUnread,
    directToggleStar,
    directMoveThreadsTo,
    directDeleteThreads,
    directToggleImportant,
    directToggleLabel,
  };
}
