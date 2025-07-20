import { useAtom, useAtomValue } from 'jotai';
import { threadListAtom, syncConnectionAtom } from '@/store/sync';
import { useSyncService } from '@/lib/sync-service';
import { useActiveConnection } from '@/hooks/use-connections';
import { useSearchValue } from '@/hooks/use-search-value';
import useSearchLabels from './use-labels-search';
import { useParams } from 'react-router';
import { useCallback, useEffect } from 'react';
import { IncomingMessageType } from '@/types/sync';

export const useSyncThreads = () => {
  const { folder } = useParams<{ folder: string }>();
  const [searchValue] = useSearchValue();
  const { labels } = useSearchLabels();
  const { data: activeConnection } = useActiveConnection();
  const [threadList, setThreadList] = useAtom(threadListAtom);
  const syncConnection = useAtomValue(syncConnectionAtom);
  const { sendSyncMessage } = useSyncService(activeConnection?.id || null);

  const currentFolderData = threadList[folder || 'inbox'] || {
    threads: [],
    nextPageToken: null,
    isLoading: false,
    lastUpdated: new Date(0),
  };

  const loadThreads = useCallback(() => {
    if (!syncConnection.isConnected || !activeConnection?.id) return;

    setThreadList(prev => ({
      ...prev,
      [folder || 'inbox']: { ...currentFolderData, isLoading: true }
    }));

    sendSyncMessage({
      type: IncomingMessageType.Mail_List,
      data: {
        folder: folder || 'inbox',
        query: searchValue.value,
        maxResults: 50,
        labelIds: labels,
        pageToken: '',
      }
    });
  }, [folder, searchValue.value, labels, syncConnection.isConnected, activeConnection?.id]);

  const loadMore = useCallback(() => {
    if (!currentFolderData.nextPageToken || currentFolderData.isLoading) return;
    
    sendSyncMessage({
      type: IncomingMessageType.Mail_List,
      data: {
        folder: folder || 'inbox',
        query: searchValue.value,
        maxResults: 50,
        labelIds: labels,
        pageToken: currentFolderData.nextPageToken,
      }
    });
  }, [currentFolderData.nextPageToken, folder, searchValue.value, labels]);

  useEffect(() => {
    if (syncConnection.isConnected) {
      loadThreads();
    }
  }, [loadThreads, syncConnection.isConnected]);

  return {
    threads: currentFolderData.threads,
    isLoading: currentFolderData.isLoading,
    isReachingEnd: !currentFolderData.nextPageToken,
    loadThreads,
    loadMore,
  };
};
