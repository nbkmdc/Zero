import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../ui/context-menu';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useLabels } from '@/hooks/use-labels';
import { Trash } from '../icons/icons';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface LabelSidebarContextMenuProps {
  children: ReactNode;
  labelId: string;
  hide?: boolean;
}

export function LabelSidebarContextMenu({ children, labelId, hide }: LabelSidebarContextMenuProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const trpc = useTRPC();
  const { mutateAsync: deleteLabel } = useMutation(trpc.labels.delete.mutationOptions());
  const { refetch } = useLabels();

  const handleDelete = () => {
    toast.promise(deleteLabel({ id: labelId }), {
      success: 'Label deleted successfully',
      error: 'Error deleting label',
      finally: () => {
        refetch();
        setDeleteDialogOpen(false);
      },
    });
  };

  if (hide) return children;

  return (
    <>
      <ContextMenu modal={false}>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent className="bg-white dark:bg-[#313131]">
          <ContextMenuItem
            asChild
            onClick={() => setDeleteDialogOpen(true)}
            disabled={false}
            className="gap-2 text-sm"
          >
            <Button
              size={'sm'}
              variant="ghost"
              className="hover:bg-[#FDE4E9] dark:hover:bg-[#411D23] [&_svg]:size-3.5"
            >
              <Trash className="fill-[#F43F5E]" />
              <span>Delete Label</span>
            </Button>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent showOverlay={true}>
          <DialogHeader>
            <DialogTitle>Delete Label</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this label? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button onClick={handleDelete}>
                Delete
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
