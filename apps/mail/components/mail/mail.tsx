import {
  Archive,
  Archive2,
  ArchiveX,
  Bell,
  CircleCheck,
  CurvedArrow,
  Eye,
  Folders,
  Lightning,
  Mail,
  Printer,
  Reply,
  ScanEye,
  Star2,
  Tag,
  ThreeDots,
  Trash,
  User,
  X,
  Search,
  Sparkles,
  SettingsGear,
  MegaPhone,
  Check,
} from '../icons/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Settings, HelpCircle, LogOut, MoonIcon, BanknoteIcon, BadgeCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useCategorySettings, useDefaultCategoryId } from '@/hooks/use-categories';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useRevalidator, useLocation } from 'react-router';
import { useActiveConnection, useConnections } from '@/hooks/use-connections';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCommandPalette } from '../context/command-palette-context';
import { navigationConfig, bottomNavItems } from '@/config/navigation';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { Plus, ChevronDown, ChevronUp, Inbox } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ThreadDisplay } from '@/components/mail/thread-display';
import { trpcClient, useTRPC } from '@/providers/query-provider';
import { focusedIndexAtom } from '@/hooks/use-mail-navigation';
import { backgroundQueueAtom } from '@/store/backgroundQueue';
import { handleUnsubscribe } from '@/lib/email-utils.client';
import { useMediaQuery } from '../../hooks/use-media-query';
import { useThread, useThreads } from '@/hooks/use-threads';
import { useSearchValue } from '@/hooks/use-search-value';
import { AddConnectionDialog } from '../connection/add';
import * as CustomIcons from '@/components/icons/icons';
import { isMac } from '@/lib/hotkeys/use-hotkey-utils';
import { MailList } from '@/components/mail/mail-list';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useMail } from '@/components/mail/use-mail';
import { LabelDialog } from '../labels/label-dialog';
import { SidebarToggle } from '../ui/sidebar-toggle';
import { PricingDialog } from '../ui/pricing-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useBrainState } from '@/hooks/use-summary';
import { clearBulkSelectionAtom } from './use-mail';
import AISidebar from '@/components/ui/ai-sidebar';
import { Command, RefreshCcw } from 'lucide-react';
import { cleanSearchValue, cn } from '@/lib/utils';
import { useBilling } from '@/hooks/use-billing';
import AIToggleButton from '../ai-toggle-button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { SunIcon } from '../icons/animated/sun';
import { useLabels } from '@/hooks/use-labels';
import { useSession } from '@/lib/auth-client';
import { ScrollArea } from '../ui/scroll-area';
import { useSearchParams } from 'react-router';
import { clear as idbClear } from 'idb-keyval';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useStats } from '@/hooks/use-stats';
import { signOut } from '@/lib/auth-client';
import { Separator } from '../ui/separator';
import { useTranslations } from 'use-intl';
import type { IConnection } from '@/types';
import { SearchBar } from './search-bar';
import { useTheme } from 'next-themes';
import { FOLDERS } from '@/lib/utils';
import { useQueryState } from 'nuqs';
import { useAtom } from 'jotai';
import { toast } from 'sonner';
import SelectAllCheckbox from './select-all-checkbox';

interface ITag {
  id: string;
  name: string;
  usecase: string;
  text: string;
}

export const defaultLabels = [
  {
    name: 'to respond',
    usecase: 'emails you need to respond to. NOT sales, marketing, or promotions.',
  },
  {
    name: 'FYI',
    usecase:
      'emails that are not important, but you should know about. NOT sales, marketing, or promotions.',
  },
  {
    name: 'comment',
    usecase:
      'Team chats in tools like Google Docs, Slack, etc. NOT marketing, sales, or promotions.',
  },
  {
    name: 'notification',
    usecase: 'Automated updates from services you use. NOT sales, marketing, or promotions.',
  },
  {
    name: 'promotion',
    usecase: 'Sales, marketing, cold emails, special offers or promotions. NOT to respond to.',
  },
  {
    name: 'meeting',
    usecase: 'Calendar events, invites, etc. NOT sales, marketing, or promotions.',
  },
  {
    name: 'billing',
    usecase: 'Billing notifications. NOT sales, marketing, or promotions.',
  },
];

const AutoLabelingSettings = () => {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const { data: storedLabels } = useQuery(trpc.brain.getLabels.queryOptions());
  const { mutateAsync: updateLabels, isPending } = useMutation(
    trpc.brain.updateLabels.mutationOptions(),
  );
  const [, setPricingDialog] = useQueryState('pricingDialog');
  const [labels, setLabels] = useState<ITag[]>([]);
  const [newLabel, setNewLabel] = useState({ name: '', usecase: '' });
  const { mutateAsync: EnableBrain, isPending: isEnablingBrain } = useMutation(
    trpc.brain.enableBrain.mutationOptions(),
  );
  const { mutateAsync: DisableBrain, isPending: isDisablingBrain } = useMutation(
    trpc.brain.disableBrain.mutationOptions(),
  );
  const { data: brainState, refetch: refetchBrainState } = useBrainState();
  const { isLoading, isPro } = useBilling();

  useEffect(() => {
    if (storedLabels) {
      setLabels(
        storedLabels.map((label) => ({
          id: label.name,
          name: label.name,
          text: label.name,
          usecase: label.usecase,
        })),
      );
    }
  }, [storedLabels]);

  const handleResetToDefault = useCallback(() => {
    setLabels(
      defaultLabels.map((label) => ({
        id: label.name,
        name: label.name,
        text: label.name,
        usecase: label.usecase,
      })),
    );
  }, [storedLabels]);

  const handleAddLabel = () => {
    if (!newLabel.name || !newLabel.usecase) return;
    setLabels([...labels, { id: newLabel.name, ...newLabel, text: newLabel.name }]);
    setNewLabel({ name: '', usecase: '' });
  };

  const handleDeleteLabel = (id: string) => {
    setLabels(labels.filter((label) => label.id !== id));
  };

  const handleUpdateLabel = (id: string, field: 'name' | 'usecase', value: string) => {
    setLabels(
      labels.map((label) =>
        label.id === id
          ? { ...label, [field]: value, text: field === 'name' ? value : label.text }
          : label,
      ),
    );
  };

  const handleSubmit = async () => {
    const updatedLabels = labels.map((label) => ({
      name: label.name,
      usecase: label.usecase,
    }));

    if (newLabel.name.trim() && newLabel.usecase.trim()) {
      updatedLabels.push({
        name: newLabel.name,
        usecase: newLabel.usecase,
      });
    }
    await updateLabels({ labels: updatedLabels });
    setOpen(false);
    toast.success('Labels updated successfully, Zero will start using them.');
  };

  const handleEnableBrain = useCallback(async () => {
    toast.promise(EnableBrain, {
      loading: 'Enabling autolabeling...',
      success: 'Autolabeling enabled successfully',
      error: 'Failed to enable autolabeling',
      finally: async () => {
        await refetchBrainState();
      },
    });
  }, []);

  const handleDisableBrain = useCallback(async () => {
    toast.promise(DisableBrain, {
      loading: 'Disabling autolabeling...',
      success: 'Autolabeling disabled successfully',
      error: 'Failed to disable autolabeling',
      finally: async () => {
        await refetchBrainState();
      },
    });
  }, []);

  const handleToggleAutolabeling = useCallback(() => {
    if (brainState?.enabled) {
      handleDisableBrain();
    } else {
      handleEnableBrain();
    }
  }, [brainState?.enabled]);

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (!isPro) {
          setPricingDialog('true');
        } else {
          setOpen(state);
        }
      }}
    >
      <DialogTrigger asChild>
        <div className="mr-2 flex items-center gap-2">
          <Switch
            disabled={isEnablingBrain || isDisablingBrain || isLoading}
            checked={brainState?.enabled ?? false}
          />
          <span className="text-muted-foreground cursor-pointer text-xs font-medium">
            Auto label
          </span>
        </div>
      </DialogTrigger>
      <DialogContent showOverlay className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Label Settings</DialogTitle>
            <button
              onClick={handleToggleAutolabeling}
              className="bg-offsetLight dark:bg-offsetDark flex items-center gap-2 rounded-lg border px-1.5 py-1"
            >
              <span className="text-muted-foreground text-sm">
                {isEnablingBrain || isDisablingBrain
                  ? 'Updating...'
                  : brainState?.enabled
                    ? 'Disable autolabeling'
                    : 'Enable autolabeling'}
              </span>
              <Switch checked={brainState?.enabled} />
            </button>
          </div>
          <DialogDescription className="mt-2">
            Configure the labels that Zero uses to automatically organize your emails.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {labels.map((label, index) => (
              <div
                key={label.id}
                className="bg-card group relative space-y-2 rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor={`label-name-${index}`}
                    className="text-muted-foreground text-xs font-medium"
                  >
                    Label Name
                  </Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 transition-opacity group-hover:opacity-100"
                    onClick={() => handleDeleteLabel(label.id)}
                  >
                    <Trash className="h-3 w-3 fill-[#F43F5E]" />
                  </Button>
                </div>
                <Input
                  id={`label-name-${index}`}
                  type="text"
                  value={label.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleUpdateLabel(label.id, 'name', e.target.value)
                  }
                  className="h-8"
                  placeholder="e.g., Important, Follow-up, Archive"
                />
                <div className="space-y-2">
                  <Label
                    htmlFor={`label-usecase-${index}`}
                    className="text-muted-foreground text-xs font-medium"
                  >
                    Use Case Description
                  </Label>
                  <Textarea
                    id={`label-usecase-${index}`}
                    value={label.usecase}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      handleUpdateLabel(label.id, 'usecase', e.target.value)
                    }
                    className="min-h-[60px] resize-none"
                    placeholder="Describe when this label should be applied..."
                  />
                </div>
              </div>
            ))}

            <div className="bg-muted/50 mt-3 space-y-2 rounded-lg border border-dashed p-4">
              <div className="space-y-2">
                <Label
                  htmlFor="new-label-name"
                  className="text-muted-foreground text-xs font-medium"
                >
                  New Label Name
                </Label>
                <Input
                  id="new-label-name"
                  type="text"
                  value={newLabel.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewLabel({ ...newLabel, name: e.target.value })
                  }
                  className="h-8 dark:bg-[#141414]"
                  placeholder="Enter a new label name"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="new-label-usecase"
                  className="text-muted-foreground text-xs font-medium"
                >
                  Use Case Description
                </Label>
                <Textarea
                  id="new-label-usecase"
                  value={newLabel.usecase}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setNewLabel({ ...newLabel, usecase: e.target.value })
                  }
                  className="min-h-[60px] resize-none dark:bg-[#141414]"
                  placeholder="Describe when this label should be applied..."
                />
              </div>
              <Button
                className="mt-2 h-8 w-full"
                onClick={handleAddLabel}
                disabled={!newLabel.name || !newLabel.usecase}
              >
                Add New Label
              </Button>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="mt-4">
          <div className="flex w-full justify-end gap-2">
            <Button size="xs" variant="outline" onClick={handleResetToDefault}>
              Default Labels
            </Button>
            <Button size="xs" onClick={handleSubmit} disabled={isPending}>
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export function MailLayout() {
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
  const [mail, setMail] = useMail();
  const [, clearBulkSelection] = useAtom(clearBulkSelectionAtom);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const { data: connections } = useConnections();
  const t = useTranslations();
  const prevFolderRef = useRef(folder);
  const { enableScope, disableScope } = useHotkeysContext();
  const { data: activeConnection } = useActiveConnection();
  const { activeFilters, clearAllFilters } = useCommandPalette();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useQueryState('isCommandPaletteOpen');

  const { data: activeAccount } = useActiveConnection();

  useEffect(() => {
    if (prevFolderRef.current !== folder && mail.bulkSelected.length > 0) {
      clearBulkSelection();
    }
    prevFolderRef.current = folder;
  }, [folder, mail.bulkSelected.length, clearBulkSelection]);

  useEffect(() => {
    if (!session?.user && !isPending) {
      navigate('/login');
    }
  }, [session?.user, isPending]);

  const [{ isFetching, refetch: refetchThreads }, items] = useThreads();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { optimisticMoveThreadsTo, optimisticToggleStar, optimisticToggleImportant } =
    useOptimisticActions();
  const trpc = useTRPC();
  const [mode, setMode] = useQueryState('mode');

  const [threadId, setThreadId] = useQueryState('threadId');
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const { data: emailData } = useThread(threadId ?? null);

  // Derive star/important state from email data (optimistic updates will handle the state)
  const isStarred = emailData?.latest?.tags?.some((tag) => tag.name === 'STARRED') ?? false;
  const isImportant = emailData?.latest?.tags?.some((tag) => tag.name === 'IMPORTANT') ?? false;

  // Thread action handlers
  const handleToggleStar = useCallback(async () => {
    if (!emailData || !threadId) return;
    try {
      const newStarredState = !isStarred;
      optimisticToggleStar([threadId], newStarredState);
    } catch (error) {
      toast.error('Failed to update star status');
      console.error('Toggle star error:', error);
    }
  }, [emailData, threadId, isStarred, optimisticToggleStar]);

  const moveThreadTo = useCallback(
    async (destination: 'archive' | 'spam' | 'bin' | 'inbox') => {
      if (!threadId) return;
      try {
        optimisticMoveThreadsTo([threadId], folder, destination);
        // Navigate to next thread or close
        const currentIndex = items.findIndex((item) => item.id === threadId);
        if (currentIndex < items.length - 1) {
          const nextThread = items[currentIndex + 1];
          if (nextThread) {
            setThreadId(nextThread.id);
            setFocusedIndex(currentIndex + 1);
            setActiveReplyId(null);
          }
        } else {
          setThreadId(null);
          setActiveReplyId(null);
        }
      } catch (error) {
        toast.error(`Failed to move thread to ${destination}`);
        console.error('Move thread error:', error);
      }
    },
    [
      threadId,
      folder,
      optimisticMoveThreadsTo,
      items,
      setThreadId,
      setFocusedIndex,
      setActiveReplyId,
    ],
  );

  const handleToggleImportant = useCallback(() => {
    if (!emailData || !threadId) return;
    try {
      const newImportantState = !isImportant;
      optimisticToggleImportant([threadId], newImportantState);
    } catch (error) {
      toast.error('Failed to update importance status');
      console.error('Toggle important error:', error);
    }
  }, [emailData, threadId, isImportant, optimisticToggleImportant]);

  const handleUnsubscribeProcess = useCallback(() => {
    if (!emailData?.latest) return;
    toast.promise(handleUnsubscribe({ emailData: emailData.latest }), {
      success: 'Unsubscribed successfully!',
      error: 'Failed to unsubscribe',
    });
  }, [emailData?.latest]);

  const isInArchive = folder === FOLDERS.ARCHIVE;
  const isInSpam = folder === FOLDERS.SPAM;
  const isInBin = folder === FOLDERS.BIN;

  useEffect(() => {
    if (threadId) {
      console.log('Enabling thread-display scope, disabling mail-list');
      enableScope('thread-display');
      disableScope('mail-list');
    } else {
      console.log('Enabling mail-list scope, disabling thread-display');
      enableScope('mail-list');
      disableScope('thread-display');
    }

    return () => {
      console.log('Cleaning up mail/thread scopes');
      disableScope('thread-display');
      disableScope('mail-list');
    };
  }, [threadId, enableScope, disableScope]);

  const handleMailListMouseEnter = useCallback(() => {
    enableScope('mail-list');
  }, [enableScope]);

  const handleMailListMouseLeave = useCallback(() => {
    disableScope('mail-list');
  }, [disableScope]);

  // Add mailto protocol handler registration
  useEffect(() => {
    // Register as a mailto protocol handler if browser supports it
    if (typeof window !== 'undefined' && 'registerProtocolHandler' in navigator) {
      try {
        // Register the mailto protocol handler
        // When a user clicks a mailto: link, it will be passed to our dedicated handler
        // which will:
        // 1. Parse the mailto URL to extract email, subject and body
        // 2. Create a draft with these values
        // 3. Redirect to the compose page with just the draft ID
        // This ensures we don't keep the email content in the URL
        navigator.registerProtocolHandler('mailto', `/api/mailto-handler?mailto=%s`);
      } catch (error) {
        console.error('Failed to register protocol handler:', error);
      }
    }
  }, []);

  const defaultCategoryId = useDefaultCategoryId();
  const [category, setCategory] = useQueryState('category', { defaultValue: defaultCategoryId });

  return (
    <TooltipProvider delayDuration={0}>
      <PricingDialog />
      <div className="rounded-inherit relative z-[5] flex p-0 md:mr-0.5">
        <ResizablePanelGroup
          direction="horizontal"
          className={cn(
            'rounded-inherit bg-panelLight overflow-hidden dark:bg-[#141414]',
            threadId && 'bg-sidebar dark:bg-sidebar',
          )}
        >
          {!threadId && (
            <ResizablePanel
              defaultSize={35}
              minSize={35}
              maxSize={35}
              className={cn(
                `bg-panelLight w-fit md:flex md:rounded-2xl lg:h-[calc(100dvh-8px)] lg:shadow-sm dark:bg-[#141414]`,
                isDesktop && threadId && 'hidden lg:block',
                threadId && 'bg-sidebar dark:bgm-1 -sidebar mr-0.5',
              )}
              onMouseEnter={handleMailListMouseEnter}
              onMouseLeave={handleMailListMouseLeave}
            >
              <div className="w-full md:h-[calc(100dvh-10px)]">
                <div
                  className={cn(
                    'sticky top-0 z-[3] p-2 pl-3.5 pr-3 transition-colors',
                    'flex flex-col gap-2 md:min-h-16 md:flex-row lg:min-h-14 lg:items-center lg:justify-between lg:gap-1.5',
                    'from-panelLight/95 to-panelLight/80 bg-gradient-to-b backdrop-blur-sm dark:from-[#141414]/95 dark:to-[#141414]/80',
                  )}
                >
                  {mail.bulkSelected.length > 0 ? (
                    <div className="flex w-full items-center justify-between gap-2">
                      {folder === 'inbox' && (
                        <CategorySelect isMultiSelectMode={mail.bulkSelected.length > 0} />
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Mobile/Tablet Layout (md and smaller) */}
                      <div className="md:hidden">
                        {/* Top Row: Account + Quick Actions */}
                        <div className="mb-3 flex w-full items-center justify-between">
                          <UserAccountSelect />

                          {/* Quick Actions Group */}
                          <div className="bg-muted/50 flex items-center gap-1.5 rounded-lg p-1 dark:bg-[#1A1A1A]">
                            <AutoLabelingSettings />

                            {/* Search Button */}
                            <Button
                              variant="outline"
                              className={cn(
                                'text-muted-foreground hover:bg-muted h-6 w-6 border-none bg-transparent p-0 dark:hover:bg-[#2C2C2C]',
                              )}
                              onClick={() => setOpen(!open)}
                            >
                              <Search className="fill-muted-foreground size-3.5" />
                            </Button>

                            {/* Refresh Button */}
                            <Button
                              onClick={() => {
                                refetchThreads();
                              }}
                              variant="ghost"
                              className="hover:bg-muted h-6 w-6 bg-transparent px-0 dark:hover:bg-[#2C2C2C]"
                            >
                              <RefreshCcw className="text-muted-foreground h-3.5 w-3.5 cursor-pointer" />
                            </Button>
                          </div>
                        </div>

                        {/* Bottom Row: Navigation Controls */}
                        <div className="">
                          <div className="flex w-full items-center justify-between gap-2">
                            {/* Navigation Group */}
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <NavigationDropdown />

                              {folder === 'inbox' && (
                                <>
                                  <div className="bg-border h-4 w-px"></div>
                                  <LabelSelect isMultiSelectMode={mail.bulkSelected.length > 0} />
                                </>
                              )}
                            </div>

                            {/* Category Selection - Right aligned */}
                            {folder === 'inbox' && (
                              <div className="flex-shrink-0">
                                <CategoryDropdown />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Desktop Layout (lg and larger) - Original Single Row */}
                      <div className="hidden w-full items-center justify-between gap-2 md:flex">
                        <div className="flex items-center gap-2">
                          <UserAccountSelect />
                          <NavigationDropdown />
                          {folder === 'inbox' && (
                            <LabelSelect isMultiSelectMode={mail.bulkSelected.length > 0} />
                          )}
                          {folder === 'inbox' && (
                            <CategorySelect isMultiSelectMode={mail.bulkSelected.length > 0} />
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <AutoLabelingSettings />
                          <div className="w-56">
                            <Button
                              variant="outline"
                              className={cn(
                                'text-muted-foreground bg-muted relative flex h-7 w-full select-none items-center justify-start overflow-hidden rounded-lg border-none bg-white pl-2 text-left text-sm font-normal shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-[#0F0F0F] [&_svg]:size-3.5',
                              )}
                              onClick={() => setOpen(!open)}
                            >
                              <Search className="size-3.5 fill-[#71717A] dark:fill-[#6F6F6F]" />

                              <span className="hidden truncate pr-20 text-sm font-medium text-[#71717A] md:inline-block dark:text-[#6F6F6F]">
                                {activeFilters.length > 0
                                  ? activeFilters.map((f) => f.display).join(', ')
                                  : 'Search'}
                              </span>
                              <span className="inline-block truncate pr-20 md:hidden">
                                {activeFilters.length > 0
                                  ? `${activeFilters.length} filter${activeFilters.length > 1 ? 's' : ''}`
                                  : 'Search...'}
                              </span>

                              <span className="absolute right-[5px] flex gap-1">
                                {activeFilters.length > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 rounded-xl px-1.5 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      clearAllFilters();
                                    }}
                                  >
                                    Clear
                                  </Button>
                                )}
                                <kbd className="bg-muted text-md pointer-events-none hidden h-5 select-none flex-row items-center gap-1 rounded-md border-none px-1 font-medium !leading-[0] opacity-100 sm:flex dark:bg-[#262626] dark:text-[#929292]">
                                  <span
                                    className={cn(
                                      'h-min !leading-[0.2]',
                                      isMac ? 'mt-[1px] text-lg' : 'text-sm',
                                    )}
                                  >
                                    {isMac ? '⌘' : 'Ctrl'}{' '}
                                  </span>
                                  <span className="h-min text-sm !leading-[0.2]"> K</span>
                                </kbd>
                              </span>
                            </Button>
                          </div>

                          <Button
                            onClick={() => {
                              refetchThreads();
                            }}
                            variant="ghost"
                            className="bg-muted h-7 w-7 px-0 dark:bg-[#2C2C2C]"
                          >
                            <RefreshCcw className="text-muted-foreground h-4 w-4 cursor-pointer" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div
                  className={cn(
                    category === 'Important'
                      ? 'bg-[#8B5CF6]'
                      : category === 'Personal'
                        ? 'bg-[#39ae4a]'
                        : category === 'Promotions'
                          ? 'bg-[#F43F5E]'
                          : category === 'Updates'
                            ? 'bg-[#F59E0D]'
                            : category === 'Unread'
                              ? 'bg-[#FF4800]'
                              : 'bg-[#006FFE]',
                    'relative bottom-0.5 z-[5] h-0.5 w-full transition-opacity',
                    isFetching ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <div className="relative z-[1] h-[calc(100dvh-(40px))] overflow-hidden pt-0 md:h-[calc(100dvh-3.5rem)]">
                  <MailList />
                </div>
              </div>
            </ResizablePanel>
          )}

          {isDesktop && threadId && (
            <ResizablePanel
              className={cn(
                'mr-0.5 w-fit rounded-2xl shadow-sm lg:h-[calc(100dvh-7px)]',
                !threadId && 'hidden lg:block',
                threadId && 'bg-sidebar dark:bg-sidebar',
              )}
              defaultSize={30}
              minSize={30}
            >
              {/* Thread Navigation Controls */}
              <div className="absolute left-2 top-2 z-20 flex flex-col items-center gap-1">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          setThreadId(null);
                          setActiveReplyId(null);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-lg border bg-white/90 backdrop-blur-sm hover:bg-white dark:border-none dark:bg-[#313131]/90 dark:hover:bg-[#313131]"
                      >
                        <X className="fill-iconLight dark:fill-iconDark h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-white dark:bg-[#313131]">
                      Close thread
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          if (!threadId || !items.length) return;
                          const currentIndex = items.findIndex((item) => item.id === threadId);
                          if (currentIndex > 0) {
                            const prevThread = items[currentIndex - 1];
                            if (prevThread) {
                              setThreadId(prevThread.id);
                              setFocusedIndex(currentIndex - 1);
                              setActiveReplyId(null);
                            }
                          }
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-lg border bg-white/90 backdrop-blur-sm hover:bg-white dark:border-none dark:bg-[#313131]/90 dark:hover:bg-[#313131]"
                      >
                        <ChevronUp className="text-iconLight dark:text-iconDark h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-white dark:bg-[#313131]">
                      Previous thread
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          if (!threadId || !items.length) return;
                          const currentIndex = items.findIndex((item) => item.id === threadId);
                          if (currentIndex < items.length - 1) {
                            const nextThread = items[currentIndex + 1];
                            if (nextThread) {
                              setThreadId(nextThread.id);
                              setFocusedIndex(currentIndex + 1);
                              setActiveReplyId(null);
                            }
                          } else {
                            // If at the end, close the thread view
                            setThreadId(null);
                            setActiveReplyId(null);
                          }
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-lg border bg-white/90 backdrop-blur-sm hover:bg-white dark:border-none dark:bg-[#313131]/90 dark:hover:bg-[#313131]"
                      >
                        <ChevronDown className="text-iconLight dark:text-iconDark h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-white dark:bg-[#313131]">
                      Next thread
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Thread Action Items */}
                {threadId && emailData && (
                  <>
                    {/* Star Button */}
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={handleToggleStar}
                            className="inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-lg border bg-white/90 backdrop-blur-sm hover:bg-white dark:border-none dark:bg-[#313131]/90 dark:hover:bg-[#313131]"
                          >
                            <Star2
                              className={cn(
                                'h-4 w-4',
                                isStarred
                                  ? 'fill-yellow-400 stroke-yellow-400'
                                  : 'fill-[#9D9D9D] stroke-[#9D9D9D] dark:stroke-[#9D9D9D]',
                              )}
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-white dark:bg-[#313131]">
                          {isStarred
                            ? t('common.threadDisplay.unstar')
                            : t('common.threadDisplay.star')}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Reply All Button */}
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMode('replyAll');
                              setActiveReplyId(emailData?.latest?.id ?? '');
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-lg border bg-white/90 backdrop-blur-sm hover:bg-white dark:border-none dark:bg-[#313131]/90 dark:hover:bg-[#313131]"
                          >
                            <Reply className="fill-muted-foreground dark:fill-[#9B9B9B]" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-white dark:bg-[#313131]">
                          Reply to all
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Archive Button */}
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => moveThreadTo('archive')}
                            className="inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-lg border bg-white/90 backdrop-blur-sm hover:bg-white dark:border-none dark:bg-[#313131]/90 dark:hover:bg-[#313131]"
                          >
                            <Archive2 className="fill-muted-foreground dark:fill-[#9B9B9B]" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-white dark:bg-[#313131]">
                          {t('common.threadDisplay.archive')}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Trash Button */}
                    {!isInBin && (
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => moveThreadTo('bin')}
                              className="inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-lg border bg-white/90 backdrop-blur-sm hover:bg-white focus:outline-none focus:ring-0 dark:border-none dark:bg-[#313131]/90 dark:hover:bg-[#313131]"
                            >
                              <Trash className="fill-iconLight dark:fill-iconDark" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="bg-white dark:bg-[#313131]">
                            {t('common.mail.moveToBin')}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {/* Dropdown Menu */}
                    <DropdownMenu>
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <button className="inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-lg border bg-white/90 backdrop-blur-sm hover:bg-white focus:outline-none focus:ring-0 dark:border-none dark:bg-[#313131]/90 dark:hover:bg-[#313131]">
                                <ThreeDots className="fill-iconLight dark:fill-iconDark" />
                              </button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="bg-white dark:bg-[#313131]">
                            More actions
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DropdownMenuContent align="end" className="bg-white dark:bg-[#313131]">
                        {isInSpam || isInArchive || isInBin ? (
                          <DropdownMenuItem onClick={() => moveThreadTo('inbox')}>
                            <Inbox className="mr-2 h-4 w-4" />
                            <span>{t('common.mail.moveToInbox')}</span>
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => moveThreadTo('spam')}>
                              <ArchiveX className="fill-iconLight dark:fill-iconDark mr-2" />
                              <span>{t('common.threadDisplay.moveToSpam')}</span>
                            </DropdownMenuItem>
                            {emailData.latest?.listUnsubscribe ||
                            emailData.latest?.listUnsubscribePost ? (
                              <DropdownMenuItem onClick={handleUnsubscribeProcess}>
                                <Folders className="fill-iconLight dark:fill-iconDark mr-2" />
                                <span>Unsubscribe</span>
                              </DropdownMenuItem>
                            ) : null}
                          </>
                        )}
                        {!isImportant && (
                          <DropdownMenuItem onClick={handleToggleImportant}>
                            <Lightning className="fill-iconLight dark:fill-iconDark mr-2" />
                            {t('common.mail.markAsImportant')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>

              <div className="relative mx-auto flex-1 md:max-w-[650px] lg:max-w-[700px]">
                <ThreadDisplay />
              </div>
            </ResizablePanel>
          )}

          {isMobile && threadId && (
            <div className="bg-panelLight dark:bg-panelDark fixed inset-0 z-50">
              <div className="flex h-full flex-col">
                <div className="h-full overflow-y-auto outline-none">
                  <ThreadDisplay />
                </div>
              </div>
            </div>
          )}

          <AISidebar />
          <AIToggleButton />
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}

function BulkSelectActions() {
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);
  const [isUnsub, setIsUnsub] = useState(false);
  const [mail, setMail] = useMail();
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
  const [{ refetch: refetchThreads }] = useThreads();
  const { refetch: refetchStats } = useStats();
  const {
    optimisticMarkAsRead,
    optimisticToggleStar,
    optimisticMoveThreadsTo,
    optimisticDeleteThreads,
  } = useOptimisticActions();

  const handleMassUnsubscribe = async () => {
    setIsLoading(true);
    toast.promise(
      Promise.all(
        mail.bulkSelected.filter(Boolean).map(async (bulkSelected) => {
          await new Promise((resolve) => setTimeout(resolve, 499));
          const emailData = await trpcClient.mail.get.query({ id: bulkSelected });
          if (emailData) {
            const firstEmail = emailData.latest;
            if (firstEmail)
              return handleUnsubscribe({ emailData: firstEmail }).catch((e) => {
                toast.error(e.message ?? 'Unknown error while unsubscribing');
              });
          }
        }),
      ).then(async () => {
        setIsUnsub(false);
        setIsLoading(false);
        await refetchThreads();
        await refetchStats();
        setMail({ ...mail, bulkSelected: [] });
      }),
      {
        loading: 'Unsubscribing...',
        success: 'All done! you will no longer receive emails from these mailing lists.',
        error: 'Something went wrong!',
      },
    );
  };

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setMail({ ...mail, bulkSelected: [] });
          }}
          className="bg-muted flex h-6 items-center gap-1 rounded-md px-2 text-xs text-[#A0A0A0] dark:bg-[#313131]"
        >
          <X className="h-3 w-3 fill-[#A0A0A0]" />
          <span>esc</span>
        </button>
        <div className="hidden items-center gap-1 md:flex">
          <div
            className={cn(
              'flex h-[13px] w-[13px] items-center justify-center rounded border-2 border-[#484848] transition-colors',
              'border-none bg-[#3B82F6]',
            )}
          >
            <Check className="fill-panelLight dark:fill-panelDark relative top-[0.5px] h-2 w-2" />
          </div>
          <span className="text-sm">
            {mail.bulkSelected.length} selected email{mail.bulkSelected.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex aspect-square h-7 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-2 text-sm transition-all duration-300 ease-out hover:bg-gray-100 dark:border-none dark:bg-[#313131] dark:hover:bg-[#313131]/80"
              onClick={() => {
                if (mail.bulkSelected.length === 0) return;
                optimisticMarkAsRead(mail.bulkSelected);
                setMail({ ...mail, bulkSelected: [] });
              }}
            >
              <div className="relative overflow-visible">
                <Eye className="fill-[#9D9D9D] dark:fill-[#9D9D9D]" />{' '}
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('common.mail.markAsRead')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex aspect-square h-7 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-2 text-sm transition-all duration-300 ease-out hover:bg-gray-100 dark:border-none dark:bg-[#313131] dark:hover:bg-[#313131]/80"
              onClick={() => {
                if (mail.bulkSelected.length === 0) return;
                optimisticToggleStar(mail.bulkSelected, true);
                setMail({ ...mail, bulkSelected: [] });
              }}
            >
              <div className="relative overflow-visible">
                <Star2 className="fill-[#9D9D9D] stroke-[#9D9D9D] dark:stroke-[#9D9D9D]" />
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('common.mail.starAll')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex aspect-square h-7 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-2 text-sm transition-all duration-300 ease-out hover:bg-gray-100 dark:border-none dark:bg-[#313131] dark:hover:bg-[#313131]/80"
              onClick={() => {
                if (mail.bulkSelected.length === 0) return;
                optimisticMoveThreadsTo(mail.bulkSelected, folder, 'archive');
                setMail({ ...mail, bulkSelected: [] });
              }}
            >
              <div className="relative overflow-visible">
                <Archive2 className="fill-[#9D9D9D]" />
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('common.mail.archive')}</TooltipContent>
        </Tooltip>

        <Dialog onOpenChange={setIsUnsub} open={isUnsub}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <button className="flex aspect-square h-7 items-center justify-center gap-1 overflow-hidden rounded-md border bg-white px-2 text-sm transition-all duration-300 ease-out hover:bg-gray-100 dark:border-none dark:bg-[#313131] dark:hover:bg-[#313131]/80">
                  <div className="relative overflow-visible">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.3}
                      stroke="currentColor"
                      className="size-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
                        strokeOpacity={0.6}
                      />
                    </svg>
                  </div>
                </button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>{t('common.mail.unSubscribeFromAll')}</TooltipContent>
          </Tooltip>

          <DialogContent
            showOverlay
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleMassUnsubscribe();
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Mass Unsubscribe</DialogTitle>
              <DialogDescription>
                We will remove you from all of the mailing lists in the selected threads. If your
                action is required to unsubscribe from certain threads, you will be notified.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" className="mt-3 h-7" onClick={() => setIsUnsub(false)}>
                <span>Cancel</span>{' '}
              </Button>
              <Button
                className="mt-3 h-8 [&_svg]:size-3.5"
                disabled={isLoading}
                onClick={handleMassUnsubscribe}
              >
                <span>Unsubscribe</span>
                <div className="flex h-5 items-center justify-center gap-1 rounded-sm bg-white/10 px-1 dark:bg-black/10">
                  <Command className="h-2 w-3 text-white dark:text-[#929292]" />
                  <CurvedArrow className="mt-1.5 h-5 w-3.5 fill-white dark:fill-[#929292]" />
                </div>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex aspect-square h-7 items-center justify-center gap-1 overflow-hidden rounded-md border border-[#FCCDD5] bg-[#FDE4E9] px-2 text-sm transition-all duration-300 ease-out hover:bg-[#FDE4E9]/80 dark:border-[#6E2532] dark:bg-[#411D23] dark:hover:bg-[#313131]/80 hover:dark:bg-[#411D23]/60"
              onClick={() => {
                if (mail.bulkSelected.length === 0) return;
                optimisticDeleteThreads(mail.bulkSelected, folder);
                setMail({ ...mail, bulkSelected: [] });
              }}
            >
              <div className="relative overflow-visible">
                <Trash className="fill-[#F43F5E]" />
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('common.mail.moveToBin')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export const Categories = () => {
  const t = useTranslations();
  const defaultCategoryIdInner = useDefaultCategoryId();
  const categorySettings = useCategorySettings();
  const defaultCategoryId = useDefaultCategoryId();
  const [activeCategory] = useQueryState('category', { defaultValue: defaultCategoryId });

  const categories = categorySettings.map((cat) => {
    const base = {
      id: cat.id,
      // Use customized name directly from user settings, fallback to translation only if not set
      name: cat.name || t(`common.mailCategories.${cat.id.toLowerCase().replace(' ', '')}` as any),
      // Use customized search value from user settings
      searchValue: cat.searchValue,
      // Include order for potential sorting/display logic
      order: cat.order,
      // Include default flag for UI indicators
      isDefault: cat.isDefault,
    } as const;

    // Helper to decide fill colour depending on selection
    const isSelected = activeCategory === cat.id;
    if (cat.icon && cat.icon in CustomIcons) {
      const DynamicIcon = CustomIcons[cat.icon as keyof typeof CustomIcons];
      return {
        ...base,
        icon: (
          <DynamicIcon
            className={cn(
              'fill-muted-foreground h-4 w-4 dark:fill-white',
              isSelected && 'fill-white',
            )}
          />
        ),
      };
    }

    switch (cat.id) {
      case 'Important':
        return {
          ...base,
          icon: (
            <Lightning
              className={cn('fill-muted-foreground dark:fill-white', isSelected && 'fill-white')}
            />
          ),
        };
      case 'All Mail':
        return {
          ...base,
          icon: (
            <Mail
              className={cn(isSelected ? 'fill-white' : 'fill-muted-foreground dark:fill-white')}
            />
          ),
          colors:
            'border-0  text-white dark:bg-[#006FFE] dark:text-white dark:hover:bg-[#006FFE]/90',
        };
      case 'Personal':
        return {
          ...base,
          icon: (
            <User
              className={cn(
                'fill-muted-foreground h-3.5 w-3.5 dark:fill-white',
                isSelected && 'fill-white',
              )}
            />
          ),
        };
      case 'Promotions':
        return {
          ...base,
          icon: (
            <MegaPhone
              className={cn(
                'fill-muted-foreground h-3.5 w-3.5 dark:fill-white',
                isSelected && 'fill-white',
              )}
            />
          ),
        };
      case 'Updates':
        return {
          ...base,
          icon: (
            <Bell
              className={cn('fill-muted-foreground dark:fill-white', isSelected && 'fill-white')}
            />
          ),
        };
      case 'Unread':
        return {
          ...base,
          icon: (
            <ScanEye
              className={cn(
                'fill-muted-foreground h-4 w-4 dark:fill-white',
                isSelected && 'fill-white',
              )}
            />
          ),
        };
      default:
        return base as any;
    }
  });

  return categories;
};

type CategoryType = ReturnType<typeof Categories>[0];

function getCategoryColor(categoryId: string): string {
  switch (categoryId.toLowerCase()) {
    case 'primary':
      return 'bg-[#006FFE]';
    case 'all mail':
      return 'bg-[#006FFE]';
    case 'important':
      return 'bg-[#8B5CF6]';
    case 'promotions':
      return 'bg-[#F43F5E]';
    case 'personal':
      return 'bg-[#39ae4a]';
    case 'updates':
      return 'bg-[#F59E0D] ';
    case 'unread':
      return 'bg-[#FF4800]';
    default:
      return 'bg-base-primary-500';
  }
}

function NavigationDropdown() {
  const location = useLocation();
  const { data: stats } = useStats();
  const navigate = useNavigate();
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  const { currentSection, navItems } = useMemo(() => {
    // Find which section we're in based on the pathname
    const section = Object.entries(navigationConfig).find(([, config]) =>
      location.pathname.startsWith(config.path),
    );

    const currentSection = section?.[0] || 'mail';
    if (navigationConfig[currentSection]) {
      const items = [...navigationConfig[currentSection].sections];

      if (currentSection === 'mail' && stats && stats.length) {
        if (items[0]?.items[0]) {
          items[0].items[0].badge =
            stats.find((stat) => stat.label?.toLowerCase() === FOLDERS.INBOX)?.count ?? 0;
        }
        if (items[0]?.items[3]) {
          items[0].items[3].badge =
            stats.find((stat) => stat.label?.toLowerCase() === FOLDERS.SENT)?.count ?? 0;
        }
      }

      return { currentSection, navItems: items };
    } else {
      return {
        currentSection: '',
        navItems: [],
      };
    }
  }, [location.pathname, stats]);

  const allItems = [...navItems, ...bottomNavItems];

  // Find current folder name and icon from navigation items
  const currentFolder = useMemo(() => {
    for (const section of allItems) {
      if (section.items) {
        const foundItem = section.items.find((item) => {
          const urlParts = item.url.split('/');
          const folderFromUrl = urlParts[urlParts.length - 1];
          return folderFromUrl === folder;
        });
        if (foundItem) {
          return {
            name: t(foundItem.title as any),
            icon: foundItem.icon,
          };
        }
      }
    }
    return {
      name: folder.charAt(0).toUpperCase() + folder.slice(1),
      icon: null,
    };
  }, [allItems, folder, t]);

  return (
    <DropdownMenu onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="bg-muted flex h-7 items-center gap-1 rounded-md border-none px-1.5 dark:bg-[#2C2C2C]"
        >
          {currentFolder.icon && <currentFolder.icon className="h-4 w-4" />}
          <span className="text-sm">{currentFolder.name}</span>
          <ChevronDown
            className={`text-muted-foreground h-2 w-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-muted w-56 font-medium dark:bg-[#2C2C2C]" align="start">
        {allItems.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            {section.title && (
              <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                {t(section.title as any)}
              </div>
            )}
            {section.items?.map((item) => (
              <DropdownMenuItem
                key={item.title}
                className="flex cursor-pointer items-center justify-between hover:bg-white/10"
                onClick={() => navigate(item.url)}
              >
                <div className="flex items-center gap-2">
                  {item.icon && <item.icon className="h-4 w-4" />}
                  <span>{t(item.title as any)}</span>
                </div>
                {(item as any).badge && (item as any).badge > 0 && (
                  <Badge variant="secondary" className="ml-auto h-5 rounded px-1 text-xs">
                    {(item as any).badge}
                  </Badge>
                )}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserAccountSelect() {
  const { data: connections } = useConnections();
  const { data: activeConnection, refetch: refetchActiveConnection } = useActiveConnection();
  const { revalidate } = useRevalidator();
  const { data: session, refetch: refetchSession } = useSession();
  const trpc = useTRPC();
  const { isPro, openBillingPortal, customer: billingCustomer } = useBilling();
  const [, setPricingDialog] = useQueryState('pricingDialog');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const t = useTranslations();

  const { mutateAsync: setDefaultConnection } = useMutation(
    trpc.connections.setDefault.mutationOptions(),
  );

  const activeAccount = useMemo(() => {
    if (!activeConnection || !connections) return null;
    return connections.connections?.find((connection) => connection.id === activeConnection.id);
  }, [activeConnection, connections]);

  const otherConnections = useMemo(() => {
    if (!connections || !activeAccount) return [];
    return connections.connections.filter((connection) => connection.id !== activeAccount?.id);
  }, [connections, activeAccount]);

  const handleAccountSwitch = (connectionId: string) => async () => {
    if (connectionId === activeConnection?.id) return;
    await setDefaultConnection({ connectionId });
    await refetchActiveConnection();
    await revalidate();
    refetchSession();
  };

  const getSettingsHref = useCallback(() => {
    const currentPath = location.pathname;
    return `/settings/general?from=${encodeURIComponent(currentPath)}`;
  }, [location.pathname]);

  const handleClearCache = useCallback(async () => {
    queryClient.clear();
    await idbClear();
    toast.success('Cache cleared successfully');
  }, [queryClient]);

  const handleCopyConnectionId = useCallback(async () => {
    await navigator.clipboard.writeText(activeConnection?.id || '');
    toast.success('Connection ID copied to clipboard');
  }, [activeConnection]);

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    toast.promise(signOut(), {
      loading: 'Signing out...',
      success: () => 'Signed out successfully!',
      error: 'Error signing out',
      async finally() {
        await handleClearCache();
        window.location.href = '/login';
      },
    });
  };

  if (!activeAccount || !connections) return null;

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div
            className={`flex cursor-pointer items-center ${
              activeAccount.id === activeConnection?.id && connections.connections.length > 1
                ? 'outline-mainBlue rounded-[5px] outline outline-2'
                : ''
            }`}
          >
            <div className="relative">
              <Avatar className="size-7 rounded-[7px]">
                <AvatarImage
                  className="rounded-[5px]"
                  src={activeAccount.picture || undefined}
                  alt={activeAccount.name || activeAccount.email}
                />
                <AvatarFallback className="rounded-[7px] text-[10px] dark:bg-[#2C2C2C]">
                  {(activeAccount.name || activeAccount.email)
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              {activeAccount.id === activeConnection?.id && connections.connections.length > 1 && (
                <CircleCheck className="fill-mainBlue absolute -bottom-2 -right-2 size-4 rounded-full bg-white dark:bg-[#141414]" />
              )}
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[--radix-dropdown-menu-trigger-width] min-w-56 bg-white font-medium dark:bg-[#131313]"
          align="start"
          side="bottom"
          sideOffset={8}
        >
          {session && activeAccount && (
            <>
              <div className="flex flex-col items-center p-3 text-center">
                <Avatar className="border-border/50 mb-2 size-14 rounded-xl border">
                  <AvatarImage
                    className="rounded-xl"
                    src={(activeAccount.picture ?? undefined) || (session.user.image ?? undefined)}
                    alt={activeAccount.name || session.user.name || 'User'}
                  />
                  <AvatarFallback className="rounded-xl">
                    <span>
                      {(activeAccount.name || session.user.name || 'User')
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </span>
                  </AvatarFallback>
                </Avatar>
                <div className="w-full">
                  <div className="flex items-center justify-center gap-0.5 text-sm font-medium">
                    {activeAccount.name || session.user.name || 'User'}
                    {isPro && (
                      <BadgeCheck
                        className="h-4 w-4 text-white dark:text-[#141414]"
                        fill="#1D9BF0"
                      />
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">{activeAccount.email}</div>
                </div>
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          <div className="space-y-1">
            <>
              <p className="text-muted-foreground px-2 py-1 text-[11px] font-medium">
                {t('common.navUser.accounts')}
              </p>

              {connections.connections
                ?.filter((connection) => connection.id !== activeConnection?.id)
                .map((connection) => (
                  <DropdownMenuItem
                    key={connection.id}
                    onClick={handleAccountSwitch(connection.id)}
                    className="flex cursor-pointer items-center gap-3 py-1"
                  >
                    <Avatar className="size-7 rounded-lg">
                      <AvatarImage
                        className="rounded-lg"
                        src={connection.picture || undefined}
                        alt={connection.name || connection.email}
                      />
                      <AvatarFallback className="rounded-lg text-[10px]">
                        {(connection.name || connection.email)
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="-space-y-0.5">
                      <p className="text-[12px]">{connection.name || connection.email}</p>
                      {connection.name && (
                        <p className="text-muted-foreground text-[11px]">
                          {connection.email.length > 25
                            ? `${connection.email.slice(0, 25)}...`
                            : connection.email}
                        </p>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              <AddConnectionDialog />

              <DropdownMenuSeparator className="my-1" />

              {billingCustomer?.stripe_id ? (
                <DropdownMenuItem onClick={() => openBillingPortal()}>
                  <div className="flex items-center gap-2">
                    <BanknoteIcon size={16} className="opacity-60" />
                    <p className="text-[13px] opacity-60">Billing</p>
                  </div>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={handleThemeToggle} className="cursor-pointer">
                <div className="flex w-full items-center gap-2">
                  {theme === 'dark' ? (
                    <MoonIcon className="size-4 opacity-60" />
                  ) : (
                    <SunIcon className="size-4 opacity-60" />
                  )}
                  <p className="text-[13px] opacity-60">{t('common.navUser.appTheme')}</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={getSettingsHref()} className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Settings size={16} className="opacity-60" />
                    <p className="text-[13px] opacity-60">{t('common.actions.settings')}</p>
                  </div>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <a href="https://discord.gg/0email" target="_blank" className="w-full">
                  <div className="flex items-center gap-2">
                    <HelpCircle size={16} className="opacity-60" />
                    <p className="text-[13px] opacity-60">{t('common.navUser.customerSupport')}</p>
                  </div>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
                <div className="flex items-center gap-2">
                  <LogOut size={16} className="opacity-60" />
                  <p className="text-[13px] opacity-60">{t('common.actions.logout')}</p>
                </div>
              </DropdownMenuItem>
            </>
          </div>
          <>
            <DropdownMenuSeparator className="mt-1" />
            <div className="text-muted-foreground/60 flex items-center justify-center gap-1 px-2 pb-2 pt-1 text-[10px]">
              <a href="/privacy" className="hover:underline">
                Privacy
              </a>
              <span>·</span>
              <a href="/terms" className="hover:underline">
                Terms
              </a>
            </div>
          </>
        </DropdownMenuContent>
      </DropdownMenu>

      {otherConnections.slice(0, 2).map((connection) => (
        <Tooltip key={connection.id}>
          <TooltipTrigger asChild>
            <button
              onClick={handleAccountSwitch(connection.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleAccountSwitch(connection.id)();
                }
              }}
              aria-label={`Switch to ${connection.email}`}
              className={`flex cursor-pointer items-center ${
                connection.id === activeConnection?.id && otherConnections.length > 1
                  ? 'outline-mainBlue rounded-[5px] outline outline-2'
                  : ''
              }`}
            >
              <div className="relative">
                <Avatar className="size-6 rounded-[7px]">
                  <AvatarImage
                    className="rounded-[5px]"
                    src={connection.picture || undefined}
                    alt={connection.name || connection.email}
                  />
                  <AvatarFallback className="rounded-[7px] text-[10px]">
                    {(connection.name || connection.email)
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                {connection.id === activeConnection?.id && otherConnections.length > 1 && (
                  <CircleCheck className="fill-mainBlue absolute -bottom-2 -right-2 size-4 rounded-full bg-white dark:bg-[#141414]" />
                )}
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-muted-foreground text-xs">
            {connection.email}
          </TooltipContent>
        </Tooltip>
      ))}

      {otherConnections.length > 2 && (
        <button 
          className="hover:bg-muted flex h-6 w-6 cursor-pointer items-center justify-center rounded-[7px]"
          aria-label={`${otherConnections.length - 2} more accounts available`}
        >
          <span className="text-[10px]">+{otherConnections.length - 2}</span>
        </button>
      )}

      {!isPro ? (
        <AddConnectionDialog>
          <button className="bg-muted flex hidden h-7 w-7 cursor-pointer items-center justify-center rounded-[5px] border border-dashed lg:flex dark:bg-[#262626] dark:text-[#929292]">
            <Plus className="size-4" />
          </button>
        </AddConnectionDialog>
      ) : (
        <button
          onClick={() => setPricingDialog('true')}
          className="hover:bg-offsetLight/80 bg-muted flex hidden h-7 w-7 cursor-pointer items-center justify-center rounded-[5px] border border-dashed px-0 text-black lg:flex dark:bg-[#262626] dark:text-[#929292]"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}

function LabelSelect({ isMultiSelectMode }: { isMultiSelectMode: boolean }) {
  const [searchValue, setSearchValue] = useSearchValue();
  const { data: labels = [] } = useLabels();
  const [mail, setMail] = useMail();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  // Extract selected labels from search value
  useEffect(() => {
    const labelMatches = searchValue.value.match(/label:([^\s]+)/g);
    if (labelMatches) {
      const labelNames = labelMatches.map((match) => match.replace('label:', ''));
      setSelectedLabels(labelNames);
    } else {
      setSelectedLabels([]);
    }
  }, [searchValue.value]);

  const handleLabelToggle = useCallback(
    (labelName: string) => {
      const isSelected = selectedLabels.includes(labelName);
      let newSelectedLabels;

      if (isSelected) {
        newSelectedLabels = selectedLabels.filter((name) => name !== labelName);
      } else {
        newSelectedLabels = [...selectedLabels, labelName];
      }

      // Update search value
      let newSearchValue = searchValue.value;

      // Remove all existing label filters
      newSearchValue = newSearchValue.replace(/label:[^\s]+/g, '').trim();

      // Add new label filters
      if (newSelectedLabels.length > 0) {
        const labelQueries = newSelectedLabels.map((name) => `label:${name}`).join(' ');
        newSearchValue = newSearchValue ? `${newSearchValue} ${labelQueries}` : labelQueries;
      }

      setSearchValue({
        ...searchValue,
        value: newSearchValue,
      });

      setMail({ ...mail, bulkSelected: [] });
    },
    [selectedLabels, searchValue, setSearchValue, mail, setMail],
  );

  const clearAllLabels = useCallback(() => {
    const newSearchValue = searchValue.value.replace(/label:[^\s]+/g, '').trim();
    setSearchValue({
      ...searchValue,
      value: newSearchValue,
    });
    setMail({ ...mail, bulkSelected: [] });
  }, [searchValue, setSearchValue, mail, setMail]);

  // Filter out system labels and only show user labels
  const userLabels = labels.filter(
    (label) =>
      label.type === 'user' &&
      label.name &&
      !['INBOX', 'SENT', 'DRAFT', 'TRASH', 'SPAM', 'STARRED', 'IMPORTANT', 'UNREAD'].includes(
        label.name.toUpperCase(),
      ),
  );

  // Get selected label objects for display
  const selectedLabelObjects = userLabels.filter((label) =>
    selectedLabels.includes(label.name || ''),
  );

  if (isMultiSelectMode || userLabels.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="bg-muted flex h-7 min-w-fit items-center gap-1 rounded-md border-none px-2 dark:bg-[#2C2C2C]"
          >
            {selectedLabelObjects.length === 0 ? (
              <>
                <Tag className="fill-iconLight dark:fill-iconDark h-4 w-4" />
              </>
            ) : (
              <>
                <Tag className="fill-iconLight dark:fill-iconDark h-4 w-4" />
                <div className="flex hidden items-center gap-1 md:flex">
                  <span className="text-muted-foreground text-xs">Any of:</span>
                  {selectedLabelObjects.slice(0, 2).map((label) => (
                    <div
                      key={label.id}
                      className={cn(
                        'inline-block overflow-hidden truncate rounded bg-[#E8DEFD] px-1.5 py-0.5 text-xs font-medium text-[#2C2241] dark:bg-[#2C2241] dark:text-[#E8DEFD]',
                      )}
                      style={{
                        backgroundColor: label.color?.backgroundColor,
                        color: label.color?.textColor,
                      }}
                    >
                      {label.name}
                    </div>
                  ))}
                  {selectedLabelObjects.length > 2 && (
                    <span className="text-muted-foreground text-xs">
                      +{selectedLabelObjects.length - 2}
                    </span>
                  )}
                </div>
              </>
            )}
            <ChevronDown
              className={`text-muted-foreground hidden h-2 w-2 transition-transform duration-200 lg:block ${isOpen ? 'rotate-180' : 'rotate-0'}`}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-muted w-56 font-medium dark:bg-[#2C2C2C]" align="start">
          <div className="p-2">
            <div className="mb-2 flex w-full items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">Select Labels</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {userLabels.map((label) => (
                <div
                  key={label.id}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded py-1"
                  onClick={() => label.name && handleLabelToggle(label.name)}
                >
                  <div
                    className={cn(
                      'inline-block overflow-hidden truncate rounded bg-[#E8DEFD] px-1.5 py-0.5 text-xs font-medium text-[#2C2241] dark:bg-[#2C2241] dark:text-[#E8DEFD]',
                      searchValue.value.includes(`label:${label.name}`) && 'border-white',
                    )}
                    style={{
                      backgroundColor: label.color?.backgroundColor,
                      color: label.color?.textColor,
                    }}
                  >
                    {label.name}
                  </div>
                  <div
                    className={cn(
                      'flex h-[13px] w-[13px] items-center justify-center rounded border-2 border-[#484848] transition-colors',
                      selectedLabels.includes(label.name || '') && 'border-none bg-[#3B82F6]',
                    )}
                  >
                    {selectedLabels.includes(label.name || '') && (
                      <Check className="relative top-[0.5px] h-2 w-2 text-white dark:fill-[#141414]" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {userLabels.length === 0 && (
              <div className="py-4 text-center">
                <p className="text-muted-foreground text-sm">No custom labels found</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Create labels in your email client to filter by them
                </p>
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CategorySelect({ isMultiSelectMode }: { isMultiSelectMode: boolean }) {
  const [mail, setMail] = useMail();
  const [searchValue, setSearchValue] = useSearchValue();
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
  const defaultCategoryIdInner = useDefaultCategoryId();
  const [category, setCategory] = useQueryState('category', {
    defaultValue: defaultCategoryIdInner,
  });
  const categories = Categories();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTabElementRef = useRef<HTMLButtonElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const [textSize, setTextSize] = useState<'normal' | 'small' | 'xs' | 'hidden'>('normal');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  if (folder !== 'inbox') return <div className="h-8"></div>;

  useEffect(() => {
    const checkTextSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.offsetWidth;
      const selectedCategory = categories.find((cat) => cat.id === category);

      // Calculate approximate widths needed for different text sizes
      const baseIconWidth = (categories.length - 1) * 40; // unselected icons + gaps
      const selectedTextLength = selectedCategory ? selectedCategory.name.length : 10;

      // Estimate width needed for different text sizes
      const normalTextWidth = selectedTextLength * 8 + 60; // normal text
      const smallTextWidth = selectedTextLength * 7 + 50; // smaller text
      const xsTextWidth = selectedTextLength * 6 + 40; // extra small text
      const minIconWidth = 40; // minimum width for icon-only selected button

      const totalNormal = baseIconWidth + normalTextWidth;
      const totalSmall = baseIconWidth + smallTextWidth;
      const totalXs = baseIconWidth + xsTextWidth;
      const totalIconOnly = baseIconWidth + minIconWidth;

      if (containerWidth >= totalNormal) {
        setTextSize('normal');
      } else if (containerWidth >= totalSmall) {
        setTextSize('small');
      } else if (containerWidth >= totalXs) {
        setTextSize('xs');
      } else if (containerWidth >= totalIconOnly) {
        setTextSize('hidden'); // Hide text but keep button wide
      } else {
        setTextSize('hidden'); // Hide text in very tight spaces
      }
    };

    checkTextSize();

    // Use ResizeObserver to handle container size changes
    const resizeObserver = new ResizeObserver(() => {
      checkTextSize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [category, categories]);

  const renderCategoryButton = (cat: CategoryType, isOverlay = false, idx: number) => {
    const isSelected = cat.id === (category || 'All Mail');
    const bgColor = getCategoryColor(cat.id);

    return (
      <Tooltip key={cat.id}>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              setCategory(cat.id);
              setSearchValue({
                value: `${cat.searchValue} ${cleanSearchValue(searchValue.value).trim().length ? `AND ${cleanSearchValue(searchValue.value)}` : ''}`,
                highlight: '',
                folder: '',
              });
              setMail({ ...mail, bulkSelected: [] });
            }}
            className={cn(
              'flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-lg border-none transition-colors',
              isSelected ? cn('flex-1 border-none text-white', bgColor) : 'h-7 w-7',
            )}
          >
            <div className="relative overflow-visible rounded-lg">{cat.icon}</div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span>{cat.name}</span>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Update clip path when category changes
  useEffect(() => {
    const container = overlayContainerRef.current;
    const activeTabElement = activeTabElementRef.current;

    if (category && container && activeTabElement) {
      setMail({ ...mail, bulkSelected: [] });
      const { offsetLeft, offsetWidth } = activeTabElement;
      const clipLeft = Math.max(0, offsetLeft - 2);
      const clipRight = Math.min(container.offsetWidth, offsetLeft + offsetWidth + 2);
      const containerWidth = container.offsetWidth;

      if (containerWidth) {
        container.style.clipPath = `inset(0 ${Number(100 - (clipRight / containerWidth) * 100).toFixed(2)}% 0 ${Number((clipLeft / containerWidth) * 100).toFixed(2)}%)`;
      }
    }
  }, [category, textSize]); // Changed from showText to textSize

  if (isMultiSelectMode) {
    return <BulkSelectActions />;
  }

  return (
    <div className="bg-muted relative h-7 w-full rounded-lg dark:bg-[#0F0F0F]">
      <div className="flex w-full items-start justify-start gap-0.5">
        {categories.map((cat, idx) => renderCategoryButton(cat, false, idx))}
      </div>
    </div>
  );
}

function CategoryDropdown({ isMultiSelectMode }: { isMultiSelectMode?: boolean }) {
  const [mail, setMail] = useMail();
  const [searchValue, setSearchValue] = useSearchValue();
  const params = useParams<{ folder: string }>();
  const folder = params?.folder ?? 'inbox';
  const [category, setCategory] = useQueryState('category', {
    defaultValue: 'All Mail',
  });
  const categories = Categories();
  const [isOpen, setIsOpen] = useState(false);

  // Only show category selection for inbox folder
  if (folder !== 'inbox' || isMultiSelectMode) return null;

  const selectedCategory = categories.find((cat) => cat.id === category) || categories[0];
  if (!selectedCategory) return null;

  const handleCategoryChange = (categoryId: string) => {
    const selectedCat = categories.find((cat) => cat.id === categoryId);
    if (!selectedCat) return;

    setCategory(categoryId);
    setSearchValue({
      value: selectedCat.searchValue,
      highlight: '',
      folder: '',
    });
    setMail({ ...mail, bulkSelected: [] });
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'flex h-7 min-w-fit items-center gap-1 rounded-md border-none px-2 text-white',
            getCategoryColor(selectedCategory.id),
          )}
        >
          <div className="relative overflow-visible">{selectedCategory.icon}</div>
          <span className="text-xs font-medium">{selectedCategory.name}</span>
          <ChevronDown
            className={`h-2 w-2 text-white transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-muted w-48 font-medium dark:bg-[#2C2C2C]" align="start">
        {categories.map((cat) => (
          <DropdownMenuItem
            key={cat.id}
            className="flex cursor-pointer items-center gap-2 hover:bg-white/10"
            onClick={() => handleCategoryChange(cat.id)}
          >
            <div className="relative">{cat.icon}</div>
            <span>{cat.name}</span>
            {cat.id === category && <Check className="ml-auto h-3 w-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MailCategoryTabs({
  iconsOnly = false,
  onCategoryChange,
  initialCategory,
}: {
  iconsOnly?: boolean;
  onCategoryChange?: (category: string) => void;
  initialCategory?: string;
}) {
  const [, setSearchValue] = useSearchValue();
  const categories = Categories();
  const defaultCategoryId = useDefaultCategoryId();
  const [activeCategory, setActiveCategory] = useQueryState('category', { 
    defaultValue: initialCategory || defaultCategoryId 
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const activeTabElementRef = useRef<HTMLButtonElement>(null);

  const activeTab = useMemo(
    () => categories.find((cat) => cat.id === activeCategory),
    [activeCategory],
  );

  // Save to localStorage when activeCategory changes
  useEffect(() => {
    if (onCategoryChange) {
      onCategoryChange(activeCategory);
    }
  }, [activeCategory, onCategoryChange]);

  useEffect(() => {
    if (activeTab) {
      setSearchValue({
        value: activeTab.searchValue,
        highlight: '',
        folder: '',
      });
    }
  }, [activeCategory, setSearchValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setSearchValue({
        value: '',
        highlight: '',
        folder: '',
      });
    };
  }, [setSearchValue]);

  // Function to update clip path
  const updateClipPath = useCallback(() => {
    const container = containerRef.current;
    const activeTabElement = activeTabElementRef.current;

    if (activeCategory && container && activeTabElement) {
      const { offsetLeft, offsetWidth } = activeTabElement;
      const clipLeft = Math.max(0, offsetLeft - 2);
      const clipRight = Math.min(container.offsetWidth, offsetLeft + offsetWidth + 2);
      const containerWidth = container.offsetWidth;

      if (containerWidth) {
        container.style.clipPath = `inset(0 ${Number(100 - (clipRight / containerWidth) * 100).toFixed(2)}% 0 ${Number((clipLeft / containerWidth) * 100).toFixed(2)}%)`;
      }
    }
  }, [activeCategory]);

  // Update clip path when active category changes
  useEffect(() => {
    updateClipPath();
  }, [activeCategory, updateClipPath]);

  // Update clip path when iconsOnly changes
  useEffect(() => {
    // Small delay to ensure DOM has updated with new sizes
    const timer = setTimeout(() => {
      updateClipPath();
    }, 10);

    return () => clearTimeout(timer);
  }, [iconsOnly, updateClipPath]);

  // Update clip path on window resize
  useEffect(() => {
    const handleResize = () => {
      updateClipPath();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateClipPath]);

  return (
    <div className="relative mx-auto w-fit">
      <ul className="flex justify-center gap-1.5">
        {categories.map((category) => (
          <li key={category.name}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  ref={activeCategory === category.id ? activeTabElementRef : null}
                  data-tab={category.id}
                  onClick={() => {
                    setActiveCategory(category.id);
                  }}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-full px-2 text-xs font-medium transition-all duration-200',
                    activeCategory === category.id
                      ? 'bg-primary text-white'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  <div className="relative overflow-visible">{category.icon}</div>
                  <span className={cn('hidden', !iconsOnly && 'md:inline')}>{category.name}</span>
                </button>
              </TooltipTrigger>
              {iconsOnly && (
                <TooltipContent>
                  <span>{category.name}</span>
                </TooltipContent>
              )}
            </Tooltip>
          </li>
        ))}
      </ul>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden transition-[clip-path] duration-300 ease-in-out"
        ref={containerRef}
      >
        <ul className="flex justify-center gap-1.5">
          {categories.map((category) => (
            <li key={category.id}>
              <button
                data-tab={category.id}
                onClick={() => {
                  setActiveCategory(category.id);
                }}
                className={cn('flex items-center gap-1.5 rounded-full px-2 text-xs font-medium')}
                tabIndex={-1}
              >
                <div className="relative overflow-visible">{category.icon}</div>
                <span className={cn('hidden', !iconsOnly && 'md:inline')}>{category.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
