import { useCallback } from 'react';
import { useSyncService } from '@/lib/sync-service';
import { useActiveConnection } from '@/hooks/use-connections';
import { SyncActionType } from '@/types/sync';

export function useSyncActions() {
  const { data: activeConnection } = useActiveConnection();
  const { sendSyncMessage } = useSyncService(activeConnection?.id || null);

  const executeAction = useCallback(async (
    actionType: SyncActionType,
    threadIds: string[],
    params: any = {}
  ) => {
    if (!threadIds.length) return;

    sendSyncMessage({
      type: 'sync_action' as any,
      data: {
        action: actionType,
        threadIds,
        params,
      }
    });
  }, [sendSyncMessage]);

  const markAsRead = useCallback((threadIds: string[]) => {
    return executeAction(SyncActionType.MARK_READ, threadIds, { read: true });
  }, [executeAction]);

  const markAsUnread = useCallback((threadIds: string[]) => {
    return executeAction(SyncActionType.MARK_UNREAD, threadIds, { read: false });
  }, [executeAction]);

  const toggleStar = useCallback((threadIds: string[], starred: boolean) => {
    return executeAction(SyncActionType.TOGGLE_STAR, threadIds, { starred });
  }, [executeAction]);

  const toggleImportant = useCallback((threadIds: string[], important: boolean) => {
    return executeAction(SyncActionType.TOGGLE_IMPORTANT, threadIds, { important });
  }, [executeAction]);

  return {
    markAsRead,
    markAsUnread,
    toggleStar,
    toggleImportant,
    executeAction,
  };
}
