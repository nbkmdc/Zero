import { QueryClient } from '@tanstack/react-query';

// Optimized query client configuration for mail list performance
export const createOptimizedQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Global defaults for better performance
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors
          if (error && typeof error === 'object' && 'status' in error) {
            const status = error.status as number;
            if (status >= 400 && status < 500) return false;
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        retry: 1,
        retryDelay: 1000,
      },
    },
  });
};

// Query key factories for consistent cache management
export const queryKeys = {
  threads: {
    all: ['threads'] as const,
    lists: () => [...queryKeys.threads.all, 'list'] as const,
    list: (folder: string, query?: string, labels?: string[]) => 
      [...queryKeys.threads.lists(), folder, query, labels] as const,
    previews: () => [...queryKeys.threads.all, 'preview'] as const,
    preview: (id: string) => [...queryKeys.threads.previews(), id] as const,
    details: () => [...queryKeys.threads.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.threads.details(), id] as const,
  },
  emails: {
    all: ['emails'] as const,
    content: (id: string, trusted: boolean, theme: string) => 
      [...queryKeys.emails.all, 'content', id, trusted, theme] as const,
    template: (html: string, trusted: boolean) => 
      [...queryKeys.emails.all, 'template', html, trusted] as const,
  },
  drafts: {
    all: ['drafts'] as const,
    detail: (id: string) => [...queryKeys.drafts.all, id] as const,
  },
  labels: {
    all: ['labels'] as const,
    byIds: (ids: string[]) => [...queryKeys.labels.all, ids] as const,
  },
  settings: {
    all: ['settings'] as const,
    user: () => [...queryKeys.settings.all, 'user'] as const,
  },
  notes: {
    all: ['notes'] as const,
    byThread: (threadId: string) => [...queryKeys.notes.all, threadId] as const,
  },
} as const;

// Cache invalidation helpers
export const invalidateThreads = (queryClient: QueryClient, folder?: string) => {
  if (folder) {
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.threads.list(folder),
      exact: false 
    });
  } else {
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.threads.lists(),
      exact: false 
    });
  }
};

export const invalidateThread = (queryClient: QueryClient, threadId: string) => {
  queryClient.invalidateQueries({ 
    queryKey: queryKeys.threads.detail(threadId) 
  });
  queryClient.invalidateQueries({ 
    queryKey: queryKeys.threads.preview(threadId) 
  });
};

// Prefetch helpers
export const prefetchThreadPreview = (
  queryClient: QueryClient, 
  threadId: string,
  data: any
) => {
  queryClient.setQueryData(queryKeys.threads.preview(threadId), {
    hasUnread: data.hasUnread,
    totalReplies: data.totalReplies,
    labels: data.labels,
    latest: data.latest,
  });
};

// Memory optimization - limit cache size
export const optimizeQueryCache = (queryClient: QueryClient) => {
  const cache = queryClient.getQueryCache();
  
  // Remove old thread previews when cache gets too large
  if (cache.getAll().length > 1000) {
    const threadPreviews = cache.findAll({ 
      queryKey: queryKeys.threads.previews(),
      stale: true 
    });
    
    // Remove oldest stale previews
    threadPreviews
      .sort((a, b) => (a.state.dataUpdatedAt || 0) - (b.state.dataUpdatedAt || 0))
      .slice(0, Math.floor(threadPreviews.length * 0.3))
      .forEach(query => {
        queryClient.removeQueries({ queryKey: query.queryKey });
      });
  }
};

// Background cache warming
export const warmCache = (queryClient: QueryClient, visibleThreadIds: string[]) => {
  visibleThreadIds.forEach(threadId => {
    // Prefetch thread preview if not already cached
    if (!queryClient.getQueryData(queryKeys.threads.preview(threadId))) {
      queryClient.prefetchQuery({
        queryKey: queryKeys.threads.preview(threadId),
        queryFn: async () => {
          // Minimal data fetch for preview
          return {
            hasUnread: false,
            totalReplies: 1,
            labels: [],
            latest: null,
          };
        },
        staleTime: 5 * 60 * 1000,
      });
    }
  });
};
