import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useForm, type ControllerRenderProps } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SettingsCard } from '@/components/settings/settings-card';
import { useEmailAliases } from '@/hooks/use-email-aliases';
import { Globe, Clock, Mail, InfoIcon } from 'lucide-react';
import { getLocale, setLocale } from '@/paraglide/runtime';
import { useState, useEffect, useMemo, memo } from 'react';
import { userSettingsSchema } from '@zero/server/schemas';
import { locales } from '@/project.inlang/settings.json';
import { ScrollArea } from '@/components/ui/scroll-area';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTRPC } from '@/providers/query-provider';
import { getBrowserTimezone } from '@/lib/timezones';

import { useSettings } from '@/hooks/use-settings';
import { locales as localesData } from '@/locales';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
// import { useRevalidator } from 'react-router';
import { m } from '@/paraglide/messages';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as z from 'zod';

const TimezoneSelect = memo(
  ({ field }: { field: ControllerRenderProps<z.infer<typeof userSettingsSchema>, 'timezone'> }) => {
    const [open, setOpen] = useState(false);
    const [timezoneSearch, setTimezoneSearch] = useState('');

    const timezones = useMemo(() => Intl.supportedValuesOf('timeZone'), []);

    const filteredTimezones = useMemo(() => {
      if (!timezoneSearch) return timezones;
      return timezones.filter((timezone) =>
        timezone.toLowerCase().includes(timezoneSearch.toLowerCase()),
      );
    }, [timezones, timezoneSearch]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex !h-9 w-full items-center justify-start rounded-md hover:bg-transparent"
            >
              <Clock className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{field.value}</span>
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <div className="px-3 py-2">
            <input
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Select timezone"
              value={timezoneSearch}
              onChange={(e) => setTimezoneSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-1">
              {filteredTimezones.length === 0 && (
                <div className="text-muted-foreground p-2 text-center text-sm">
                  No results found
                </div>
              )}
              {filteredTimezones.map((timezone) => (
                <div
                  key={timezone}
                  className={cn(
                    'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                    field.value === timezone
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  )}
                  onClick={() => {
                    field.onChange(timezone);
                    setOpen(false);
                  }}
                >
                  {timezone}
                </div>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  },
);

TimezoneSelect.displayName = 'TimezoneSelect';

export default function GeneralPage() {
  const [isSaving, setIsSaving] = useState(false);
  const locale = getLocale();

  const { data, refetch: refetchSettings } = useSettings();
  const { data: aliases } = useEmailAliases();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: saveUserSettings } = useMutation(trpc.settings.save.mutationOptions());
  //   const { mutateAsync: setLocaleCookie } = useMutation(
  //     trpc.cookiePreferences.setLocaleCookie.mutationOptions(),
  //   );
  //   const { revalidate } = useRevalidator();

  const form = useForm<z.infer<typeof userSettingsSchema>>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
      language: locale,
      timezone: getBrowserTimezone(),
      dynamicContent: false,
      customPrompt: '',
      zeroSignature: true,
      defaultEmailAlias: '',
    },
  });

  useEffect(() => {
    if (data?.settings) {
      form.reset(data.settings);
      setLocale(data.settings.language as any);
    }
  }, [form, data?.settings]);

  useEffect(() => {
    if (aliases && !data?.settings?.defaultEmailAlias) {
      const primaryAlias = aliases.find((alias) => alias.primary);
      if (primaryAlias) {
        form.setValue('defaultEmailAlias', primaryAlias.email);
      }
    }
  }, [aliases, data?.settings?.defaultEmailAlias, form]);

  async function onSubmit(values: z.infer<typeof userSettingsSchema>) {
    setIsSaving(true);
    const saved = data?.settings ? { ...data.settings } : undefined;

    try {
      queryClient.setQueryData(trpc.settings.get.queryKey(), (updater) => {
        if (!updater) return;
        return { settings: { ...updater.settings, ...values } };
      });
      await saveUserSettings(values);
      await refetchSettings();

      toast.success('Settings saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save settings');
      queryClient.setQueryData(trpc.settings.get.queryKey(), (updater) => {
        if (!updater) return;
        return saved ? { settings: { ...updater.settings, ...saved } } : updater;
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <SettingsCard
        title="General Settings"
        description="Manage your general preferences and settings"
        footer={
          <Button type="submit" form="general-form" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        }
      >
        <Form {...form}>
          <form id="general-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="flex w-full flex-col items-start gap-4 md:flex-row md:items-center">
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem className="w-full md:w-[200px]">
                    <FormLabel className="text-sm font-medium">Language</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="flex w-full flex-row justify-start hover:bg-transparent">
                          <Globe className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locales.map((locale) => (
                          <SelectItem key={locale} value={locale}>
                            {localesData[locale as keyof typeof localesData]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem className="w-full md:w-[200px]">
                    <FormLabel className="text-sm font-medium">Timezone</FormLabel>
                    <TimezoneSelect field={field} />
                  </FormItem>
                )}
              />
              {aliases && aliases.length > 0 && (
                <FormField
                  control={form.control}
                  name="defaultEmailAlias"
                  render={({ field }) => (
                    <FormItem className="w-full md:w-[280px]">
                      <FormLabel className="!mb-1 flex flex-row items-center gap-1 text-sm font-medium">
                        Default Email Alias{' '}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-[1em] w-[1em]" />
                          </TooltipTrigger>
                          <TooltipContent>
                            The default email address to use when composing new emails
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger className="flex w-full flex-row justify-start hover:bg-transparent">
                            <Mail className="mr-2 h-4 w-4" />
                            <SelectValue
                              placeholder="Select default email"
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {aliases.map((alias) => (
                            <SelectItem key={alias.email} value={alias.email}>
                              <div className="flex flex-row items-center gap-1">
                                <span className="text-sm">
                                  {alias.name ? `${alias.name} <${alias.email}>` : alias.email}
                                </span>
                                {alias.primary && (
                                  <span className="text-muted-foreground text-xs">(Primary)</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="zeroSignature"
              render={({ field }) => (
                <FormItem className="flex max-w-xl flex-row items-center justify-between rounded-lg border px-4 py-2">
                  <div className="space-y-0.5">
                    <FormLabel>Zero Signature</FormLabel>
                    <FormDescription>
                      Add "Sent with Zero" signature to outgoing emails
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="autoRead"
              render={({ field }) => (
                <FormItem className="flex max-w-xl flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Auto Read</FormLabel>
                    <FormDescription>
                      Automatically mark emails as read when opened
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </SettingsCard>
    </div>
  );
}
