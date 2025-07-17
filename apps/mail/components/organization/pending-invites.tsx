import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function PendingInvites({ orgId, orgName }: { orgId: string; orgName: string }) {
  // Invitations state
  const [invites, setInvites] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  // Fetch pending invitations - TODO: Convert to TRPC when invitation router is available
  async function fetchInvites() {
    if (!orgId) return;
    setLoadingInvites(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/invitations?organizationId=${orgId}&status=pending`,
        { credentials: 'include' },
      );
      const data = (await res.json()) as { invitations: any[] };
      setInvites(data.invitations || []);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setLoadingInvites(false);
    }
  }

  // Cancel an invitation - TODO: Convert to TRPC when invitation router is available
  async function cancelInvite(inviteId: string) {
    if (!inviteId) return;
    try {
      await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/invitations/${inviteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      toast.success('Invitation cancelled');
      fetchInvites();
    } catch (error: any) {
      toast.error(`Failed to cancel invite: ${error.message}`);
    }
  }

  // Fetch invitations when org changes
  useEffect(() => {
    if (orgId) fetchInvites();
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
        ) : invites.length > 0 ? (
          invites.map((invite) => (
            <div
              key={invite.id}
              className="hover:bg-accent flex items-center justify-between rounded-lg border p-3 transition-colors"
            >
              <div>
                <p className="font-medium">{invite.email}</p>
                <p className="text-muted-foreground text-sm">{invite.role}</p>
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
