import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, UserPlus } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '../ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

type Role = 'member' | 'admin' | 'owner';

export default function InviteMember({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [loading, setLoading] = useState(false);

  // Test member invitation
  const handleInviteMember = async () => {
    if (!inviteEmail || !orgId || !orgName) {
      toast.error('Please enter an email and select an organization');
      return;
    }

    setLoading(true);
    try {
      await authClient.organization.inviteMember({
        email: inviteEmail,
        role: inviteRole as Role,
        organizationId: orgId,
      });

      toast.success(`Invitation sent to ${inviteEmail}!`);
      setInviteEmail('');
    } catch (error: any) {
      toast.error(`Failed to send invitation: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Invite Member
        </CardTitle>
        <CardDescription>Invite a new member to "{orgName}"</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="member@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={inviteRole} onValueChange={(value: Role) => setInviteRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleInviteMember} disabled={loading || !inviteEmail} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending Invite...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Send Invitation
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
