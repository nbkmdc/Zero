import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { useMail } from '@/components/mail/use-mail';
import { useQueryState } from 'nuqs';
import { toast } from 'sonner';
import { useCallback } from 'react';
import type { ThreadDestination } from '@/lib/thread-actions';

export function useDirectActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [mail, setMail] = useMail();
  const [threadId, setThreadId] = useQueryState('threadId');
  const [, setActiveReplyId] = useQueryState('activeReplyId');

  const { mutateAsync: markAsRead } = useMutation(trpc.mail.markAsRead.mutationOptions());
  const { mutateAsync: markAsUnread } = useMutation(trpc.mail.markAsUnread.mutationOptions());
  const { mutateAsync: toggleStar } = useMutation(trpc.mail.toggleStar.mutationOptions());
  const { mutateAsync: toggleImportant } = useMutation(trpc.mail.toggleImportant.mutationOptions());
  const { mutateAsync: bulkDeleteThread } = useMutation(trpc.mail.bulkDelete.mutationOptions());
  const { mutateAsync: bulkArchive } = useMutation(trpc.mail.bulkArchive.mutationOptions());
  const { mutateAsync: modifyLabels } = useMutation(trpc.mail.modifyLabels.mutationOptions());

  const refreshData = useCallback(async () => {
    return await Promise.all([
      queryClient.refetchQueries({ queryKey: trpc.mail.count.queryKey() }),
      queryClient.refetchQueries({ queryKey: trpc.mail.listThreads.queryKey() }),
    ]);
  }, [queryClient, trpc]);

  const directMarkAsRead = useCallback(
    async (threadIds: string[], silent = false) => {
      if (!threadIds.length) return;

      try {
        await markAsRead({ ids: threadIds });
        if (!silent) {
          toast.success('Marked as read');
        }
        
        if (mail.bulkSelected.length > 0) {
          setMail((prev) => ({ ...prev, bulkSelected: [] }));
        }
        
        await refreshData();
      } catch (error) {
        console.error('Failed to mark as read:', error);
        toast.error('Failed to mark as read');
      }
    },
    [markAsRead, mail.bulkSelected, setMail, refreshData]
  );

  const directMarkAsUnread = useCallback(
    async (threadIds: string[]) => {
      if (!threadIds.length) return;

      try {
        await markAsUnread({ ids: threadIds });
        toast.success('Marked as unread');
        
        if (mail.bulkSelected.length > 0) {
          setMail((prev) => ({ ...prev, bulkSelected: [] }));
        }
        
        await refreshData();
      } catch (error) {
        console.error('Failed to mark as unread:', error);
        toast.error('Failed to mark as unread');
      }
    },
    [markAsUnread, mail.bulkSelected, setMail, refreshData]
  );

  const directToggleStar = useCallback(
    async (threadIds: string[], starred: boolean) => {
      if (!threadIds.length) return;

      try {
        await toggleStar({ ids: threadIds });
        toast.success(starred ? 'Added to favorites' : 'Removed from favorites');
        
        if (mail.bulkSelected.length > 0) {
          setMail((prev) => ({ ...prev, bulkSelected: [] }));
        }
        
        await refreshData();
      } catch (error) {
        console.error('Failed to toggle star:', error);
        toast.error('Failed to update favorites');
      }
    },
    [toggleStar, mail.bulkSelected, setMail, refreshData]
  );

  const directToggleImportant = useCallback(
    async (threadIds: string[], isImportant: boolean) => {
      if (!threadIds.length) return;

      try {
        await toggleImportant({ ids: threadIds });
        toast.success(isImportant ? 'Marked as important' : 'Unmarked as important');
        
        if (mail.bulkSelected.length > 0) {
          setMail((prev) => ({ ...prev, bulkSelected: [] }));
        }
        
        await refreshData();
      } catch (error) {
        console.error('Failed to toggle important:', error);
        toast.error('Failed to update importance');
      }
    },
    [toggleImportant, mail.bulkSelected, setMail, refreshData]
  );

  const directMoveThreadsTo = useCallback(
    async (threadIds: string[], currentFolder: string, destination: ThreadDestination) => {
      if (!threadIds.length || !destination) return;

      try {
        if (destination === 'archive') {
          await bulkArchive({ ids: threadIds });
          toast.success('Archived');
        } else if (destination === 'bin') {
          await bulkDeleteThread({ ids: threadIds });
          toast.success('Moved to bin');
        } else {
          const addLabels = destination === 'inbox' ? ['INBOX'] : destination === 'spam' ? ['SPAM'] : [];
          const removeLabels = currentFolder === 'inbox' ? ['INBOX'] : currentFolder === 'spam' ? ['SPAM'] : [];
          
          await modifyLabels({
            threadId: threadIds,
            addLabels,
            removeLabels,
          });
          
          const successMessage = destination === 'inbox' ? 'Moved to inbox' : 
                                destination === 'spam' ? 'Moved to spam' : 
                                'Moved successfully';
          toast.success(successMessage);
        }

        if (threadId && threadIds.includes(threadId)) {
          setThreadId(null);
          setActiveReplyId(null);
        }

        if (mail.bulkSelected.length > 0) {
          setMail((prev) => ({ ...prev, bulkSelected: [] }));
        }
        
        await refreshData();
      } catch (error) {
        console.error('Failed to move threads:', error);
        toast.error('Failed to move emails');
      }
    },
    [bulkArchive, bulkDeleteThread, modifyLabels, threadId, setThreadId, setActiveReplyId, mail.bulkSelected, setMail, refreshData]
  );

  const directDeleteThreads = useCallback(
    async (threadIds: string[], _currentFolder: string) => {
      if (!threadIds.length) return;

      try {
        await bulkDeleteThread({ ids: threadIds });
        toast.success('Moved to bin');

        if (threadId && threadIds.includes(threadId)) {
          setThreadId(null);
          setActiveReplyId(null);
        }

        if (mail.bulkSelected.length > 0) {
          setMail((prev) => ({ ...prev, bulkSelected: [] }));
        }
        
        await refreshData();
      } catch (error) {
        console.error('Failed to delete threads:', error);
        toast.error('Failed to delete emails');
      }
    },
    [bulkDeleteThread, threadId, setThreadId, setActiveReplyId, mail.bulkSelected, setMail, refreshData]
  );

  const directToggleLabel = useCallback(
    async (threadIds: string[], labelId: string, add: boolean) => {
      if (!threadIds.length || !labelId) return;

      try {
        await modifyLabels({
          threadId: threadIds,
          addLabels: add ? [labelId] : [],
          removeLabels: add ? [] : [labelId],
        });

        const message = add
          ? `Label added${threadIds.length > 1 ? ` to ${threadIds.length} threads` : ''}`
          : `Label removed${threadIds.length > 1 ? ` from ${threadIds.length} threads` : ''}`;
        toast.success(message);

        if (mail.bulkSelected.length > 0) {
          setMail((prev) => ({ ...prev, bulkSelected: [] }));
        }
        
        await refreshData();
      } catch (error) {
        console.error('Failed to toggle label:', error);
        toast.error('Failed to update label');
      }
    },
    [modifyLabels, mail.bulkSelected, setMail, refreshData]
  );

  return {
    directMarkAsRead,
    directMarkAsUnread,
    directToggleStar,
    directMoveThreadsTo,
    directDeleteThreads,
    directToggleImportant,
    directToggleLabel,
  };
}
