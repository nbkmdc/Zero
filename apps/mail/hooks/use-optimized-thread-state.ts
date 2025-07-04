import { useQuery } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { backgroundQueueAtom } from '@/store/backgroundQueue';
import { useMemo } from 'react';

interface OptimizedThreadStateOptions {
  enabled?: boolean;
}

export function useOptimisticThreadState(
  threadId: string,
  options: OptimizedThreadStateOptions = {}
) {
  const { enabled = true } = options;
  const backgroundQueue = useAtomValue(backgroundQueueAtom);

  // Only compute optimistic state when enabled (for visible items)
  const optimisticState = useMemo(() => {
    if (!enabled || !threadId) {
      return {
        optimisticStarred: null,
        optimisticImportant: null,
        optimisticRead: null,
        optimisticLabels: null,
      };
    }

    // Check if this thread has pending operations
    const threadOperations = backgroundQueue.filter(op => 
      op.type === 'thread' && op.threadIds?.includes(threadId)
    );

    let optimisticStarred = null;
    let optimisticImportant = null;
    let optimisticRead = null;
    let optimisticLabels = null;

    // Process operations in order
    threadOperations.forEach(op => {
      switch (op.action) {
        case 'star':
          optimisticStarred = true;
          break;
        case 'unstar':
          optimisticStarred = false;
          break;
        case 'important':
          optimisticImportant = true;
          break;
        case 'unimportant':
          optimisticImportant = false;
          break;
        case 'read':
          optimisticRead = true;
          break;
        case 'unread':
          optimisticRead = false;
          break;
        case 'label':
          if (op.labelIds) {
            optimisticLabels = {
              addedLabelIds: op.labelIds,
              removedLabelIds: [],
            };
          }
          break;
        case 'unlabel':
          if (op.labelIds) {
            optimisticLabels = {
              addedLabelIds: [],
              removedLabelIds: op.labelIds,
            };
          }
          break;
      }
    });

    return {
      optimisticStarred,
      optimisticImportant,
      optimisticRead,
      optimisticLabels,
    };
  }, [enabled, threadId, backgroundQueue]);

  return optimisticState;
}

// Lightweight thread preview data hook
export function useThreadPreview(threadId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['thread-preview', threadId],
    queryFn: async () => {
      // This would typically fetch minimal thread data
      // For now, return mock data or integrate with your existing API
      return {
        id: threadId,
        hasUnread: false,
        totalReplies: 1,
        labels: [],
        latest: null,
      };
    },
    enabled: enabled && !!threadId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => ({
      hasUnread: data.hasUnread,
      totalReplies: data.totalReplies,
      labels: data.labels,
      latest: data.latest,
    }),
  });
}
