import {
  cn,
  FOLDERS,
  formatDate,
  getEmailLogo,
  getMainSearchTerm,
  parseNaturalLanguageSearch,
} from '@/lib/utils';
import {
  Archive2,
  ExclamationCircle,
  GroupPeople,
  Star2,
  Trash,
  PencilCompose,
} from '../icons/icons';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import { useOptimisticThreadState } from '@/components/mail/optimistic-thread-state';
import { focusedIndexAtom, useMailNavigation } from '@/hooks/use-mail-navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MailSelectMode, ParsedMessage, ThreadProps } from '@/types';
import { ThreadContextMenu } from '@/components/context/thread-context';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useMail, type Config } from '@/components/mail/use-mail';
import { type ThreadDestination } from '@/lib/thread-actions';
import { useThreads } from '@/hooks/use-threads';
import { useSearchValue } from '@/hooks/use-search-value';
import { highlightText } from '@/lib/email-utils.client';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { AnimatePresence, motion } from 'motion/react';
import { useTRPC } from '@/providers/query-provider';
import { useThreadLabels } from '@/hooks/use-labels';
import { template } from '@/lib/email-utils.client';
import { useSettings } from '@/hooks/use-settings';
import { useThreadNotes } from '@/hooks/use-notes';
import { useKeyState } from '@/hooks/use-hot-key';
import { VList, type VListHandle } from 'virtua';
import { RenderLabels } from './render-labels';
import { Badge } from '@/components/ui/badge';
import { useDraft } from '@/hooks/use-drafts';
import { Check, Star } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { StickyNote } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { useParams } from 'react-router';
import { useTheme } from 'next-themes';
import { Button } from '../ui/button';
import { useQueryState } from 'nuqs';
import { Categories } from './mail';
import { useAtom } from 'jotai';

// Optimized thread component with selective data fetching
const OptimizedThread = memo(
  function OptimizedThread({
    message,
    onClick,
    isKeyboardFocused,
    index,
  }: ThreadProps & { index?: number }) {
    const [searchValue] = useSearchValue();
    const { folder } = useParams<{ folder: string }>();
    const [id] = useQueryState('threadId');
    const [focusedIndex] = useAtom(focusedIndexAtom);
    const trpc = useTRPC();
    const { data: settings } = useSettings();
    const queryClient = useQueryClient();

    const isSelected = useMemo(() => id === message.id, [id, message.id]);
    const isVisible = useMemo(() => 
      Math.abs((index || 0) - (focusedIndex || 0)) < 10 || isSelected,
      [index, focusedIndex, isSelected]
    );

    // Only fetch thread data for visible/selected items
    const threadQuery = useQuery({
      queryKey: ['thread-preview', message.id],
      queryFn: async () => {
        // Use cached data if available
        const cached = queryClient.getQueryData(trpc.mail.get.queryKey({ id: message.id }));
        if (cached) return cached;

        // Fetch minimal thread data for list view
        return trpc.mail.get.query({ id: message.id });
      },
      enabled: isVisible,
      staleTime: 5 * 60 * 1000, // 5 minutes
      select: (data) => ({
        latest: data?.latest,
        hasUnread: data?.hasUnread,
        totalReplies: data?.totalReplies,
        labels: data?.labels,
      }),
    });

    const threadData = threadQuery.data;
    const latestMessage = threadData?.latest || message;

    // Memoized computed values
    const computedData = useMemo(() => {
      if (!threadData) return { 
        displayUnread: false, 
        isGroupThread: false, 
        displayStarred: false,
        displayImportant: false,
        cleanName: '',
        isTrustedSender: false
      };

      const displayUnread = threadData.hasUnread ?? false;
      const isGroupThread = latestMessage ? [
        ...(latestMessage.to || []),
        ...(latestMessage.cc || []),
        ...(latestMessage.bcc || []),
      ].length > 1 : false;

      const displayStarred = latestMessage?.tags?.some((tag) => tag.name === 'STARRED') ?? false;
      const displayImportant = latestMessage?.tags?.some((tag) => tag.name === 'IMPORTANT') ?? false;
      const cleanName = latestMessage?.sender?.name?.trim()?.replace(/^['"]|['"]$/g, '') || '';
      const isTrustedSender = 
        !!settings?.externalImages ||
        !!settings?.trustedSenders?.includes(latestMessage?.sender?.email ?? '');

      return {
        displayUnread,
        isGroupThread,
        displayStarred,
        displayImportant,
        cleanName,
        isTrustedSender,
      };
    }, [threadData, latestMessage, settings]);

    // Optimistic state only for visible items
    const optimisticState = useOptimisticThreadState(message.id, { enabled: isVisible });

    // Event handlers
    const { optimisticToggleStar, optimisticToggleImportant, optimisticMoveThreadsTo } =
      useOptimisticActions();

    const handleToggleStar = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        optimisticToggleStar([message.id], !computedData.displayStarred);
      },
      [message.id, computedData.displayStarred, optimisticToggleStar],
    );

    const handleToggleImportant = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        optimisticToggleImportant([message.id], !computedData.displayImportant);
      },
      [message.id, computedData.displayImportant, optimisticToggleImportant],
    );

    const moveThreadTo = useCallback(
      async (destination: ThreadDestination) => {
        optimisticMoveThreadsTo([message.id], folder ?? '', destination);
      },
      [message.id, folder, optimisticMoveThreadsTo],
    );

    // Render skeleton while loading
    if (!threadData && threadQuery.isLoading) {
      return (
        <div className="select-none border-b md:my-1 md:border-none">
          <div className="mx-1 flex cursor-pointer flex-col items-start rounded-lg py-2 px-4">
            <div className="flex w-full items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      );
    }

    const isFolderSent = folder === FOLDERS.SENT;
    const isFolderBin = folder === FOLDERS.BIN;

    return (
      <div
        className={cn(
          'select-none border-b md:my-1 md:border-none',
          computedData.displayUnread ? '' : 'opacity-60',
        )}
        onClick={onClick ? onClick(latestMessage) : undefined}
      >
        <div
          data-thread-id={message.id}
          className={cn(
            'hover:bg-offsetLight hover:bg-primary/5 group relative mx-1 flex cursor-pointer flex-col items-start rounded-lg py-2 text-left text-sm transition-all hover:opacity-100',
            isSelected && 'border-border bg-primary/5 opacity-100',
            isKeyboardFocused && 'ring-primary/50',
          )}
        >
          {/* Action buttons */}
          <div
            className={cn(
              'dark:bg-panelDark absolute right-2 z-[25] flex -translate-y-1/2 items-center gap-1 rounded-xl border bg-white p-1 opacity-0 shadow-sm group-hover:opacity-100',
              index === 0 ? 'top-4' : 'top-[-1]',
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 overflow-visible [&_svg]:size-3.5"
                  onClick={handleToggleStar}
                >
                  <Star2
                    className={cn(
                      'h-4 w-4',
                      computedData.displayStarred
                        ? 'fill-yellow-400 stroke-yellow-400'
                        : 'fill-transparent stroke-[#9D9D9D] dark:stroke-[#9D9D9D]',
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side={index === 0 ? 'bottom' : 'top'}
                className="mb-1 bg-white dark:bg-[#1A1A1A]"
              >
                {computedData.displayStarred ? 'Unstar' : 'Star'}
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 [&_svg]:size-3.5"
                  onClick={handleToggleImportant}
                >
                  <ExclamationCircle
                    className={cn(
                      computedData.displayImportant ? 'fill-orange-400' : 'fill-[#9D9D9D]'
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side={index === 0 ? 'bottom' : 'top'}
                className="dark:bg-panelDark mb-1 bg-white"
              >
                Toggle Important
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 [&_svg]:size-3.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveThreadTo('archive');
                  }}
                >
                  <Archive2 className="fill-[#9D9D9D]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side={index === 0 ? 'bottom' : 'top'}
                className="dark:bg-panelDark mb-1 bg-white"
              >
                Archive
              </TooltipContent>
            </Tooltip>

            {!isFolderBin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-[#FDE4E9] dark:hover:bg-[#411D23] [&_svg]:size-3.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveThreadTo('bin');
                    }}
                  >
                    <Trash className="fill-[#F43F5E]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side={index === 0 ? 'bottom' : 'top'}
                  className="dark:bg-panelDark mb-1 bg-white"
                >
                  Delete
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Thread content */}
          <div className="relative flex w-full items-center justify-between gap-4 px-4">
            <div>
              <Avatar className={cn('h-8 w-8 rounded-full', computedData.displayUnread && !isSelected && !isFolderSent ? '' : 'border')}>
                {computedData.isGroupThread ? (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[#FFFFFF] p-2 dark:bg-[#373737]">
                    <GroupPeople className="h-4 w-4" />
                  </div>
                ) : (
                  <>
                    <AvatarImage
                      className="rounded-full bg-[#FFFFFF] dark:bg-[#373737]"
                      src={getEmailLogo(latestMessage?.sender?.email || '')}
                      alt={computedData.cleanName || latestMessage?.sender?.email || ''}
                    />
                    <AvatarFallback className="rounded-full bg-[#FFFFFF] font-bold text-[#9F9F9F] dark:bg-[#373737]">
                      {computedData.cleanName
                        ? computedData.cleanName[0]?.toUpperCase()
                        : latestMessage?.sender?.email?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </>
                )}
              </Avatar>
            </div>

            <div className="flex w-full justify-between">
              <div className="w-full">
                <div className="flex w-full flex-row items-center justify-between">
                  <div className="flex flex-row items-center gap-[4px]">
                    <span
                      className={cn(
                        computedData.displayUnread && !isSelected ? 'font-bold' : 'font-medium',
                        'text-md flex items-baseline gap-1 group-hover:opacity-100',
                      )}
                    >
                      {isFolderSent ? (
                        <span className="overflow-hidden truncate text-sm md:max-w-[15ch] xl:max-w-[25ch]">
                          {highlightText(latestMessage?.subject || '', searchValue.highlight)}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="line-clamp-1 overflow-hidden text-sm">
                            {highlightText(computedData.cleanName || '', searchValue.highlight)}
                          </span>
                          {computedData.displayUnread && !isSelected && !isFolderSent && (
                            <span className="ml-0.5 size-2 rounded-full bg-[#006FFE]" />
                          )}
                        </div>
                      )}
                    </span>
                    
                    {(threadData?.totalReplies || 0) > 1 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="rounded-md text-xs opacity-70">
                            [{threadData?.totalReplies}]
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="p-1 text-xs">
                          {threadData?.totalReplies} replies
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  
                  {latestMessage?.receivedOn && (
                    <p className="text-muted-foreground text-nowrap text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100 dark:text-[#8C8C8C]">
                      {formatDate(latestMessage.receivedOn.split('.')[0] || '')}
                    </p>
                  )}
                </div>

                <div className="flex justify-between">
                  {isFolderSent ? (
                    <p className="mt-1 line-clamp-1 max-w-[50ch] overflow-hidden text-sm text-[#8C8C8C] md:max-w-[25ch]">
                      {latestMessage?.to?.map((e) => e.email).join(', ')}
                    </p>
                  ) : (
                    <p className="mt-1 line-clamp-1 w-[95%] min-w-0 overflow-hidden text-sm text-[#8C8C8C]">
                      {highlightText(latestMessage?.subject || '', searchValue.highlight)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.message.id === next.message.id &&
      prev.isKeyboardFocused === next.isKeyboardFocused &&
      prev.index === next.index &&
      Object.is(prev.onClick, next.onClick)
    );
  },
);

// Optimized Mail List with virtualization
export const OptimizedMailList = memo(function OptimizedMailList() {
  const { folder } = useParams<{ folder: string }>();
  const [, setThreadId] = useQueryState('threadId');
  const [searchValue] = useSearchValue();
  const [{ refetch, isLoading, isFetching, isFetchingNextPage, hasNextPage }, items, , loadMore] = useThreads();
  const trpc = useTRPC();

  const parentRef = useRef<HTMLDivElement>(null);
  const vListRef = useRef<VListHandle>(null);

  const handleNavigateToThread = useCallback(
    (threadId: string | null) => {
      setThreadId(threadId);
    },
    [setThreadId],
  );

  const { focusedIndex, handleMouseEnter, keyboardActive } = useMailNavigation({
    items,
    containerRef: parentRef,
    onNavigate: handleNavigateToThread,
  });

  const filteredItems = useMemo(() => items.filter((item) => item.id), [items]);

  const handleMailClick = useCallback(
    (message: ParsedMessage) => async () => {
      await setThreadId(message.id);
    },
    [setThreadId],
  );

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetching && !isFetchingNextPage) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const sentinel = document.getElementById('load-more-sentinel');
    if (sentinel) observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasNextPage, isFetching, isFetchingNextPage, loadMore]);

  if (isLoading) {
    return (
      <div className="flex h-32 w-full items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex w-full items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-lg">No emails found</p>
          <p className="text-md text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex h-full w-full flex-col">
      <VList
        ref={vListRef}
        className="overflow-y-auto"
        itemSize={72} // Approximate height of each thread item
        overscan={5} // Render 5 items outside viewport
        onScroll={() => {
          // Handle scroll for infinite loading
          if (vListRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = vListRef.current;
            if (scrollHeight - scrollTop <= clientHeight * 1.5) {
              loadMore();
            }
          }
        }}
      >
        {filteredItems.map((item, index) => (
          <OptimizedThread
            key={item.id}
            message={item}
            isKeyboardFocused={focusedIndex === index && keyboardActive}
            index={index}
            onClick={handleMailClick}
          />
        ))}
      </VList>
      
      {/* Loading indicator */}
      {(isFetchingNextPage || isFetching) && (
        <div className="flex w-full justify-center py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
        </div>
      )}
      
      {/* Sentinel for infinite scroll */}
      <div id="load-more-sentinel" className="h-1" />
    </div>
  );
});
