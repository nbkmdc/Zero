import { useAtomValue } from 'jotai';
import { syncConnectionAtom, threadListAtom } from '@/store/sync';
import { useSyncService } from '@/lib/sync-service';
import { useActiveConnection } from '@/hooks/use-connections';
import { useCallback } from 'react';
import { IncomingMessageType } from '@/types/sync';

export const useSyncDemo = () => {
  const { data: activeConnection } = useActiveConnection();
  const syncConnection = useAtomValue(syncConnectionAtom);
  const threadList = useAtomValue(threadListAtom);
  const { sendSyncMessage } = useSyncService(activeConnection?.id || null);

  const testConnection = useCallback(() => {
    if (!syncConnection.isConnected || !activeConnection?.id) return;

    sendSyncMessage({
      type: IncomingMessageType.Mail_List,
      data: {
        folder: 'inbox',
        query: '',
        maxResults: 10,
        labelIds: [],
        pageToken: '',
      }
    });
  }, [syncConnection.isConnected, activeConnection?.id, sendSyncMessage]);

  return {
    isConnected: syncConnection.isConnected,
    connectionId: syncConnection.connectionId,
    threadCount: Object.keys(threadList).length,
    testConnection,
  };
};
