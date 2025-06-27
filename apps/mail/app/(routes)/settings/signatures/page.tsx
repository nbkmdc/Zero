import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SettingsCard } from '@/components/settings/settings-card';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTRPC } from '@/providers/query-provider';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'use-intl';
import { useForm } from 'react-hook-form';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Download, AlertTriangle } from 'lucide-react';
import { useActiveConnection } from '@/hooks/use-connections';
import * as z from 'zod';

const signatureFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  content: z.string().max(10000, 'Content must be less than 10,000 characters'),
  isDefault: z.boolean().default(false),
});

interface Signature {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export default function SignaturesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSignature, setEditingSignature] = useState<Signature | null>(null);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingSignatureId, setDeletingSignatureId] = useState<string | null>(null);
  const t = useTranslations();
  const trpc = useTRPC();

  const { data: settings } = useQuery(trpc.settings.get.queryOptions());
  const { mutateAsync: saveUserSettings } = useMutation(trpc.settings.save.mutationOptions());

  const { data: signatures, error, isLoading, refetch } = useQuery(
    trpc.signatures.list.queryOptions()
  );

  const signaturesArray = Array.isArray(signatures) ? signatures : [];

  const { mutateAsync: createSignature, isPending: isCreating } = useMutation(
    trpc.signatures.create.mutationOptions()
  );

  const { mutateAsync: updateSignature, isPending: isUpdating } = useMutation(
    trpc.signatures.update.mutationOptions()
  );

  const { mutateAsync: deleteSignature, isPending: isDeleting } = useMutation(
    trpc.signatures.delete.mutationOptions()
  );

  const { mutateAsync: importFromGmail, isPending: isImporting } = useMutation(
    trpc.signatures.importFromGmail.mutationOptions()
  );

  const { data: activeConnection } = useActiveConnection();

  const form = useForm<z.infer<typeof signatureFormSchema>>({
    resolver: zodResolver(signatureFormSchema),
    defaultValues: {
      name: '',
      content: '',
      isDefault: false,
    },
  });

  const openCreateDialog = () => {
    setEditingSignature(null);
    form.reset({
      name: '',
      content: '',
      isDefault: false,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (signature: Signature) => {
    setEditingSignature(signature);
    form.reset({
      name: signature.name,
      content: signature.content,
      isDefault: signature.isDefault,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (values: z.infer<typeof signatureFormSchema>) => {
    try {
      if (editingSignature) {
        await updateSignature({
          id: editingSignature.id,
          ...values,
        });
        toast.success(t('pages.settings.signatures.messages.updated'));
      } else {
        await createSignature(values);
        toast.success(t('pages.settings.signatures.messages.created'));
      }
      
      await refetch();
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error(t('pages.settings.signatures.messages.failedToSave'));
      console.error('Failed to save signature:', error);
    }
  };

  const openDeleteConfirm = (signatureId: string) => {
    setDeletingSignatureId(signatureId);
    setIsDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingSignatureId) return;

    try {
      await deleteSignature({ id: deletingSignatureId });
      toast.success(t('pages.settings.signatures.delete.success'));
      await refetch();
      setIsDeleteConfirmOpen(false);
      setDeletingSignatureId(null);
    } catch (error) {
      toast.error(t('pages.settings.signatures.delete.error'));
      console.error('Failed to delete signature:', error);
    }
  };

  const handleSetDefault = async (signature: Signature) => {
    try {
      if (hasZeroSignature) {
        await saveUserSettings({
          ...settings?.settings,
          zeroSignature: false,
        });
      }

      await updateSignature({
        id: signature.id,
        name: signature.name,
        content: signature.content,
        isDefault: true,
      });
      toast.success(t('pages.settings.signatures.messages.defaultUpdated'));
      await refetch();
    } catch (error) {
      toast.error(t('pages.settings.signatures.messages.failedToSetDefault'));
      console.error('Failed to set default signature:', error);
    }
  };

  const handleToggleZeroSignature = async (enabled: boolean) => {
    try {
      if (enabled && defaultSignature) {
        await updateSignature({
          id: defaultSignature.id,
          name: defaultSignature.name,
          content: defaultSignature.content,
          isDefault: false,
        });
        await refetch();
      }

      await saveUserSettings({
        ...settings?.settings,
        zeroSignature: enabled,
      });
      toast.success(enabled ? t('pages.settings.signatures.zeroSignature.enabled') : t('pages.settings.signatures.zeroSignature.disabled'));
    } catch (error) {
      toast.error(t('pages.settings.signatures.zeroSignature.failedToUpdate'));
      console.error('Failed to update Zero signature setting:', error);
    }
  };

  const openImportConfirm = () => {
    if (!activeConnection?.id) {
      toast.error(t('pages.settings.signatures.import.noConnectionError'));
      return;
    }

    if (activeConnection.providerId !== 'google') {
      toast.error(t('pages.settings.signatures.import.gmailOnlyError'));
      return;
    }

    setIsImportConfirmOpen(true);
  };

  const handleImportFromGmail = async () => {
    if (!activeConnection?.id) return;

    try {
      const result = await importFromGmail({ connectionId: activeConnection.id });
      
      if (result.imported > 0 && result.skipped > 0) {
        toast.success(result.message, {
          description: `${result.imported} new signatures added, ${result.skipped} duplicates skipped`
        });
      } else if (result.imported > 0) {
        toast.success(result.message);
      } else if (result.skipped > 0) {
        toast.info(result.message, {
          description: 'These signatures already exist in your account'
        });
      } else {
        toast.info(result.message);
      }
      
      await refetch();
      setIsImportConfirmOpen(false);
    } catch (error: any) {
      if (error?.message?.includes('Connection tokens are missing')) {
        toast.error(t('pages.settings.signatures.import.expiredTokenError'));
      } else if (error?.message?.includes('only works with Gmail')) {
        toast.error(t('pages.settings.signatures.import.gmailOnlyError'));
      } else {
        toast.error(t('pages.settings.signatures.import.genericError'));
      }
      console.error('Failed to import signatures from Gmail:', error);
      setIsImportConfirmOpen(false);
    }
  };

  const defaultSignature = signaturesArray.find(sig => sig.isDefault);
  const hasZeroSignature = settings?.settings?.zeroSignature || false;

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={t('pages.settings.signatures.zeroSignature.title')}
        description={t('pages.settings.signatures.zeroSignature.description')}
      >
        <div className="flex max-w-xl flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
          <div className="space-y-0.5">
            <div className="font-medium">{t('pages.settings.signatures.zeroSignature.label')}</div>
            <div className="text-sm text-muted-foreground">
              {t('pages.settings.signatures.zeroSignature.labelDescription')}
            </div>
          </div>
                     <Switch 
             checked={hasZeroSignature} 
             onCheckedChange={handleToggleZeroSignature}
           />
         </div>
      </SettingsCard>

              <SettingsCard
          title={t('pages.settings.signatures.customSignatures.title')}
          description={t('pages.settings.signatures.customSignatures.description')}
        footer={
          <div className="flex gap-2">
            {activeConnection?.providerId === 'google' && (
              <Button 
                variant="outline" 
                onClick={openImportConfirm}
                disabled={isImporting || isLoading}
              >
                <Download className="w-4 h-4 mr-2" />
                {isImporting ? t('pages.settings.signatures.customSignatures.importing') : t('pages.settings.signatures.customSignatures.importButton')}
              </Button>
            )}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('pages.settings.signatures.customSignatures.createButton')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingSignature ? t('pages.settings.signatures.form.editTitle') : t('pages.settings.signatures.form.createTitle')}
                  </DialogTitle>
                  <DialogDescription>
                    {editingSignature 
                      ? t('pages.settings.signatures.form.editDescription')
                      : t('pages.settings.signatures.form.createDescription')
                    }
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('pages.settings.signatures.form.nameLabel')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('pages.settings.signatures.form.namePlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('pages.settings.signatures.form.contentLabel')}</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder={t('pages.settings.signatures.signatureContentPlaceholder')}
                              className="min-h-[120px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="isDefault"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>{t('pages.settings.signatures.form.setAsDefaultLabel')}</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              {t('pages.settings.signatures.form.setAsDefaultDescription')}
                            </div>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        {t('pages.settings.signatures.form.cancel')}
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={isCreating || isUpdating}
                      >
                        {isCreating || isUpdating 
                          ? (editingSignature ? t('pages.settings.signatures.form.updating') : t('pages.settings.signatures.form.creating')) 
                          : (editingSignature ? t('pages.settings.signatures.form.update') : t('pages.settings.signatures.form.create'))
                        }
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="text-center py-8 text-red-500">
              <p>{t('pages.settings.signatures.messages.loadingError')}: {error.message}</p>
            </div>
          )}
          {isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('pages.settings.signatures.messages.loading')}</p>
            </div>
          )}
          {!isLoading && !error && signaturesArray.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('pages.settings.signatures.customSignatures.noSignatures')}</p>
              <p className="text-sm">{t('pages.settings.signatures.customSignatures.noSignaturesDescription')}</p>
            </div>
          ) : (
            !isLoading && !error && signaturesArray.map((signature) => (
              <div
                key={signature.id}
                className="flex items-start justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">{signature.name}</h3>
                    {signature.isDefault && (
                      <Badge variant="default" className="text-xs">
                        {t('pages.settings.signatures.customSignatures.defaultBadge')}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {signature.content}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant={signature.isDefault ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSetDefault(signature)}
                      disabled={signature.isDefault}
                    >
                      {signature.isDefault ? t('pages.settings.signatures.customSignatures.defaultButton') : t('pages.settings.signatures.customSignatures.setAsDefaultButton')}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(signature)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteConfirm(signature.id)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SettingsCard>

      <Dialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              {t('pages.settings.signatures.import.title')}
            </DialogTitle>
            <DialogDescription>
              {t('pages.settings.signatures.import.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsImportConfirmOpen(false)}
              disabled={isImporting}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={handleImportFromGmail}
              disabled={isImporting}
            >
              {isImporting ? t('pages.settings.signatures.customSignatures.importing') : t('pages.settings.signatures.import.confirmButton')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {t('pages.settings.signatures.delete.title')}
            </DialogTitle>
            <DialogDescription>
              {t('pages.settings.signatures.delete.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t('pages.settings.signatures.delete.deleting') : t('pages.settings.signatures.delete.confirmButton')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 