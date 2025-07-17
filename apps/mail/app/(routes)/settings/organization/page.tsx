import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CreateOrganization from '@/components/organization/create-organization';
import { SettingsEditor } from '@/components/organization/settings-editor';
import MyOrganizations from '@/components/organization/my-organizations';
import PendingInvites from '@/components/organization/pending-invites';
import { TeamManager } from '@/components/organization/team-manager';
import InviteMember from '@/components/organization/invite-member';
import { MemberList } from '@/components/organization/member-list';
import { SettingsCard } from '@/components/settings/settings-card';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { authClient } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Domain = {
  domain: string;
  verified: boolean;
  verificationToken: string | null;
};

export default function OrganizationPage() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrg, setActiveOrg] = useState<any>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  const trpc = useTRPC();

  const { data: activeOrganizationId, refetch: refetchActiveOrganizationId } = useQuery({
    ...trpc.organization.getUsersActiveOrganizationId.queryOptions(),
  });

  const setActiveOrganizationMutation = useMutation(
    trpc.organization.setActiveOrganization.mutationOptions({
      onSuccess: () => {
        toast.success('Active organization set successfully');
      },
      onError: (error) => {
        toast.error(`Failed to set active organization: ${error.message}`);
      },
    }),
  );

  const handleSetActiveOrganization = async (org: any) => {
    await setActiveOrganizationMutation.mutateAsync({
      organizationId: org.id,
    });
    refetchActiveOrganizationId();
  };

  // TRPC queries
  const { data: domainsData, refetch: refetchDomains } = useQuery({
    ...trpc.organization.listDomains.queryOptions({ organizationId: activeOrg?.id || '' }),
    enabled: !!activeOrg?.id,
  });

  // TRPC mutations
  const addDomainMutation = useMutation(trpc.organization.addDomain.mutationOptions());
  const removeDomainMutation = useMutation(trpc.organization.removeDomain.mutationOptions());
  const verifyDomainForOrgMutation = useMutation(
    trpc.organization.verifyDomainForOrg.mutationOptions(),
  );

  // Update domains when data changes
  useEffect(() => {
    if (domainsData?.domains) {
      setDomains(
        domainsData.domains.map((d) => ({
          ...d,
          verificationToken: d.verificationToken || null,
        })),
      );
    }
  }, [domainsData]);

  async function addDomain(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!newDomain || !activeOrg?.id) return;

    try {
      await addDomainMutation.mutateAsync({
        organizationId: activeOrg.id,
        domain: newDomain,
      });
      setNewDomain('');
      refetchDomains();
      toast.success('Domain added successfully');
    } catch (error: any) {
      toast.error('Failed to add domain');
    }
  }

  async function removeDomain(domain: string) {
    if (!activeOrg?.id) return;

    try {
      await removeDomainMutation.mutateAsync({
        organizationId: activeOrg.id,
        domain,
      });
      refetchDomains();
      toast.success('Domain removed successfully');
    } catch (error: any) {
      toast.error('Failed to remove domain');
    }
  }

  async function verifyDomain(domain: string) {
    if (!activeOrg?.id) return;
    setVerifying(true);
    setVerifyMsg(null);

    try {
      const result = await verifyDomainForOrgMutation.mutateAsync({
        organizationId: activeOrg.id,
        domain,
      });

      if ('verified' in result && result.verified) {
        setVerifyMsg('Domain verified!');
        refetchDomains();
      } else if ('message' in result && result.message) {
        setVerifyMsg(result.message);
      } else if ('error' in result && result.error) {
        setVerifyMsg(result.error);
      } else {
        setVerifyMsg('Verification failed');
      }
    } catch (error: any) {
      setVerifyMsg('Verification failed');
    } finally {
      setVerifying(false);
    }
  }

  // Load organizations on mount
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const orgs = await authClient.organization.list();
        const activeOrg = orgs.data?.find(
          (org) => org.id === activeOrganizationId?.activeOrganizationId,
        );
        setActiveOrg(activeOrg);
        setOrganizations(orgs.data || []);
      } catch (error) {
        console.error('Failed to load organizations:', error);
      }
    };

    loadOrganizations();
  }, [activeOrganizationId]);

  return (
    <div className="grid gap-6">
      <SettingsCard
        title="Organizations"
        // description="Test organization creation, member invites, and management functionality"
      >
        <div className="space-y-6">
          <Tabs defaultValue={organizations.length > 0 ? 'my-organizations' : 'create'}>
            <TabsList>
              {organizations.length > 0 && (
                <>
                  <TabsTrigger value="my-organizations">My Organizations</TabsTrigger>
                  <TabsTrigger value="invite">Invite Member</TabsTrigger>
                  <TabsTrigger value="pending">Pending Invitations</TabsTrigger>
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="team">Team</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </>
              )}
              <TabsTrigger value="create">Create Organization</TabsTrigger>
              <TabsTrigger value="results">Test Results</TabsTrigger>
            </TabsList>

            <TabsContent value="my-organizations">
              {organizations.length > 0 && (
                <MyOrganizations
                  organizations={organizations}
                  activeOrg={activeOrg}
                  handleSetActiveOrg={handleSetActiveOrganization}
                />
              )}
            </TabsContent>

            <TabsContent value="create">
              <CreateOrganization />
            </TabsContent>

            <TabsContent value="invite">
              {activeOrg && <InviteMember orgId={activeOrg.id} orgName={activeOrg.name} />}
            </TabsContent>

            <TabsContent value="pending">
              {activeOrg && <PendingInvites orgId={activeOrg.id} orgName={activeOrg.name} />}
            </TabsContent>

            <TabsContent value="members">
              {activeOrg && <MemberList orgId={activeOrg.id} />}
            </TabsContent>

            <TabsContent value="team">
              {activeOrg && <TeamManager orgId={activeOrg.id} />}
            </TabsContent>

            <TabsContent value="settings">
              {activeOrg && <SettingsEditor orgId={activeOrg.id} />}
            </TabsContent>

            <TabsContent value="results">
              <Card>
                <CardHeader>
                  <CardTitle>Test Results</CardTitle>
                  <CardDescription>
                    Check the console and toast notifications for test results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p>
                      • Organization creation: Check if the organization appears in the list above
                    </p>
                    <p>• Member invitations: Check your email for invitation links</p>
                    <p>• Active organization: The selected organization will be highlighted</p>
                    <p>• Backend logs: Check server logs for invitation email sending</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SettingsCard>
    </div>
  );
}
