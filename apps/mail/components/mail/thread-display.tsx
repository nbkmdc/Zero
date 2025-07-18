import {
  Archive,
  ArchiveX,
  ChevronLeft,
  ChevronRight,
  Folders,
  Lightning,
  Mail,
  Printer,
  Reply,
  Sparkles,
  Star,
  ThreeDots,
  Trash,
  X,
} from '../icons/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useOptimisticThreadState } from '@/components/mail/optimistic-thread-state';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import MailDisplay, { MailDisplayLabels } from './mail-display';
import { focusedIndexAtom } from '@/hooks/use-mail-navigation';
import { type ThreadDestination } from '@/lib/thread-actions';
import { handleUnsubscribe } from '@/lib/email-utils.client';
import { ChevronDown, ChevronUp, Inbox } from 'lucide-react';
import { useThread, useThreads } from '@/hooks/use-threads';
import { useAISidebar } from '@/components/ui/ai-sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTRPC } from '@/providers/query-provider';
import { useThreadLabels } from '@/hooks/use-labels';
import { useMutation } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { RenderLabels } from './render-labels';
import { cleanHtml } from '@/lib/email-utils';
import ReplyCompose from './reply-composer';
import { NotesPanel } from './note-panel';
import { cn, FOLDERS } from '@/lib/utils';
import type { Attachment } from '@/types';
import { m } from '@/paraglide/messages';
import { useParams } from 'react-router';
import { useQueryState } from 'nuqs';
import { format } from 'date-fns';
import { useAtom } from 'jotai';
import { toast } from 'sonner';

const formatFileSize = (size: number) => {
  const sizeInMB = (size / (1024 * 1024)).toFixed(2);
  return sizeInMB === '0.00' ? '' : `${sizeInMB} MB`;
};

const cleanNameDisplay = (name?: string) => {
  if (!name) return '';
  return name.replace(/["<>]/g, '');
};

function ThreadActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  className,
  isLucide = false,
  tooltipSide = 'right',
  iconClassName,
  isDropdownTrigger = false,
  children,
  overrideDefaultIconStyling = false,
}: {
  icon: React.ComponentType<React.ComponentPropsWithRef<any>> & {
    startAnimation?: () => void;
    stopAnimation?: () => void;
  };
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  isLucide?: boolean;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  iconClassName?: string;
  isDropdownTrigger?: boolean;
  children?: React.ReactNode;
  overrideDefaultIconStyling?: boolean;
}) {
  const iconRef = useRef<any>(null);

  const ButtonComponent = isDropdownTrigger ? DropdownMenuTrigger : 'div';
  const buttonProps = isDropdownTrigger ? { asChild: true } : {};

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <ButtonComponent {...buttonProps}>
            <Button
              disabled={disabled}
              onClick={onClick}
              variant="ghost"
              className={cn('md:h-fit md:px-2', className)}
              onMouseEnter={() => iconRef.current?.startAnimation?.()}
              onMouseLeave={() => iconRef.current?.stopAnimation?.()}
            >
              <Icon 
                ref={iconRef} 
                className={cn(
                  !overrideDefaultIconStyling && (isLucide ? "text-iconLight dark:text-iconDark" : "fill-iconLight dark:fill-iconDark"),
                  iconClassName
                )} 
              />
              <span className="sr-only">{label}</span>
            </Button>
          </ButtonComponent>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>{label}</TooltipContent>
      </Tooltip>
      {children}
    </TooltipProvider>
  );
}

const Separator = () => (
  <div className="dark:bg-iconDark/20 relative h-3 w-0.5 rounded-full bg-[#E7E7E7]" />
);

const isFullscreen = false;
export function ThreadDisplay() {
  const isMobile = useIsMobile();
  const { toggleOpen: toggleAISidebar } = useAISidebar();
  const params = useParams<{ folder: string }>();

  const folder = params?.folder ?? 'inbox';
  const [id, setThreadId] = useQueryState('threadId');
  const { data: emailData, isLoading, refetch: refetchThread } = useThread(id ?? null);
  const [, items] = useThreads();
  const [isStarred, setIsStarred] = useState(false);
  const [isImportant, setIsImportant] = useState(false);

  // Collect all attachments from all messages in the thread
  const allThreadAttachments = useMemo(() => {
    if (!emailData?.messages) return [];
    return emailData.messages.reduce<Attachment[]>((acc, message) => {
      if (message.attachments && message.attachments.length > 0) {
        acc.push(...message.attachments);
      }
      return acc;
    }, []);
  }, [emailData?.messages]);

  const [mode, setMode] = useQueryState('mode');
  const [activeReplyId, setActiveReplyId] = useQueryState('activeReplyId');
  const [, setDraftId] = useQueryState('draftId');

  const [focusedIndex, setFocusedIndex] = useAtom(focusedIndexAtom);
  const trpc = useTRPC();
  const { mutateAsync: toggleImportant } = useMutation(trpc.mail.toggleImportant.mutationOptions());
  const [, setIsComposeOpen] = useQueryState('isComposeOpen');

  // Get optimistic state for this thread
  const optimisticState = useOptimisticThreadState(id ?? '');

  const handlePrevious = useCallback(() => {
    if (!id || !items.length || focusedIndex === null) return;
    if (focusedIndex > 0) {
      const prevThread = items[focusedIndex - 1];
      if (prevThread) {
        // Clear draft and reply state when navigating to previous thread
        setMode(null);
        setActiveReplyId(null);
        setDraftId(null);
        setThreadId(prevThread.id);
        setFocusedIndex(focusedIndex - 1);
      }
    }
  }, [
    items,
    id,
    focusedIndex,
    setThreadId,
    setFocusedIndex,
    setMode,
    setActiveReplyId,
    setDraftId,
  ]);

  const handleNext = useCallback(() => {
    if (!id || !items.length || focusedIndex === null) return setThreadId(null);
    if (focusedIndex < items.length - 1) {
      const nextIndex = Math.max(1, focusedIndex + 1);
      //   console.log('nextIndex', nextIndex);

      const nextThread = items[nextIndex];
      if (nextThread) {
        setMode(null);
        setActiveReplyId(null);
        setDraftId(null);
        setThreadId(nextThread.id);
        setFocusedIndex(focusedIndex + 1);
      }
    }
  }, [
    items,
    id,
    focusedIndex,
    setThreadId,
    setFocusedIndex,
    setMode,
    setActiveReplyId,
    setDraftId,
  ]);

  const handleUnsubscribeProcess = () => {
    if (!emailData?.latest) return;
    toast.promise(handleUnsubscribe({ emailData: emailData.latest }), {
      success: 'Unsubscribed successfully!',
      error: 'Failed to unsubscribe',
    });
  };

  const isInArchive = folder === FOLDERS.ARCHIVE;
  const isInSpam = folder === FOLDERS.SPAM;
  const isInBin = folder === FOLDERS.BIN;
  const handleClose = useCallback(() => {
    setThreadId(null);
    setMode(null);
    setActiveReplyId(null);
    setDraftId(null);
  }, [setThreadId, setMode, setActiveReplyId, setDraftId]);

  const { optimisticMoveThreadsTo } = useOptimisticActions();

  const moveThreadTo = useCallback(
    async (destination: ThreadDestination) => {
      if (!id) return;

      setMode(null);
      setActiveReplyId(null);
      setDraftId(null);

      optimisticMoveThreadsTo([id], folder, destination);
      handleNext();
    },
    [id, folder, optimisticMoveThreadsTo, handleNext, setMode, setActiveReplyId, setDraftId],
  );

  const { optimisticToggleStar } = useOptimisticActions();

  const handleToggleStar = useCallback(async () => {
    if (!emailData || !id) return;

    const newStarredState = !isStarred;
    optimisticToggleStar([id], newStarredState);
    setIsStarred(newStarredState);
  }, [emailData, id, isStarred, optimisticToggleStar]);

  const printThread = () => {
    try {
      // Create a hidden iframe for printing
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'absolute';
      printFrame.style.top = '-9999px';
      printFrame.style.left = '-9999px';
      printFrame.style.width = '0px';
      printFrame.style.height = '0px';
      printFrame.style.border = 'none';

      document.body.appendChild(printFrame);

      // Generate clean, simple HTML content for printing
      const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Print Thread - ${emailData?.latest?.subject || 'No Subject'}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: Arial, sans-serif;
              line-height: 1.5;
              color: #333;
              background: white;
              padding: 20px;
              font-size: 12px;
            }

            .email-container {
              max-width: 100%;
              margin: 0 auto;
              background: white;
            }

            .email-header {
              margin-bottom: 25px;
            }

            .email-title {
              font-size: 18px;
              font-weight: bold;
              color: #000;
              margin-bottom: 15px;
              word-wrap: break-word;
            }

            .email-meta {
              margin-bottom: 20px;
            }

            .meta-row {
              margin-bottom: 5px;
              display: flex;
              align-items: flex-start;
            }

            .meta-label {
              font-weight: bold;
              min-width: 60px;
              color: #333;
              margin-right: 10px;
            }

            .meta-value {
              flex: 1;
              word-wrap: break-word;
              color: #333;
            }

            .separator {
              width: 100%;
              height: 1px;
              background: #ddd;
              margin: 20px 0;
            }

            .email-body {
              margin: 20px 0;
              background: white;
            }

            .email-content {
              word-wrap: break-word;
              overflow-wrap: break-word;
              font-size: 12px;
              line-height: 1.6;
            }

            .email-content img {
              max-width: 100% !important;
              height: auto !important;
              display: block;
              margin: 10px 0;
            }

            .email-content table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }

            .email-content td, .email-content th {
              padding: 6px;
              text-align: left;
              font-size: 11px;
            }

            .email-content a {
              color: #0066cc;
              text-decoration: underline;
            }

            .attachments-section {
              margin-top: 25px;
              background: white;
            }

            .attachments-title {
              font-size: 14px;
              font-weight: bold;
              color: #000;
              margin-bottom: 10px;
            }

            .attachment-item {
              margin-bottom: 5px;
              font-size: 11px;
              padding: 3px 0;
            }

            .attachment-name {
              font-weight: 500;
              color: #333;
            }

            .attachment-size {
              color: #666;
              font-size: 10px;
            }

            .labels-section {
              margin: 10px 0;
            }

            .label-badge {
              display: inline-block;
              padding: 2px 6px;
              background: #f5f5f5;
              color: #333;
              font-size: 10px;
              margin-right: 5px;
              margin-bottom: 3px;
            }

            @media print {
              body {
                margin: 0;
                padding: 15px;
                font-size: 11px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              .email-container {
                max-width: none;
                width: 100%;
              }

              .separator {
                background: #000 !important;
              }

              .email-content a {
                color: #000 !important;
              }

              .label-badge {
                background: #f0f0f0 !important;
                border: 1px solid #ccc;
              }

              .no-print {
                display: none !important;
              }

              * {
                border: none !important;
                box-shadow: none !important;
              }

              .email-header {
                page-break-after: avoid;
              }

              .attachments-section {
                page-break-inside: avoid;
              }
            }

            @page {
              margin: 0.5in;
              size: A4;
            }
          </style>
        </head>
        <body>
          ${emailData?.messages
            ?.map(
              (message, index) => `
            <div class="email-container">
              <div class="email-header">
                ${index === 0 ? `<h1 class="email-title">${message.subject || 'No Subject'}</h1>` : ''}


                ${
                  message?.tags && message.tags.length > 0
                    ? `
                  <div class="labels-section">
                    ${message.tags
                      .map((tag) => `<span class="label-badge">${tag.name}</span>`)
                      .join('')}
                  </div>
                `
                    : ''
                }


                <div class="email-meta">
                  <div class="meta-row">
                    <span class="meta-label">From:</span>
                    <span class="meta-value">
                      ${cleanNameDisplay(message.sender?.name)}
                      ${message.sender?.email ? `<${message.sender.email}>` : ''}
                    </span>
                  </div>


                  ${
                    message.to && message.to.length > 0
                      ? `
                    <div class="meta-row">
                      <span class="meta-label">To:</span>
                      <span class="meta-value">
                        ${message.to
                          .map(
                            (recipient) =>
                              `${cleanNameDisplay(recipient.name)} <${recipient.email}>`,
                          )
                          .join(', ')}
                      </span>
                    </div>
                  `
                      : ''
                  }


                  ${
                    message.cc && message.cc.length > 0
                      ? `
                    <div class="meta-row">
                      <span class="meta-label">CC:</span>
                      <span class="meta-value">
                        ${message.cc
                          .map(
                            (recipient) =>
                              `${cleanNameDisplay(recipient.name)} <${recipient.email}>`,
                          )
                          .join(', ')}
                      </span>
                    </div>
                  `
                      : ''
                  }


                  ${
                    message.bcc && message.bcc.length > 0
                      ? `
                    <div class="meta-row">
                      <span class="meta-label">BCC:</span>
                      <span class="meta-value">
                        ${message.bcc
                          .map(
                            (recipient) =>
                              `${cleanNameDisplay(recipient.name)} <${recipient.email}>`,
                          )
                          .join(', ')}
                      </span>
                    </div>
                  `
                      : ''
                  }


                  <div class="meta-row">
                    <span class="meta-label">Date:</span>
                    <span class="meta-value">${format(new Date(message.receivedOn), 'PPpp')}</span>
                  </div>
                </div>
              </div>

              <div class="separator"></div>

              <div class="email-body">
                <div class="email-content">
                  ${cleanHtml(message.decodedBody ?? '<p><em>No email content available</em></p>')}
                </div>
              </div>


              ${
                message.attachments && message.attachments.length > 0
                  ? `
                <div class="attachments-section">
                  <h2 class="attachments-title">Attachments (${message.attachments.length})</h2>
                  ${message.attachments
                    .map(
                      (attachment) => `
                    <div class="attachment-item">
                      <span class="attachment-name">${attachment.filename}</span>
                      ${formatFileSize(attachment.size) ? ` - <span class="attachment-size">${formatFileSize(attachment.size)}</span>` : ''}
                    </div>
                  `,
                    )
                    .join('')}
                </div>
              `
                  : ''
              }
            </div>
            ${index < emailData.messages.length - 1 ? '<div class="separator"></div>' : ''}
          `,
            )
            .join('')}
        </body>
      </html>
    `;

      // Write content to the iframe
      const iframeDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Could not access iframe document');
      }
      iframeDoc.open();
      iframeDoc.write(printContent);
      iframeDoc.close();

      // Wait for content to load, then print
      printFrame.onload = function () {
        setTimeout(() => {
          try {
            // Focus the iframe and print
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();

            // Clean up - remove the iframe after a delay
            setTimeout(() => {
              if (printFrame && printFrame.parentNode) {
                document.body.removeChild(printFrame);
              }
            }, 1000);
          } catch (error) {
            console.error('Error during print:', error);
            // Clean up on error
            if (printFrame && printFrame.parentNode) {
              document.body.removeChild(printFrame);
            }
          }
        }, 500);
      };
    } catch (error) {
      console.error('Error printing thread:', error);
      toast.error('Failed to print thread. Please try again.');
    }
  };

  const handleToggleImportant = useCallback(async () => {
    if (!emailData || !id) return;
    await toggleImportant({ ids: [id] });
    await refetchThread();
    if (isImportant) {
      toast.success(m['common.mail.markedAsImportant']());
    } else {
      toast.error('Failed to mark as important');
    }
  }, [emailData, id]);

  // Set initial star state based on email data
  useEffect(() => {
    if (emailData?.latest?.tags) {
      // Check if any tag has the name 'STARRED'
      setIsStarred(emailData.latest.tags.some((tag) => tag.name === 'STARRED'));
      setIsImportant(emailData.latest.tags.some((tag) => tag.name === 'IMPORTANT'));
    }
  }, [emailData?.latest?.tags]);

  useEffect(() => {
    if (optimisticState.optimisticStarred !== null) {
      setIsStarred(optimisticState.optimisticStarred);
    }
  }, [optimisticState.optimisticStarred]);

  //   // Automatically open Reply All composer when email thread is loaded
  //   useEffect(() => {
  //     if (emailData?.latest?.id) {
  //       // Small delay to ensure other effects have completed
  //       const timer = setTimeout(() => {
  //         setMode('replyAll');
  //         setActiveReplyId(emailData.latest!.id);
  //       }, 50);

  //       return () => clearTimeout(timer);
  //     }
  //   }, [emailData?.latest?.id, setMode, setActiveReplyId]);

  // Removed conflicting useEffect that was clearing activeReplyId

  // Scroll to the active reply composer when it's opened
  useEffect(() => {
    if (mode && activeReplyId) {
      setTimeout(() => {
        const replyElement = document.getElementById(`reply-composer-${activeReplyId}`);
        if (replyElement) {
          replyElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100); // Short delay to ensure the component is rendered
    }
  }, [mode, activeReplyId]);

  const { labels: threadLabels } = useThreadLabels(
    emailData?.labels ? emailData.labels.map((l) => l.id) : [],
  );

  return (
    <div
      className={cn(
        'flex',
        isMobile ? 'h-full' : 'h-[calc(100dvh-19px)] rounded-xl',
      )}
    >
      <div
        className={cn(
          'bg-panelLight dark:bg-panelDark relative flex w-full rounded-xl transition-all duration-300',
          'h-full',
          !isMobile && '',
        )}
      >
        <div className=" relative left-1 mt-1">
          <ThreadActionButton
            icon={X}
            label={m['common.actions.close']()}
            onClick={handleClose}
            className="hidden md:flex"
          />
          <ThreadActionButton
            icon={ChevronUp}
            label="Previous email"
            onClick={handlePrevious}
            className="hidden md:flex"
            isLucide={true}
          />
          <ThreadActionButton
            icon={ChevronDown}
            label="Next email"
            onClick={handleNext}
            className="hidden md:flex"
            isLucide={true}
          />
          
          {/* Action icons moved here - now aligned horizontally */}
          <ThreadActionButton
            icon={Star}
            label={isStarred ? m['common.threadDisplay.unstar']() : m['common.threadDisplay.star']()}
            onClick={handleToggleStar}
            className="hidden md:flex"
            overrideDefaultIconStyling={true}
            iconClassName={cn(
              '',
              isStarred
                ? 'fill-yellow-400 stroke-yellow-400'
                : 'fill-transparent stroke-[#9D9D9D] dark:stroke-[#9D9D9D]',
            )}
          />

          <ThreadActionButton
            icon={Archive}
            label={m['common.threadDisplay.archive']()}
            onClick={() => moveThreadTo('archive')}
            className="hidden md:flex"
          />

          {!isInBin && (
            <ThreadActionButton
              icon={Trash}
              label={m['common.mail.moveToBin']()}
              onClick={() => moveThreadTo('bin')}
              className="hidden md:flex"
              overrideDefaultIconStyling={true}
              iconClassName="fill-[#F43F5E] h-4 w-4"
            />
          )}

          <DropdownMenu>
            <ThreadActionButton
              icon={ThreeDots}
              label="More actions"
              className="hidden md:flex"
              iconClassName="h-4 w-4"
              isDropdownTrigger={true}
            >
              <DropdownMenuContent align="end" className="bg-white dark:bg-[#313131]">
                {isInSpam || isInArchive || isInBin ? (
                  <DropdownMenuItem onClick={() => moveThreadTo('inbox')}>
                    <Inbox className="mr-2 h-4 w-4" />
                    <span>{m['common.mail.moveToInbox']()}</span>
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        printThread();
                      }}
                    >
                      <Printer className="fill-iconLight dark:fill-iconDark mr-2 h-4 w-4" />
                      <span>{m['common.threadDisplay.printThread']()}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => moveThreadTo('spam')}>
                      <ArchiveX className="fill-iconLight dark:fill-iconDark mr-2" />
                      <span>{m['common.threadDisplay.moveToSpam']()}</span>
                    </DropdownMenuItem>
                    {emailData?.latest?.listUnsubscribe ||
                    emailData?.latest?.listUnsubscribePost ? (
                      <DropdownMenuItem onClick={handleUnsubscribeProcess}>
                        <Folders className="fill-iconLight dark:fill-iconDark mr-2" />
                        <span>{m['common.mailDisplay.unsubscribe']()}</span>
                      </DropdownMenuItem>
                    ) : null}
                  </>
                )}
                {!isImportant && (
                  <DropdownMenuItem onClick={handleToggleImportant}>
                    <Lightning className="fill-iconLight dark:fill-iconDark mr-2" />
                    {m['common.mail.markAsImportant']()}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </ThreadActionButton>
          </DropdownMenu>
        </div>
        <div className="w-full md:w-[70%] h-full flex flex-col ml-4">
          <div
            className={cn(
              'flex flex-shrink-0 items-center justify-between pt-1 px-3',
              isMobile && 'bg-panelLight dark:bg-panelDark sticky top-0 z-10 mt-2',
            )}
          >
            <div className="flex w-full items-center gap-2">
              <span className="inline-flex items-center gap-2 font-medium text-black dark:text-white">
                <span className="lg:text-2xl font-semibold">
                  {emailData?.latest?.subject}{' '}
                  <span className="text-muted-foreground dark:text-[#8C8C8C]">
                    {/* {emailData?.totalReplies &&
                      emailData.totalReplies > 1 &&
                      `[${emailData.totalReplies}]`} */}
                  </span>
                </span>
              </span>

              <div className="w-0 flex items-center gap-2">
                {/* {emailData?.labels?.length ? (
                  <MailDisplayLabels labels={emailData?.labels.map((t) => t.name) || []} />
                ) : null} */}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMode('replyAll');
                  setActiveReplyId(emailData?.latest?.id ?? '');
                }}
                className="inline-flex h-7 items-center justify-center gap-1 overflow-hidden rounded-lg border bg-white px-1.5 dark:border-none dark:bg-[#313131] md:hidden"
              >
                <Reply className="fill-muted-foreground dark:fill-[#9B9B9B]" />
                <div className="flex items-center justify-center gap-2.5 pl-0.5 pr-1">
                  <div className="justify-start whitespace-nowrap text-sm leading-none text-black dark:text-white">
                    {m['common.threadDisplay.replyAll']()}
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-2 md:hidden">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleToggleStar}
                        className="inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-lg bg-white dark:bg-[#313131]"
                      >
                        <Star
                          className={cn(
                            'ml-[2px] mt-[2.4px] h-5 w-5',
                            isStarred
                              ? 'fill-yellow-400 stroke-yellow-400'
                              : 'fill-transparent stroke-[#9D9D9D] dark:stroke-[#9D9D9D]',
                          )}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-white dark:bg-[#313131]">
                      {isStarred
                        ? m['common.threadDisplay.unstar']()
                        : m['common.threadDisplay.star']()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => moveThreadTo('archive')}
                        className="inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-lg bg-white dark:bg-[#313131]"
                      >
                        <Archive className="fill-iconLight dark:fill-iconDark" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-white dark:bg-[#313131]">
                      {m['common.threadDisplay.archive']()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {!isInBin && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => moveThreadTo('bin')}
                          className="inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-lg border border-[#FCCDD5] bg-[#FDE4E9] dark:border-[#6E2532] dark:bg-[#411D23]"
                        >
                          <Trash className="fill-[#F43F5E]" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-white dark:bg-[#313131]">
                        {m['common.mail.moveToBin']()}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-lg bg-white focus:outline-none focus:ring-0 dark:bg-[#313131]">
                      <ThreeDots className="fill-iconLight dark:fill-iconDark" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white dark:bg-[#313131]">
                    {isInSpam || isInArchive || isInBin ? (
                      <DropdownMenuItem onClick={() => moveThreadTo('inbox')}>
                        <Inbox className="mr-2 h-4 w-4" />
                        <span>{m['common.mail.moveToInbox']()}</span>
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            printThread();
                          }}
                        >
                          <Printer className="fill-iconLight dark:fill-iconDark mr-2 h-4 w-4" />
                          <span>{m['common.threadDisplay.printThread']()}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => moveThreadTo('spam')}>
                          <ArchiveX className="fill-iconLight dark:fill-iconDark mr-2" />
                          <span>{m['common.threadDisplay.moveToSpam']()}</span>
                        </DropdownMenuItem>
                        {emailData?.latest?.listUnsubscribe ||
                        emailData?.latest?.listUnsubscribePost ? (
                          <DropdownMenuItem onClick={handleUnsubscribeProcess}>
                            <Folders className="fill-iconLight dark:fill-iconDark mr-2" />
                            <span>{m['common.mailDisplay.unsubscribe']()}</span>
                          </DropdownMenuItem>
                        ) : null}
                      </>
                    )}
                    {!isImportant && (
                      <DropdownMenuItem onClick={handleToggleImportant}>
                        <Lightning className="fill-iconLight dark:fill-iconDark mr-2" />
                        {m['common.mail.markAsImportant']()}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', isMobile && 'h-full')}>
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="pb-4">
                {(emailData?.messages || []).map((message, index) => {
                  const isLastMessage = index === (emailData?.messages?.length || 0) - 1;
                  const isReplyingToThisMessage = mode && activeReplyId === message.id;

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'transition-all duration-200',
                        index > 0 && 'border-border border-t',
                      )}
                    >
                      <MailDisplay
                        emailData={message}
                        isFullscreen={isFullscreen}
                        isMuted={false}
                        isLoading={false}
                        index={index}
                        totalEmails={emailData?.totalReplies}
                        threadAttachments={index === 0 ? allThreadAttachments : undefined}
                      />
                      {/* Inline Reply Compose for non-last messages */}
                      {isReplyingToThisMessage && !isLastMessage && (
                        <div className="px-4 py-2" id={`reply-composer-${message.id}`}>
                          <ReplyCompose messageId={message.id} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sticky Reply Compose at Bottom - Only for last message */}
            {mode &&
              activeReplyId &&
              activeReplyId === emailData?.messages?.[(emailData?.messages?.length || 0) - 1]?.id && (
                <div
                  className="border-border bg-panelLight dark:bg-panelDark sticky bottom-0 z-10 border-t px-4 py-2"
                  id={`reply-composer-${activeReplyId}`}
                >
                  <ReplyCompose messageId={activeReplyId} />
                </div>
              )}
          </div>
        </div>
        <div className="hidden md:block md:w-[30%]"></div>
      </div>
    </div>
  );
}
