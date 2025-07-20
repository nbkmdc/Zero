import { useAtom, useAtomValue } from 'jotai';
import { threadAtom, syncConnectionAtom } from '@/store/sync';
import { useSyncService } from '@/lib/sync-service';
import { useActiveConnection } from '@/hooks/use-connections';
import { useCallback, useEffect, useMemo } from 'react';
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

  const processedData = useMemo(() => {
    if (!thread) return null;
    
    const messages = thread.messages || [];
    const drafts = messages.filter((msg: any) => msg.labelIds?.includes('DRAFT'));
    const latestDraft = drafts.length > 0 ? drafts[drafts.length - 1] : null;
    
    return {
      ...thread,
      messages,
      latestDraft,
    };
  }, [thread]);

  const isGroupThread = useMemo(() => {
    if (!processedData?.messages) return false;
    const uniqueParticipants = new Set();
    processedData.messages.forEach((msg: any) => {
      if (msg.from) uniqueParticipants.add(msg.from.email);
      msg.to?.forEach((to: any) => uniqueParticipants.add(to.email));
      msg.cc?.forEach((cc: any) => uniqueParticipants.add(cc.email));
    });
    return uniqueParticipants.size > 2;
  }, [processedData]);

  return {
    data: processedData,
    isLoading: !thread && syncConnection.isConnected,
    isFetching: !thread && syncConnection.isConnected,
    refetch: loadThread,
    isGroupThread,
    latestDraft: processedData?.latestDraft || null,
  };
};

export const useThread = useSyncThread;
