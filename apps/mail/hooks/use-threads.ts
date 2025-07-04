import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backgroundQueueAtom, isThreadInBackgroundQueueAtom } from '@/store/backgroundQueue';
import type { IGetThreadResponse } from '../../server/src/lib/driver/types';
import { useSearchValue } from '@/hooks/use-search-value';
import { useTRPC } from '@/providers/query-provider';
import useSearchLabels from './use-labels-search';
import { useSession } from '@/lib/auth-client';
import { useAtom, useAtomValue } from 'jotai';
import { useSettings } from './use-settings';
import { usePrevious } from './use-previous';
import type { ParsedMessage } from '@/types';
import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';
import { useTheme } from 'next-themes';
import { useQueryState } from 'nuqs';

export const useThreads = () => {
  const { folder } = useParams<{ folder: string }>();
  const [searchValue] = useSearchValue();
  const [backgroundQueue] = useAtom(backgroundQueueAtom);
  const isInQueue = useAtomValue(isThreadInBackgroundQueueAtom);
  const trpc = useTRPC();
  const { labels, setLabels } = useSearchLabels();

  const threadsQuery = useInfiniteQuery(
    trpc.mail.listThreads.infiniteQueryOptions(
      {
        q: searchValue.value,
        folder,
        labelIds: labels,
      },
      {
        initialCursor: '',
        getNextPageParam: (lastPage) => lastPage?.nextPageToken ?? null,
        staleTime: 60 * 1000 * 60, // 1 minute
        refetchOnMount: true,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: false,
      },
    ),
  );

  // Flatten threads from all pages and sort by receivedOn date (newest first)

  const threads = useMemo(() => {
    return threadsQuery.data
      ? threadsQuery.data.pages
          .flatMap((e) => e.threads)
          .filter(Boolean)
          .filter((e) => !isInQueue(`thread:${e.id}`))
      : [];
  }, [threadsQuery.data, threadsQuery.dataUpdatedAt, isInQueue, backgroundQueue]);

  const isEmpty = useMemo(() => threads.length === 0, [threads]);
  const isReachingEnd =
    isEmpty ||
    (threadsQuery.data &&
      !threadsQuery.data.pages[threadsQuery.data.pages.length - 1]?.nextPageToken);

  const loadMore = async () => {
    if (threadsQuery.isLoading || threadsQuery.isFetching) return;
    await threadsQuery.fetchNextPage();
  };

  return [threadsQuery, threads, isReachingEnd, loadMore] as const;
};

export const useThread = (threadId: string | null, historyId?: string | null) => {
  const [_threadId] = useQueryState('threadId');
  const id = threadId ?? _threadId;
  const trpc = useTRPC();
  const { data: settings } = useSettings();
  //   const { resolvedTheme } = useTheme();

  const previousHistoryId = usePrevious(historyId ?? null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!historyId || !previousHistoryId || historyId === previousHistoryId || !id) return;
    queryClient.invalidateQueries({ queryKey: trpc.mail.get.queryKey({ id }) });
  }, [historyId, previousHistoryId, id, queryClient, trpc.mail.get]);

  const threadQuery = useQuery(
    trpc.mail.get.queryOptions(
      {
        id: id!,
      },
      {
        enabled: !!id,
        staleTime: 1000 * 60 * 60, // 60 minutes
      },
    ),
  );

  //   const { mutateAsync: processEmailContent } = useMutation(
  //     trpc.mail.processEmailContent.mutationOptions(),
  //   );

  //   const prefetchEmailContent = useMemo(
  //     () => async (message: ParsedMessage, isTrusted: boolean) => {
  //       return queryClient.prefetchQuery({
  //         queryKey: ['email-content', message.id, isTrusted, resolvedTheme],
  //         queryFn: async () => {
  //           const result = await processEmailContent({
  //             html: message.decodedBody ?? '',
  //             shouldLoadImages: isTrusted,
  //             theme: (resolvedTheme as 'light' | 'dark') || 'light',
  //           });

  //           return {
  //             html: result.processedHtml,
  //             hasBlockedImages: result.hasBlockedImages,
  //           };
  //         },
  //       });
  //     },
  //     [queryClient, processEmailContent, resolvedTheme],
  //   );

  const computedData = useMemo(() => {
    if (!threadQuery.data)
      return {
        isTrustedSender: false,
        latestDraft: undefined,
        isGroupThread: false,
        finalData: undefined,
      };

    const { data } = threadQuery;
    const latest = data.latest;

    const isTrustedSender =
      !!settings?.settings.externalImages ||
      !!settings?.settings.trustedSenders?.includes(latest?.sender.email ?? '');

    const latestDraft = latest?.id ? data.messages.findLast((e) => e.isDraft) : undefined;

    const isGroupThread = latest?.id
      ? [...(latest.to || []), ...(latest.cc || []), ...(latest.bcc || [])].length > 1
      : false;

    const finalData: IGetThreadResponse = {
      ...data,
      messages: data.messages.filter((e) => !e.isDraft),
    };

    return { isTrustedSender, latestDraft, isGroupThread, finalData };
  }, [threadQuery.data, settings]);

  //   useEffect(() => {
  //     const latest = threadQuery.data?.latest;
  //     if (!latest?.id) return;
  //     prefetchEmailContent(latest, computedData.isTrustedSender);
  //   }, [threadQuery.data?.latest?.id, prefetchEmailContent, computedData.isTrustedSender]);

  return {
    ...threadQuery,
    data: computedData.finalData,
    isGroupThread: computedData.isGroupThread,
    latestDraft: computedData.latestDraft,
  };
};
