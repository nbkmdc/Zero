import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, Mail } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';

export default function PendingInvites({ orgId, orgName }: { orgId: string; orgName: string }) {
  const trpc = useTRPC();

  const {
    data: invites,
    isLoading: loadingInvites,
    refetch: refetchInvites,
  } = useQuery({
    ...trpc.organization.listPendingInvitations.queryOptions({ organizationId: orgId }),
    enabled: !!orgId,
  });

  // Cancel an invitation - TODO: Convert to TRPC when invitation router is available
  async function cancelInvite(inviteId: string) {
    if (!inviteId) return;
    try {
      await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/invitations/${inviteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      toast.success('Invitation cancelled');
      refetchInvites();
    } catch (error: any) {
      toast.error(`Failed to cancel invite: ${error.message}`);
    }
  }

  // Fetch invitations when org changes
  useEffect(() => {
    if (orgId) refetchInvites();
  }, [orgId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Pending Invitations
        </CardTitle>
        <CardDescription>Manage outgoing invitations for "{orgName}"</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loadingInvites ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : invites && invites?.invitations?.length > 0 ? (
          invites.invitations.map((invite) => (
            <div
              key={invite.id}
              className="hover:bg-accent flex items-center justify-between rounded-lg border p-3 transition-colors"
            >
              <div>
                <p className="font-medium">{invite.email}</p>
                <p className="text-muted-foreground text-sm">{invite.role}</p>
                <p className="text-muted-foreground text-sm">{invite.status}</p>
                <p className="text-muted-foreground text-sm">{invite.organizationId}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => cancelInvite(invite.id)}>
                Cancel
              </Button>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">No pending invitations.</p>
        )}
      </CardContent>
    </Card>
  );
}
