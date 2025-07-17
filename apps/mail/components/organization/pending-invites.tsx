import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
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

  // add mutation to cancel an invitation
  const cancelInvitationMutation = useMutation(
    trpc.organization.cancelPendingInvitation.mutationOptions(),
  );

  const handleCancelInvitation = async (inviteId: string) => {
    await cancelInvitationMutation.mutateAsync({ invitationId: inviteId });
    toast.success('Invitation cancelled');
    refetchInvites();
  };

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
              </div>
              <Button variant="outline" size="sm" onClick={() => handleCancelInvitation(invite.id)}>
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
