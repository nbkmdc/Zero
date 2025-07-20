import { useDirectActions } from '@/hooks/use-direct-actions';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { enhancedKeyboardShortcuts } from '@/config/shortcuts';
import { useSearchValue } from '@/hooks/use-search-value';
import { useLocation, useParams } from 'react-router';
import { useMail } from '@/components/mail/use-mail';
import { Categories } from '@/components/mail/mail';
import { useShortcuts } from './use-hotkey-utils';
import { useThreads } from '@/hooks/use-threads';
import { cleanSearchValue } from '@/lib/utils';
import { useQueryState } from 'nuqs';
import { toast } from 'sonner';

export function MailListHotkeys() {
  const scope = 'mail-list';
  const [mail, setMail] = useMail();
  const [, items] = useThreads();
  const hoveredEmailId = useRef<string | null>(null);
  const categories = Categories();
  const [, setCategory] = useQueryState('category');
  const [searchValue, setSearchValue] = useSearchValue();
  const pathname = useLocation().pathname;
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
  const shouldUseHover = mail.bulkSelected.length === 0;

  const {
    directMarkAsRead,
    directMarkAsUnread,
    directMoveThreadsTo,
    directToggleImportant,
    directDeleteThreads,
    directToggleStar,
  } = useDirectActions();

  useEffect(() => {
    const handleEmailHover = (event: CustomEvent<{ id: string | null }>) => {
      hoveredEmailId.current = event.detail.id;
    };

    window.addEventListener('emailHover', handleEmailHover as EventListener);
    return () => {
      window.removeEventListener('emailHover', handleEmailHover as EventListener);
    };
  }, []);

  const selectAll = useCallback(() => {
    if (mail.bulkSelected.length > 0) {
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
    } else if (items.length > 0) {
      const allIds = items.map((item) => item.id);
      setMail((prev) => ({
        ...prev,
        bulkSelected: allIds,
      }));
    } else {
      toast.info('No emails to select');
    }
  }, [items, mail]);

  const markAsRead = useCallback(() => {
    if (shouldUseHover && hoveredEmailId.current) {
      directMarkAsRead([hoveredEmailId.current]);
      return;
    }

    const idsToMark = mail.bulkSelected;
    if (idsToMark.length === 0) {
      toast.info('No emails to select');
      return;
    }

    directMarkAsRead(idsToMark);
  }, [mail.bulkSelected, directMarkAsRead, shouldUseHover]);

  const markAsUnread = useCallback(() => {
    if (shouldUseHover && hoveredEmailId.current) {
      directMarkAsUnread([hoveredEmailId.current]);
      return;
    }

    const idsToMark = mail.bulkSelected;
    if (idsToMark.length === 0) {
      toast.info('No emails to select');
      return;
    }

    directMarkAsUnread(idsToMark);
  }, [mail.bulkSelected, directMarkAsUnread, shouldUseHover]);

  const markAsImportant = useCallback(() => {
    if (shouldUseHover && hoveredEmailId.current) {
      directToggleImportant([hoveredEmailId.current], true);
      return;
    }

    const idsToMark = mail.bulkSelected;
    if (idsToMark.length === 0) {
      toast.info('No emails to select');
      return;
    }

    directToggleImportant(idsToMark, true);
  }, [mail.bulkSelected, directToggleImportant, shouldUseHover]);

  const archiveEmail = useCallback(async () => {
    if (shouldUseHover && hoveredEmailId.current) {
      directMoveThreadsTo([hoveredEmailId.current], folder, 'archive');
      return;
    }

    const idsToArchive = mail.bulkSelected;
    if (idsToArchive.length === 0) {
      toast.info('No emails to select');
      return;
    }

    directMoveThreadsTo(idsToArchive, folder, 'archive');
  }, [mail.bulkSelected, folder, directMoveThreadsTo, shouldUseHover]);

  const bulkArchive = useCallback(() => {
    if (shouldUseHover && hoveredEmailId.current) {
      directMoveThreadsTo([hoveredEmailId.current], folder, 'archive');
      return;
    }

    const idsToArchive = mail.bulkSelected;
    if (idsToArchive.length === 0) {
      toast.info('No emails to select');
      return;
    }

    directMoveThreadsTo(idsToArchive, folder, 'archive');
  }, [mail.bulkSelected, folder, directMoveThreadsTo, shouldUseHover]);

  const bulkDelete = useCallback(() => {
    if (shouldUseHover && hoveredEmailId.current) {
      directDeleteThreads([hoveredEmailId.current], folder);
      return;
    }

    const idsToDelete = mail.bulkSelected;
    if (idsToDelete.length === 0) {
      toast.info('No emails to select');
      return;
    }

    directDeleteThreads(idsToDelete, folder);
  }, [mail.bulkSelected, folder, directDeleteThreads, shouldUseHover]);

  const bulkStar = useCallback(() => {
    if (shouldUseHover && hoveredEmailId.current) {
      directToggleStar([hoveredEmailId.current], true);
      return;
    }

    const idsToStar = mail.bulkSelected;
    if (idsToStar.length === 0) {
      toast.info('No emails to select');
      return;
    }

    directToggleStar(idsToStar, true);
  }, [mail.bulkSelected, directToggleStar, shouldUseHover]);

  const exitSelectionMode = useCallback(() => {
    setMail((prev) => ({
      ...prev,
      bulkSelected: [],
    }));
  }, [shouldUseHover]);

  const switchMailListCategory = useCallback(
    (category: string | null) => {
      if (pathname?.includes('/mail/inbox')) {
        const cat = categories.find((cat) => cat.id === category);
        if (!cat) {
          setCategory(null);
          setSearchValue({
            value: '',
            highlight: searchValue.highlight,
            folder: '',
          });
          return;
        }
        setCategory(cat.id);
        setSearchValue({
          value: `${cat.searchValue} ${cleanSearchValue(searchValue.value).trim().length ? `AND ${cleanSearchValue(searchValue.value)}` : ''}`,
          highlight: searchValue.highlight,
          folder: '',
        });
      }
    },
    [categories, pathname, searchValue, setCategory, setSearchValue],
  );

  const switchCategoryByIndex = useCallback(
    (idx: number) => {
      const cat = categories[idx];
      if (!cat) return;
      switchMailListCategory(cat.id);
    },
    [categories, switchMailListCategory],
  );

  const handlers = useMemo(
    () => ({
      markAsRead,
      markAsUnread,
      markAsImportant,
      selectAll,
      archiveEmail,
      bulkArchive,
      bulkDelete,
      bulkStar,
      exitSelectionMode,
      showImportant: () => switchCategoryByIndex(0),
      showAllMail: () => switchCategoryByIndex(1),
      showPersonal: () => switchCategoryByIndex(2),
      showUpdates: () => switchCategoryByIndex(3),
      showPromotions: () => switchCategoryByIndex(4),
      showUnread: () => switchCategoryByIndex(5),
    }),
    [
      switchCategoryByIndex,
      markAsRead,
      markAsUnread,
      markAsImportant,
      selectAll,
      archiveEmail,
      bulkArchive,
      bulkDelete,
      bulkStar,
      exitSelectionMode,
    ],
  );

  const mailListShortcuts = enhancedKeyboardShortcuts.filter(
    (shortcut) => shortcut.scope === scope,
  );

  useShortcuts(mailListShortcuts, handlers, { scope });

  return null;
}
