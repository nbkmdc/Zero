import { useAtom, useAtomValue } from 'jotai';
import { threadAtom, syncConnectionAtom } from '@/store/sync';
import { useSyncService } from '@/lib/sync-service';
import { useActiveConnection } from '@/hooks/use-connections';
import { useCallback, useEffect } from 'react';
import { IncomingMessageType } from '@/types/sync';

export const useSyncThread = (threadId: string) => {
  const [threads] = useAtom(threadAtom);
  const syncConnection = useAtomValue(syncConnectionAtom);
  const { data: activeConnection } = useActiveConnection();
  const { sendSyncMessage } = useSyncService(activeConnection?.id || null);

  const thread = threads[threadId];

  const loadThread = useCallback(() => {
    if (!syncConnection.isConnected || !activeConnection?.id || !threadId) return;

    sendSyncMessage({
      type: IncomingMessageType.Mail_Get,
      data: {
        threadId,
      }
    });
  }, [threadId, syncConnection.isConnected, activeConnection?.id, sendSyncMessage]);

  useEffect(() => {
    if (syncConnection.isConnected && !thread) {
      loadThread();
    }
  }, [loadThread, syncConnection.isConnected, thread]);

  return {
    thread,
    isLoading: !thread && syncConnection.isConnected,
    loadThread,
  };
};
