import React from 'react';
import { cn, getEmailLogo } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, Trash } from 'lucide-react';
import { ExclamationCircle, GroupPeople } from '../icons/icons';
import {  highlightText } from '@/lib/email-utils.client';
import { useTranslations } from 'use-intl';
import { Star2, Archive2 } from '../icons/icons';


// Types
interface ThreadAvatarProps {
  isGroupThread: boolean;
  latestMessage: any;
  cleanName: string;
  isMailBulkSelected: boolean;
  idToUse: string;
  setMail: (updater: (prev: any) => any) => void;
  isMobile?: boolean;
}

interface ThreadMetadataProps {
  latestMessage: any;
  isFolderSent: boolean;
  searchValue: { highlight: string };
  cleanName: string;
  displayUnread: boolean;
  isMailSelected: boolean;
  getThreadData: any;
  isMobile?: boolean;
}

interface ThreadActionsProps {
  isMobile: boolean;
  displayStarred: boolean;
  displayImportant: boolean;
  handleToggleStar: () => void;
  handleToggleImportant: () => void;
  moveThreadTo: (destination: string) => void;
  isFolderBin: boolean;
  index?: number;
}

interface ThreadSelectorProps {
  isMailBulkSelected: boolean;
  latestMessage: any;
  setMail: (updater: (prev: any) => any) => void;
  isMobile?: boolean;
}

// Shared Components
export const ThreadAvatar: React.FC<ThreadAvatarProps> = ({
  isGroupThread,
  latestMessage,
  cleanName,
  isMailBulkSelected,
  idToUse,
  setMail,
  isMobile = false,
}) => {
  const avatarSize = isMobile ? 'h-8 w-8' : 'h-5 w-5';
  const iconSize = isMobile ? 'h-4 w-4' : 'h-3 w-3';

  return (
    <Avatar className={cn(avatarSize, 'rounded border dark:border-none', isMobile && 'rounded-full')}>
      {isMailBulkSelected && isMobile ? (
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-[#006FFE] p-2"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setMail((prev: any) => ({
              ...prev,
              bulkSelected: prev.bulkSelected.filter((id: string) => id !== idToUse),
            }));
          }}
        >
          <Check className="h-4 w-4 text-white" />
        </div>
      ) : isGroupThread ? (
        <div className={cn(
          'flex h-full w-full items-center justify-center bg-muted dark:bg-[#373737]',
          isMobile ? 'rounded-full bg-[#FFFFFF] p-2' : 'rounded'
        )}>
          <GroupPeople className={iconSize} />
        </div>
      ) : (
        <>
          <AvatarImage
            className={cn(
              'bg-[#FFFFFF] dark:bg-[#373737]',
              isMobile ? 'rounded-full' : 'rounded'
            )}
            src={getEmailLogo(latestMessage.sender.email)}
            alt={cleanName || latestMessage.sender.email}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          <AvatarFallback className={cn(
            'bg-muted text-xs font-bold text-[#9F9F9F] dark:bg-[#373737]',
            isMobile ? 'rounded-full bg-[#FFFFFF]' : 'rounded'
          )}>
            {cleanName ? cleanName[0]?.toUpperCase() : latestMessage.sender.email[0]?.toUpperCase()}
          </AvatarFallback>
        </>
      )}
    </Avatar>
  );
};

export const ThreadSelector: React.FC<ThreadSelectorProps> = ({
  isMailBulkSelected,
  latestMessage,
  setMail,
  isMobile = false,
}) => {
  if (isMobile) return null; // Mobile uses avatar for selection

  return (
    <div
      className={cn(
        'top-[-3px] -ml-3 mr-[11px] flex h-[13px] w-[13px] items-center justify-center rounded border-2 border-[#484848] transition-colors',
        isMailBulkSelected && 'border-none bg-[#3B82F6]',
      )}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        const threadId = latestMessage.threadId ?? latestMessage.id;
        setMail((prev: any) => ({
          ...prev,
          bulkSelected: isMailBulkSelected
            ? prev.bulkSelected.filter((id: string) => id !== threadId)
            : [...prev.bulkSelected, threadId],
        }));
      }}
    >
      {isMailBulkSelected && (
        <Check className="relative top-[0.5px] h-2 w-2 text-panelLight dark:text-panelDark" />
      )}
    </div>
  );
};

export const ThreadMetadata: React.FC<ThreadMetadataProps> = ({
  latestMessage,
  isFolderSent,
  searchValue,
  cleanName,
  displayUnread,
  isMailSelected,
  getThreadData,
  isMobile = false,
}) => {
  if (isMobile) {
    return (
      <div className="w-full">
        <div className="flex w-full flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-[4px]">
            <span
              className={cn(
                displayUnread && !isMailSelected ? 'font-bold' : 'font-medium',
                'text-md flex items-baseline gap-1 group-hover:opacity-100',
              )}
            >
              {isFolderSent ? (
                <span className="overflow-hidden truncate text-sm md:max-w-[15ch] xl:max-w-[25ch]">
                  {highlightText(latestMessage.subject, searchValue.highlight)}
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="line-clamp-1 overflow-hidden text-sm">
                    {highlightText(cleanName || '', searchValue.highlight)}
                  </span>
                  {displayUnread && !isMailSelected && !isFolderSent && (
                    <span className="ml-0.5 size-2 rounded-full bg-[#006FFE]" />
                  )}
                </div>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Desktop metadata layout
  return (
    <div className="flex items-center">
      <div className="flex w-[80px] max-w-[80px] flex-shrink-0 items-center lg:w-[150px] lg:max-w-[150px]">
        {isFolderSent ? (
          <span className="line-clamp-1 text-sm">
            {highlightText(latestMessage.subject, searchValue.highlight)}
          </span>
        ) : (
          <span className="line-clamp-1 min-w-0 text-sm font-medium">
            {highlightText(cleanName || '', searchValue.highlight)}
          </span>
        )}
      </div>
    </div>
  );
};

export const ThreadActions: React.FC<ThreadActionsProps> = ({
  isMobile,
  displayStarred,
  displayImportant,
  handleToggleStar,
  handleToggleImportant,
  moveThreadTo,
  isFolderBin,
  index = 0,
}) => {
  const t = useTranslations();

  if (!isMobile) return null; // Desktop doesn't show inline actions

  return (
    <div
      className={cn(
        'dark:bg-panelDark absolute right-2 z-[25] flex -translate-y-1/2 items-center gap-1 rounded-xl border bg-white p-1 opacity-0 shadow-sm group-hover:opacity-100',
        index === 0 ? 'top-4' : 'top-[-9px]',
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
                displayStarred
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
          {displayStarred ? t('common.threadDisplay.unstar') : t('common.threadDisplay.star')}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-6 w-6 [&_svg]:size-3.5',
              displayImportant ? 'hover:bg-orange-200/70 dark:hover:bg-orange-800/40' : '',
            )}
            onClick={handleToggleImportant}
          >
            <ExclamationCircle
              className={cn(displayImportant ? 'fill-orange-400' : 'fill-[#9D9D9D]')}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side={index === 0 ? 'bottom' : 'top'}
          className="dark:bg-panelDark mb-1 bg-white"
        >
          {t('common.mail.toggleImportant')}
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
          {t('common.threadDisplay.archive')}
        </TooltipContent>
      </Tooltip>

      {!isFolderBin && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-[#FDE4E9] dark:hover:bg-[#411D23] [&_svg]:size-3.5"
              onClick={(e: React.MouseEvent) => {
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
            {t('common.actions.Bin')}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}; 