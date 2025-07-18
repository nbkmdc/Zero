import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HelpCircle,
  LogOut,
  MoonIcon,
  Settings,
  Plus,
  CopyCheckIcon,
  BadgeCheck,
  BanknoteIcon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useActiveConnection, useConnections } from '@/hooks/use-connections';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CategoryDropdown, SearchBar } from '../mail/mail';
import { useLoading } from '../context/loading-context';
import { signOut, useSession } from '@/lib/auth-client';
import { AddConnectionDialog } from '../connection/add';
import { CircleCheck, ThreeDots } from '../icons/icons';
import { useLocation, useParams } from 'react-router';
import { useTRPC } from '@/providers/query-provider';
import { useSidebar } from '@/components/ui/sidebar';
import { useBilling } from '@/hooks/use-billing';
import { SunIcon } from '../icons/animated/sun';
import { clear as idbClear } from 'idb-keyval';
import { m } from '@/paraglide/messages';
import { useTheme } from 'next-themes';
import { useQueryState } from 'nuqs';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function NavUser() {
  const { data: session } = useSession();
  const { folder } = useParams<{ folder: string }>();
  const { data } = useConnections();
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();
  const trpc = useTRPC();
  const [, setThreadId] = useQueryState('threadId');
  const { mutateAsync: setDefaultConnection } = useMutation(
    trpc.connections.setDefault.mutationOptions(),
  );
  const { openBillingPortal, customer: billingCustomer, isPro } = useBilling();
  const pathname = useLocation().pathname;
  const queryClient = useQueryClient();
  const { data: activeConnection, refetch: refetchActiveConnection } = useActiveConnection();
  const [, setPricingDialog] = useQueryState('pricingDialog');
  const [category] = useQueryState('category', { defaultValue: 'All Mail' });
  const { setLoading } = useLoading();

  const getSettingsHref = useCallback(() => {
    const currentPath = category
      ? `${pathname}?category=${encodeURIComponent(category)}`
      : pathname;
    return `/settings/general?from=${encodeURIComponent(currentPath)}`;
  }, [pathname, category]);

  const handleClearCache = useCallback(async () => {
    queryClient.clear();
    await idbClear();
    toast.success('Cache cleared successfully');
  }, []);

  const handleCopyConnectionId = useCallback(async () => {
    await navigator.clipboard.writeText(activeConnection?.id || '');
    toast.success('Connection ID copied to clipboard');
  }, [activeConnection]);

  const { data: activeAccount } = useActiveConnection();

  const handleAccountSwitch = (connectionId: string) => async () => {
    if (connectionId === activeConnection?.id) return;

    try {
      setLoading(true, m['common.navUser.switchingAccounts']());

      setThreadId(null);

      await setDefaultConnection({ connectionId });

      queryClient.clear();
    } catch (error) {
      console.error('Error switching accounts:', error);
      toast.error(m['common.navUser.failedToSwitchAccount']());

      await refetchActiveConnection();
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    toast.promise(signOut(), {
      loading: 'Signing out...',
      success: () => 'Signed out successfully!',
      error: 'Error signing out',
      async finally() {
        // await handleClearCache();
        window.location.href = '/login';
      },
    });
  };

  const otherConnections = useMemo(() => {
    if (!data || !activeAccount) return [];
    return data.connections.filter((connection) => connection.id !== activeAccount?.id);
  }, [data, activeAccount]);

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="flex w-full flex-row items-center justify-between gap-2">
      <div className="flex items-center gap-2 pl-1">
        {data && activeAccount ? (
          <Tooltip key={activeAccount.id}>
            <TooltipTrigger asChild>
              <div
                key={activeAccount.id}
                onClick={handleAccountSwitch(activeAccount.id)}
                className={`flex cursor-pointer items-center ${
                  activeAccount.id === activeConnection?.id && data.connections.length > 1
                    ? 'outline-mainBlue rounded-[5px] outline outline-2'
                    : ''
                }`}
              >
                <div className="relative">
                  <Avatar className="size-6 rounded-[5px]">
                    <AvatarImage
                      className="rounded-[5px]"
                      src={activeAccount.picture || undefined}
                      alt={activeAccount.name || activeAccount.email}
                    />
                    <AvatarFallback className="rounded-[5px] text-[10px]">
                      {(activeAccount.name || activeAccount.email)
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  {activeAccount.id === activeConnection?.id && (
                    <BadgeCheck
                      className={cn(
                        'absolute -bottom-2 -right-2 size-4 rounded-full bg-white dark:bg-transparent',
                        isPro ? 'fill-mainBlue' : 'fill-muted-foreground',
                      )}
                    />
                  )}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-muted-foreground text-xs">
              {activeAccount.email}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex cursor-pointer items-center">
            <div className="relative">
              <div className="bg-muted size-6 animate-pulse rounded-[5px]" />
            </div>
          </div>
        )}
        {otherConnections.slice(0, 2).map((connection) => (
          <Tooltip key={connection.id}>
            <TooltipTrigger asChild>
              <div
                onClick={handleAccountSwitch(connection.id)}
                className={`flex cursor-pointer items-center ${
                  connection.id === activeConnection?.id && otherConnections.length > 1
                    ? 'outline-mainBlue rounded-[5px] outline outline-2'
                    : ''
                }`}
              >
                <div className="relative">
                  <Avatar className="size-7 rounded-[5px]">
                    <AvatarImage
                      className="rounded-[5px]"
                      src={connection.picture || undefined}
                      alt={connection.name || connection.email}
                    />
                    <AvatarFallback className="rounded-[5px] text-[10px]">
                      {(connection.name || connection.email)
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  {connection.id === activeConnection?.id && otherConnections.length > 1 && (
                    <CircleCheck className="fill-mainBlue absolute -bottom-2 -right-2 size-4 rounded-full bg-white dark:bg-black" />
                  )}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-muted-foreground text-xs">
              {connection.email}
            </TooltipContent>
          </Tooltip>
        ))}

        {otherConnections.length > 3 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hover:bg-muted flex h-7 w-7 cursor-pointer items-center justify-center rounded-[5px]">
                <span className="text-[10px]">+{otherConnections.length - 3}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="ml-3 min-w-56 bg-white font-medium dark:bg-[#131313]"
              align="end"
              side={'bottom'}
              sideOffset={8}
            >
              {otherConnections.slice(3).map((connection) => (
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
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {isPro ? (
          <AddConnectionDialog>
            <button className="hover:bg-offsetLight/80 flex h-7 w-7 cursor-pointer items-center justify-center rounded-[5px] border border-dashed bg-transparent px-0 text-black dark:bg-[#262626] dark:text-[#929292]">
              <Plus className="size-4" />
            </button>
          </AddConnectionDialog>
        ) : (
          <>
            <Button
              onClick={() => setPricingDialog('true')}
              className="hover:bg-offsetLight/80 flex h-7 w-7 cursor-pointer items-center justify-center rounded-[5px] border border-dashed bg-transparent px-0 text-black dark:bg-[#262626] dark:text-[#929292]"
            >
              <Plus className="size-4" />
            </Button>
          </>
        )}
        {activeConnection?.providerId === 'google' && folder === 'inbox' && (
          <CategoryDropdown isMultiSelectMode={false} />
        )}
        {activeConnection?.providerId === 'google' && folder === 'inbox' && (
          <CategoryDropdown isMultiSelectMode={false} />
        )}
      </div>

      <div className="flex items-center justify-center gap-1">
        <SearchBar />
        {/* {isSessionPending ? null : !session.user.phoneNumberVerified ? (
                <SetupInboxDialog />
              ) : (
                <CallInboxDialog />
              )} */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={cn('md:h-fit md:px-2')}>
              <ThreeDots className="fill-iconLight dark:fill-iconDark" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="ml-3 min-w-56 bg-white font-medium dark:bg-[#131313]"
            align="end"
            side={'bottom'}
            sideOffset={8}
          >
            <div className="space-y-1">
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
                  <p className="text-[13px] opacity-60">{m['common.navUser.appTheme']()}</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <a
                  href="https://discord.gg/mail0"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full"
                >
                  <div className="flex items-center gap-2">
                    <HelpCircle size={16} className="opacity-60" />
                    <p className="text-[13px] opacity-60">
                      {m['common.navUser.customerSupport']()}
                    </p>
                  </div>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
                <div className="flex items-center gap-2">
                  <LogOut size={16} className="opacity-60" />
                  <p className="text-[13px] opacity-60">{m['common.actions.logout']()}</p>
                </div>
              </DropdownMenuItem>
            </div>

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
            <DropdownMenuSeparator className="mt-1" />
            <p className="text-muted-foreground px-2 py-1 text-[11px] font-medium">Debug</p>
            <DropdownMenuItem onClick={handleCopyConnectionId}>
              <div className="flex items-center gap-2">
                <CopyCheckIcon size={16} className="opacity-60" />
                <p className="text-[13px] opacity-60">Copy Connection ID</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleClearCache}>
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="opacity-60" />
                <p className="text-[13px] opacity-60">Clear Local Cache</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
