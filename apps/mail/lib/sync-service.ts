import { usePartySocket } from 'partysocket/react';
import { useAtom, useSetAtom } from 'jotai';
import { syncConnectionAtom, threadAtom, threadListAtom } from '@/store/sync';
import { IncomingMessageType, OutgoingMessageType } from '@/types/sync';
import useBackgroundQueue from '@/hooks/ui/use-background-queue';

export enum SyncMessageType {
  SYNC_THREADS = 'sync_threads',
  SYNC_THREAD = 'sync_thread',
  SYNC_ACTION = 'sync_action',
}

export type SyncMessage = {
  type: SyncMessageType | IncomingMessageType | string;
  data: any;
  requestId?: string;
};

export function useSyncService(connectionId: string | null) {
  const [syncConnection, setSyncConnection] = useAtom(syncConnectionAtom);
  const setThread = useSetAtom(threadAtom);
  const setThreadList = useSetAtom(threadListAtom);
  const { deleteFromQueue } = useBackgroundQueue();

  const socket = usePartySocket({
    party: 'zero-agent',
    room: connectionId ? String(connectionId) : 'general',
    prefix: 'agents',
    host: (import.meta as any).env.VITE_PUBLIC_BACKEND_URL!,
    onOpen: () => {
      setSyncConnection(prev => ({ ...prev, isConnected: true, connectionId }));
    },
    onClose: () => {
      setSyncConnection(prev => ({ ...prev, isConnected: false }));
    },
    onMessage: (message: MessageEvent<string>) => {
      try {
        const { type, data } = JSON.parse(message.data);
        
        switch (type) {
          case OutgoingMessageType.Mail_List:
            setThreadList(prev => ({
              ...prev,
              [data.folder]: {
                threads: data.threads,
                nextPageToken: data.nextPageToken,
                isLoading: false,
                lastUpdated: new Date(),
              }
            }));
            break;
            
          case OutgoingMessageType.Mail_Get:
            setThread(prev => ({
              ...prev,
              [data.threadId]: data.thread
            }));
            break;
            
          case 'sync_action_complete':
            console.log('Sync action completed:', data);
            if (data.threadIds && Array.isArray(data.threadIds)) {
              data.threadIds.forEach((threadId: string) => {
                deleteFromQueue(threadId);
              });
            }
            break;
        }
      } catch (error) {
        console.error('Sync service message error:', error);
      }
    },
  });

  const sendSyncMessage = (message: SyncMessage) => {
    if (socket && syncConnection.isConnected) {
      socket.send(JSON.stringify(message));
    }
  };

  return {
    isConnected: syncConnection.isConnected,
    sendSyncMessage,
  };
}
