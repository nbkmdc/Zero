import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { queryKeys, warmCache } from '@/lib/query-config';
import { useQueryClient } from '@tanstack/react-query';
import type { ParsedMessage } from '@/types';
import { useThreads } from './use-threads';

interface VirtualizedThreadsOptions {
  overscan?: number;
  itemHeight?: number;
  preloadDistance?: number;
}

export function useVirtualizedThreads(options: VirtualizedThreadsOptions = {}) {
  const { overscan = 5, itemHeight = 72, preloadDistance = 10 } = options;
  const queryClient = useQueryClient();
  const [threadsQuery, threads, isReachingEnd, loadMore] = useThreads();

  // Track visible range
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visible items based on scroll position
  const visibleItems = useMemo(() => {
    if (!threads.length) return [];

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      threads.length,
      Math.ceil((scrollTop + (containerRef.current?.clientHeight || 800)) / itemHeight) + overscan,
    );

    setVisibleRange({ start, end });
    return threads.slice(start, end).map((thread, index) => ({
      ...thread,
      virtualIndex: start + index,
    }));
  }, [threads, scrollTop, itemHeight, overscan]);

  // Preload thread data for visible items
  const preloadedThreadIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const threadIds = visibleItems.map((item) => item.id);
    const newThreadIds = threadIds.filter((id) => !preloadedThreadIds.current.has(id));

    if (newThreadIds.length > 0) {
      warmCache(queryClient, newThreadIds);
      newThreadIds.forEach((id) => preloadedThreadIds.current.add(id));
    }

    // Clean up old preloaded data
    if (preloadedThreadIds.current.size > 100) {
      const currentIds = new Set(threadIds);
      preloadedThreadIds.current.forEach((id) => {
        if (!currentIds.has(id)) {
          preloadedThreadIds.current.delete(id);
        }
      });
    }
  }, [visibleItems, queryClient]);

  // Infinite scroll handler
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const newScrollTop = target.scrollTop;
      setScrollTop(newScrollTop);

      // Check if we need to load more
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;
      const scrollBottom = newScrollTop + clientHeight;

      if (scrollBottom >= scrollHeight - itemHeight * preloadDistance && !isReachingEnd) {
        loadMore();
      }
    },
    [itemHeight, preloadDistance, isReachingEnd, loadMore],
  );

  // Optimized thread item renderer
  const renderThreadItem = useCallback(
    (thread: ParsedMessage & { virtualIndex: number }, index: number) => {
      const style = {
        position: 'absolute' as const,
        top: thread.virtualIndex * itemHeight,
        height: itemHeight,
        width: '100%',
      };

      return { thread, style, index };
    },
    [itemHeight],
  );

  // Virtual list dimensions
  const totalHeight = threads.length * itemHeight;
  const startIndex = visibleRange.start;
  const endIndex = visibleRange.end;

  // Scroll to specific thread
  const scrollToThread = useCallback(
    (threadId: string) => {
      const index = threads.findIndex((thread) => thread.id === threadId);
      if (index !== -1 && containerRef.current) {
        const scrollTop = index * itemHeight;
        containerRef.current.scrollTop = scrollTop;
      }
    },
    [threads, itemHeight],
  );

  // Get thread at index
  const getThreadAt = useCallback(
    (index: number) => {
      return threads[index];
    },
    [threads],
  );

  // Bulk operations optimization
  const bulkUpdateThreads = useCallback(
    (threadIds: string[], update: Partial<ParsedMessage>) => {
      threadIds.forEach((threadId) => {
        queryClient.setQueryData(queryKeys.threads.preview(threadId), (oldData: any) =>
          oldData ? { ...oldData, ...update } : undefined,
        );
      });
    },
    [queryClient],
  );

  return {
    // Data
    threads,
    visibleItems,
    totalHeight,
    startIndex,
    endIndex,

    // State
    isLoading: threadsQuery.isLoading,
    isFetching: threadsQuery.isFetching,
    isFetchingNextPage: threadsQuery.isFetchingNextPage,
    isReachingEnd,

    // Handlers
    handleScroll,
    loadMore,
    scrollToThread,
    getThreadAt,
    bulkUpdateThreads,

    // Refs
    containerRef,

    // Utils
    renderThreadItem,
  };
}

// Hook for optimized thread selection
export function useOptimizedThreadSelection() {
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const selectThread = useCallback(
    (threadId: string, index: number, mode: 'single' | 'multi' | 'range' = 'single') => {
      setSelectedThreadIds((prev) => {
        const newSet = new Set(prev);

        switch (mode) {
          case 'single':
            newSet.clear();
            newSet.add(threadId);
            break;
          case 'multi':
            if (newSet.has(threadId)) {
              newSet.delete(threadId);
            } else {
              newSet.add(threadId);
            }
            break;
          case 'range':
            if (lastSelectedIndex !== null) {
              const start = Math.min(lastSelectedIndex, index);
              const end = Math.max(lastSelectedIndex, index);
              // Note: This would need thread list access to work properly
              // For now, just add the single thread
              newSet.add(threadId);
            } else {
              newSet.add(threadId);
            }
            break;
        }

        return newSet;
      });

      setLastSelectedIndex(index);
    },
    [lastSelectedIndex],
  );

  const clearSelection = useCallback(() => {
    setSelectedThreadIds(new Set());
    setLastSelectedIndex(null);
  }, []);

  const isThreadSelected = useCallback(
    (threadId: string) => {
      return selectedThreadIds.has(threadId);
    },
    [selectedThreadIds],
  );

  return {
    selectedThreadIds: Array.from(selectedThreadIds),
    selectThread,
    clearSelection,
    isThreadSelected,
    selectedCount: selectedThreadIds.size,
  };
}
