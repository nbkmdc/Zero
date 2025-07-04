import {
  cn,
  FOLDERS,
  formatDate,
  getEmailLogo,
  getMainSearchTerm,
  parseNaturalLanguageSearch,
} from '@/lib/utils';
import { useOptimisticThreadState as useOptimisticThreadStateWithOptions } from '@/hooks/use-optimized-thread-state';
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
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useMail, type Config } from '@/components/mail/use-mail';
import { type ThreadDestination } from '@/lib/thread-actions';
import { useThread, useThreads } from '@/hooks/use-threads';
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

const Thread = memo(
  function Thread({
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
    const isVisible = useMemo(
      () => Math.abs((index || 0) - (focusedIndex || 0)) < 10 || isSelected,
      [index, focusedIndex, isSelected],
    );

    // Only fetch thread data for visible/selected items using the optimized useThread
    const {
      data: getThreadData,
      isGroupThread,
      latestDraft,
    } = useThread(message.id, message.historyId);

    const latestMessage = getThreadData?.latest || message;
    const idToUse = message.id;

    // Memoized computed values
    const computedData = useMemo(() => {
      if (!getThreadData)
        return {
          displayUnread: (message as any).unread || false,
          isGroupThread: false,
          displayStarred: false,
          displayImportant: false,
          cleanName: (message as any).sender?.name?.trim()?.replace(/^['"]|['"]$/g, '') || '',
          hasNotes: false,
        };

      const displayUnread = getThreadData.hasUnread ?? false;
      const displayStarred =
        (latestMessage as any)?.tags?.some((tag: any) => tag.name === 'STARRED') ?? false;
      const displayImportant =
        (latestMessage as any)?.tags?.some((tag: any) => tag.name === 'IMPORTANT') ?? false;
      const cleanName =
        (latestMessage as any)?.sender?.name?.trim()?.replace(/^['"]|['"]$/g, '') || '';

      return {
        displayUnread,
        isGroupThread,
        displayStarred,
        displayImportant,
        cleanName,
        hasNotes: false, // TODO: Implement notes check when needed
      };
    }, [getThreadData, latestMessage, message, isGroupThread]);

    // Optimistic state only for visible items
    const optimisticState = useOptimisticThreadStateWithOptions(idToUse, { enabled: isVisible });

    // Event handlers
    const { optimisticToggleStar, optimisticToggleImportant, optimisticMoveThreadsTo } =
      useOptimisticActions();

    const handleToggleStar = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        optimisticToggleStar([idToUse], !computedData.displayStarred);
      },
      [idToUse, computedData.displayStarred, optimisticToggleStar],
    );

    const handleToggleImportant = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        optimisticToggleImportant([idToUse], !computedData.displayImportant);
      },
      [idToUse, computedData.displayImportant, optimisticToggleImportant],
    );

    const moveThreadTo = useCallback(
      async (destination: ThreadDestination) => {
        optimisticMoveThreadsTo([idToUse], folder ?? '', destination);
      },
      [idToUse, folder, optimisticMoveThreadsTo],
    );

    // Render skeleton while loading
    if (!getThreadData && isVisible) {
      return (
        <div className="select-none border-b md:my-1 md:border-none">
          <div className="mx-1 flex cursor-pointer flex-col items-start rounded-lg px-4 py-2">
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
      <ThreadContextMenu threadId={idToUse}>
        <div
          className={cn(
            'select-none border-b md:my-1 md:border-none',
            computedData.displayUnread ? '' : 'opacity-60',
          )}
          onClick={onClick ? onClick(latestMessage as any) : undefined}
        >
          <div
            data-thread-id={idToUse}
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
                        computedData.displayImportant ? 'fill-orange-400' : 'fill-[#9D9D9D]',
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
                <Avatar
                  className={cn(
                    'h-8 w-8 rounded-full',
                    computedData.displayUnread && !isSelected && !isFolderSent ? '' : 'border',
                  )}
                >
                  {isGroupThread ? (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-[#FFFFFF] p-2 dark:bg-[#373737]">
                      <GroupPeople className="h-4 w-4" />
                    </div>
                  ) : (
                    <>
                      <AvatarImage
                        className="rounded-full bg-[#FFFFFF] dark:bg-[#373737]"
                        src={getEmailLogo((latestMessage as any)?.sender?.email || '')}
                        alt={computedData.cleanName || (latestMessage as any)?.sender?.email || ''}
                      />
                      <AvatarFallback className="rounded-full bg-[#FFFFFF] font-bold text-[#9F9F9F] dark:bg-[#373737]">
                        {computedData.cleanName
                          ? computedData.cleanName[0]?.toUpperCase()
                          : (latestMessage as any)?.sender?.email?.[0]?.toUpperCase()}
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
                            {highlightText(
                              (latestMessage as any)?.subject || '',
                              searchValue.highlight,
                            )}
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

                      {(getThreadData?.totalReplies || 0) > 1 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="rounded-md text-xs opacity-70">
                              [{getThreadData?.totalReplies}]
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="p-1 text-xs">
                            {getThreadData?.totalReplies} replies
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {latestDraft && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center">
                              <PencilCompose className="h-3 w-3 fill-blue-500 dark:fill-blue-400" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="p-1 text-xs">Draft</TooltipContent>
                        </Tooltip>
                      )}

                      {computedData.hasNotes && (
                        <span className="inline-flex items-center">
                          <StickyNote className="h-3 w-3 fill-amber-500 stroke-amber-500 dark:fill-amber-400 dark:stroke-amber-400" />
                        </span>
                      )}
                    </div>

                    {(latestMessage as any)?.receivedOn && (
                      <p className="text-muted-foreground text-nowrap text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100 dark:text-[#8C8C8C]">
                        {formatDate((latestMessage as any).receivedOn.split('.')[0] || '')}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between">
                    {isFolderSent ? (
                      <p className="mt-1 line-clamp-1 max-w-[50ch] overflow-hidden text-sm text-[#8C8C8C] md:max-w-[25ch]">
                        {(latestMessage as any)?.to?.map((e: any) => e.email).join(', ')}
                      </p>
                    ) : (
                      <p className="mt-1 line-clamp-1 w-[95%] min-w-0 overflow-hidden text-sm text-[#8C8C8C]">
                        {highlightText(
                          (latestMessage as any)?.subject || '',
                          searchValue.highlight,
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ThreadContextMenu>
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

const Draft = memo(({ message }: { message: { id: string } }) => {
  const { data: draft } = useDraft(message.id);
  const [, setComposeOpen] = useQueryState('isComposeOpen');
  const [, setDraftId] = useQueryState('draftId');
  const handleMailClick = useCallback(() => {
    setComposeOpen('true');
    setDraftId(message.id);
    return;
  }, [message.id]);

  if (!draft) {
    return (
      <div className="select-none py-1">
        <div
          key={message.id}
          className={cn(
            'group relative mx-[8px] flex cursor-pointer flex-col items-start overflow-clip rounded-[10px] border-transparent py-3 text-left text-sm transition-all',
          )}
        >
          <div
            className={cn(
              'bg-primary absolute inset-y-0 left-0 w-1 -translate-x-2 transition-transform ease-out',
            )}
          />
          <div className="flex w-full items-center justify-between gap-4 px-4">
            <div className="flex w-full justify-between">
              <div className="w-full">
                <div className="flex w-full flex-row items-center justify-between">
                  <div className="flex flex-row items-center gap-[4px]">
                    <Skeleton className="bg-muted h-4 w-32 rounded" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <Skeleton className="bg-muted mt-1 h-4 w-48 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="select-none py-1" onClick={handleMailClick}>
      <div
        key={message.id}
        className={cn(
          'hover:bg-offsetLight hover:bg-primary/5 group relative mx-[8px] flex cursor-pointer flex-col items-start overflow-clip rounded-[10px] border-transparent py-3 text-left text-sm transition-all hover:opacity-100',
        )}
      >
        <div
          className={cn(
            'bg-primary absolute inset-y-0 left-0 w-1 -translate-x-2 transition-transform ease-out',
          )}
        />
        <div className="flex w-full items-center justify-between gap-4 px-4">
          <div className="flex w-full justify-between">
            <div className="w-full">
              <div className="flex w-full flex-row items-center justify-between">
                <div className="flex flex-row items-center gap-[4px]">
                  <span
                    className={cn(
                      'font-medium',
                      'text-md flex items-baseline gap-1 group-hover:opacity-100',
                    )}
                  >
                    <span className={cn('max-w-[25ch] truncate text-sm')}>
                      {cleanNameDisplay(draft?.to?.[0] || 'noname') || ''}
                    </span>
                  </span>
                </div>
                {draft.rawMessage?.internalDate && (
                  <p
                    className={cn(
                      'text-muted-foreground text-nowrap text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100 dark:text-[#8C8C8C]',
                    )}
                  >
                    {formatDate(Number(draft.rawMessage?.internalDate))}
                  </p>
                )}
              </div>
              <div className="flex justify-between">
                <p
                  className={cn(
                    'mt-1 line-clamp-1 max-w-[50ch] text-sm text-[#8C8C8C] md:max-w-[30ch]',
                  )}
                >
                  {draft?.subject}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const MailList = memo(
  function MailList() {
    const { folder } = useParams<{ folder: string }>();
    const { data: settingsData } = useSettings();
    const [, setThreadId] = useQueryState('threadId');
    const [, setDraftId] = useQueryState('draftId');
    const [category, setCategory] = useQueryState('category');
    const [searchValue, setSearchValue] = useSearchValue();
    const [{ refetch, isLoading, isFetching, isFetchingNextPage, hasNextPage }, items, , loadMore] =
      useThreads();
    const trpc = useTRPC();
    const isFetchingMail = useIsFetching({ queryKey: trpc.mail.get.queryKey() }) > 0;

    const itemsRef = useRef(items);
    useEffect(() => {
      itemsRef.current = items;
    }, [items]);

    const allCategories = Categories();

    // Skip category filtering for drafts, spam, sent, archive, and bin pages
    const shouldFilter = !['draft', 'spam', 'sent', 'archive', 'bin'].includes(folder || '');

    // Set initial category search value only if not in special folders
    useEffect(() => {
      if (!shouldFilter) return;

      const currentCategory = category
        ? allCategories.find((cat) => cat.id === category)
        : allCategories.find((cat) => cat.id === 'All Mail');

      if (currentCategory && searchValue.value === '') {
        setSearchValue({
          value: currentCategory.searchValue || '',
          highlight: '',
          folder: '',
        });
      }
    }, [allCategories, category, shouldFilter, searchValue.value, setSearchValue]);

    // Add event listener for refresh
    useEffect(() => {
      const handleRefresh = () => {
        void refetch();
      };

      window.addEventListener('refreshMailList', handleRefresh);
      return () => window.removeEventListener('refreshMailList', handleRefresh);
    }, [refetch]);

    const parentRef = useRef<HTMLDivElement>(null);
    const vListRef = useRef<VListHandle>(null);

    const handleNavigateToThread = useCallback(
      (threadId: string | null) => {
        setThreadId(threadId);
        return;
      },
      [setThreadId],
    );

    const { focusedIndex, handleMouseEnter, keyboardActive } = useMailNavigation({
      items,
      containerRef: parentRef,
      onNavigate: handleNavigateToThread,
    });

    const isKeyPressed = useKeyState();

    const getSelectMode = useCallback((): MailSelectMode => {
      const isAltPressed =
        isKeyPressed('Alt') || isKeyPressed('AltLeft') || isKeyPressed('AltRight');

      const isShiftPressed =
        isKeyPressed('Shift') || isKeyPressed('ShiftLeft') || isKeyPressed('ShiftRight');

      if (isKeyPressed('Control') || isKeyPressed('Meta')) {
        return 'mass';
      }

      if (isAltPressed && isShiftPressed) {
        console.log('Select All Below mode activated'); // Debug log
        return 'selectAllBelow';
      }

      if (isShiftPressed) {
        return 'range';
      }

      return 'single';
    }, [isKeyPressed]);

    const [, setActiveReplyId] = useQueryState('activeReplyId');
    const [, setMail] = useMail();

    const handleSelectMail = useCallback(
      (message: ParsedMessage) => {
        const itemId = message.threadId ?? message.id;
        const currentMode = getSelectMode();
        console.log('Selection mode:', currentMode, 'for item:', itemId);

        setMail((prevMail) => {
          const mail = prevMail;
          switch (currentMode) {
            case 'mass': {
              const newSelected = mail.bulkSelected.includes(itemId)
                ? mail.bulkSelected.filter((id) => id !== itemId)
                : [...mail.bulkSelected, itemId];
              console.log('Mass selection mode - selected items:', newSelected.length);
              return { ...mail, bulkSelected: newSelected };
            }
            case 'selectAllBelow': {
              const clickedIndex = itemsRef.current.findIndex((item) => item.id === itemId);
              console.log(
                'SelectAllBelow - clicked index:',
                clickedIndex,
                'total items:',
                itemsRef.current.length,
              );

              if (clickedIndex !== -1) {
                const itemsBelow = itemsRef.current.slice(clickedIndex);
                const idsBelow = itemsBelow.map((item) => item.id);
                console.log('Selecting all items below - count:', idsBelow.length);
                return { ...mail, bulkSelected: idsBelow };
              }
              console.log('Item not found in list, selecting just this item');
              return { ...mail, bulkSelected: [itemId] };
            }
            case 'range': {
              console.log('Range selection mode - not fully implemented');
              return { ...mail, bulkSelected: [itemId] };
            }
            default: {
              console.log('Single selection mode');
              return { ...mail, bulkSelected: [itemId] };
            }
          }
        });
      },
      [getSelectMode, setMail],
    );

    const [, setFocusedIndex] = useAtom(focusedIndexAtom);

    const { optimisticMarkAsRead } = useOptimisticActions();
    const handleMailClick = useCallback(
      (message: ParsedMessage) => async () => {
        const mode = getSelectMode();
        const autoRead = settingsData?.settings?.autoRead ?? true;
        console.log('Mail click with mode:', mode);

        if (mode !== 'single') {
          return handleSelectMail(message);
        }

        handleMouseEnter(message.id);

        const messageThreadId = message.threadId ?? message.id;
        const clickedIndex = itemsRef.current.findIndex((item) => item.id === messageThreadId);
        setFocusedIndex(clickedIndex);
        if (message.unread && autoRead) optimisticMarkAsRead([messageThreadId], true);
        await setThreadId(messageThreadId);
        await setDraftId(null);
        // Don't clear activeReplyId - let ThreadDisplay handle Reply All auto-opening
      },
      [
        getSelectMode,
        handleSelectMail,
        handleMouseEnter,
        setFocusedIndex,
        optimisticMarkAsRead,
        setThreadId,
        setDraftId,
        settingsData,
        setActiveReplyId,
      ],
    );

    const isFiltering = searchValue.value.trim().length > 0;

    useEffect(() => {
      if (isFiltering && !isLoading) {
        setSearchValue({
          ...searchValue,
          isLoading: false,
        });
      }
    }, [isLoading, isFiltering, setSearchValue]);

    const clearFilters = () => {
      setCategory(null);
      setSearchValue({
        value: '',
        highlight: '',
        folder: '',
      });
    };

    const { resolvedTheme } = useTheme();

    const filteredItems = useMemo(() => items.filter((item) => item.id), [items]);

    const Comp = folder === FOLDERS.DRAFT ? Draft : Thread;

    const vListRenderer = useCallback(
      (index: number) => {
        const item = filteredItems[index];
        return item ? (
          <>
            <Comp
              key={item.id}
              message={item}
              isKeyboardFocused={focusedIndex === index && keyboardActive}
              index={index}
              onClick={handleMailClick}
            />
            {index === filteredItems.length - 1 && (isFetchingNextPage || isFetchingMail) ? (
              <div className="flex w-full justify-center py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
              </div>
            ) : null}
          </>
        ) : (
          <></>
        );
      },
      [
        filteredItems,
        focusedIndex,
        keyboardActive,
        isFetchingMail,
        isFetchingNextPage,
        handleMailClick,
        isLoading,
        isFetching,
        hasNextPage,
      ],
    );

    return (
      <>
        <div
          ref={parentRef}
          className={cn(
            'hide-link-indicator flex h-full w-full',
            getSelectMode() === 'range' && 'select-none',
          )}
        >
          <>
            {isLoading ? (
              <div className="flex h-32 w-full items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
              </div>
            ) : !items || items.length === 0 ? (
              <div className="flex w-full items-center justify-center">
                <div className="flex flex-col items-center justify-center gap-2 text-center">
                  <img
                    suppressHydrationWarning
                    src={resolvedTheme === 'dark' ? '/empty-state.svg' : '/empty-state-light.svg'}
                    alt="Empty Inbox"
                    width={200}
                    height={200}
                  />
                  <div className="mt-5">
                    <p className="text-lg">It's empty here</p>
                    <p className="text-md text-muted-foreground dark:text-white/50">
                      Search for another email or{' '}
                      <button className="underline" onClick={clearFilters}>
                        clear filters
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-y-auto" id="mail-list-scroll">
                <VList
                  ref={vListRef}
                  count={filteredItems.length}
                  overscan={10}
                  className="scrollbar-none flex-1 overflow-x-hidden"
                  children={vListRenderer}
                  onScroll={() => {
                    if (!vListRef.current) return;
                    const endIndex = vListRef.current.findEndIndex();
                    if (
                      // if the shown items are last 5 items, load more
                      Math.abs(filteredItems.length - 1 - endIndex) < 5 &&
                      !isLoading &&
                      !isFetchingNextPage &&
                      !isFetchingMail &&
                      hasNextPage
                    ) {
                      void loadMore();
                    }
                  }}
                />
              </div>
            )}
          </>
        </div>
        <div className="w-full pt-4 text-center">
          {isFetching ? (
            <div className="text-center">
              <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
          ) : (
            <div className="h-4" />
          )}
        </div>
      </>
    );
  },
  () => true,
);

export const MailLabels = memo(
  function MailListLabels({ labels }: { labels: { id: string; name: string }[] }) {
    if (!labels?.length) return null;

    const visibleLabels = labels.filter(
      (label) => !['unread', 'inbox'].includes(label.name.toLowerCase()),
    );

    if (!visibleLabels.length) return null;

    return (
      <div className={cn('flex select-none items-center')}>
        {visibleLabels.map((label) => {
          const style = getDefaultBadgeStyle(label.name);
          if (label.name.toLowerCase() === 'notes') {
            return (
              <Tooltip key={label.id}>
                <TooltipTrigger asChild>
                  <Badge className="rounded-md bg-amber-100 p-1 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
                    {getLabelIcon(label.name)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="hidden px-1 py-0 text-xs">
                  {m['common.notes.title']()}
                </TooltipContent>
              </Tooltip>
            );
          }

          // Skip rendering if style is "secondary" (default case)
          if (style === 'secondary') return null;
          const content = getLabelIcon(label.name);

          return content ? (
            <Badge key={label.id} className="rounded-md p-1" variant={style}>
              {content}
            </Badge>
          ) : null;
        })}
      </div>
    );
  },
  (prev, next) => {
    return JSON.stringify(prev.labels) === JSON.stringify(next.labels);
  },
);

function getNormalizedLabelKey(label: string) {
  return label.toLowerCase().replace(/^category_/i, '');
}

function capitalize(str: string) {
  return str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase();
}

function getLabelIcon(label: string) {
  const normalizedLabel = label.toLowerCase().replace(/^category_/i, '');

  switch (normalizedLabel) {
    case 'starred':
      return <Star className="h-[12px] w-[12px] fill-yellow-400 stroke-yellow-400" />;
    default:
      return null;
  }
}

function getDefaultBadgeStyle(label: string): ComponentProps<typeof Badge>['variant'] {
  const normalizedLabel = label.toLowerCase().replace(/^category_/i, '');

  switch (normalizedLabel) {
    case 'starred':
    case 'important':
      return 'important';
    case 'promotions':
      return 'promotions';
    case 'personal':
      return 'personal';
    case 'updates':
      return 'updates';
    case 'work':
      return 'default';
    case 'forums':
      return 'forums';
    case 'notes':
      return 'secondary';
    default:
      return 'secondary';
  }
}

// Helper function to clean name display
const cleanNameDisplay = (name?: string) => {
  if (!name) return '';
  const match = name.match(/^[^\p{L}\p{N}.]*(.*?)[^\p{L}\p{N}.]*$/u);
  return match ? match[1] : name;
};
