// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CreateOrganization from '@/components/organization/create-organization';
import { SettingsEditor } from '@/components/organization/settings-editor';
import MyOrganizations from '@/components/organization/my-organizations';
import PendingInvites from '@/components/organization/pending-invites';
import { TeamManager } from '@/components/organization/team-manager';
import InviteMember from '@/components/organization/invite-member';
import { MemberList } from '@/components/organization/member-list';
import { SettingsCard } from '@/components/settings/settings-card';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { useCallback } from 'react';
// import { toast } from 'sonner';

// type Domain = {
//   domain: string;
//   verified: boolean;
//   verificationToken: string | null;
// };

export default function OrganizationPage() {
  // const [domains, setDomains] = useState<Domain[]>([]);
  // const [newDomain, setNewDomain] = useState('');
  // const [verifying, setVerifying] = useState(false);
  // const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  const trpc = useTRPC();

  const { data: activeOrganization, refetch: refetchActiveOrganization } =
    authClient.useActiveOrganization();

  const setActiveOrganization = useCallback(
    (organizationId: string) => {
      authClient.organization.setActive({
        organizationId,
      });
      refetchActiveOrganization();
    },
    [activeOrganization],
  );

  const handleSetActiveOrganization = async (org: any) => {
    setActiveOrganization(org.id);
    refetchActiveOrganization();
  };

  // const { data: domainsData } = useQuery({
  //   ...trpc.organization.listDomains.queryOptions({ organizationId: activeOrganization?.id || '' }),
  //   enabled: !!activeOrganization?.id,
  // });

  const { data: { organizations } = {} } = useQuery({
    ...trpc.organization.list.queryOptions(),
    enabled: !!activeOrganization?.id,
  });

  // TRPC mutations
  // const addDomainMutation = useMutation(trpc.organization.addDomain.mutationOptions());
  // const removeDomainMutation = useMutation(trpc.organization.removeDomain.mutationOptions());
  // const verifyDomainForOrgMutation = useMutation(
  //   trpc.organization.verifyDomainForOrg.mutationOptions(),
  // );

  // useEffect(() => {
  //   if (domainsData?.domains) {
  //     setDomains(
  //       domainsData.domains.map((d) => ({
  //         ...d,
  //         verificationToken: d.verificationToken || null,
  //       })),
  //     );
  //   }
  // }, [domainsData]);

  // async function addDomain(e?: React.FormEvent) {
  //   if (e) e.preventDefault();
  //   if (!newDomain || !activeOrganization?.id) return;

  //   try {
  //     await addDomainMutation.mutateAsync({
  //       organizationId: activeOrganization.id,
  //       domain: newDomain,
  //     });
  //     setNewDomain('');
  //     refetchDomains();
  //     toast.success('Domain added successfully');
  //   } catch (error: any) {
  //     console.error('addDomain error', error);
  //     toast.error('Failed to add domain');
  //   }
  // }

  // async function removeDomain(domain: string) {
  //   if (!activeOrganization?.id) return;

  //   try {
  //     await removeDomainMutation.mutateAsync({
  //       organizationId: activeOrganization.id,
  //       domain,
  //     });
  //     refetchDomains();
  //     toast.success('Domain removed successfully');
  //   } catch (error: any) {
  //     toast.error('Failed to remove domain');
  //   }
  // }

  // async function verifyDomain(domain: string) {
  //   if (!activeOrganization?.id) return;
  //   setVerifying(true);
  //   setVerifyMsg(null);

  //   try {
  //     const result = await verifyDomainForOrgMutation.mutateAsync({
  //       organizationId: activeOrganization.id,
  //       domain,
  //     });

  //     if ('verified' in result && result.verified) {
  //       setVerifyMsg('Domain verified!');
  //       refetchDomains();
  //     } else if ('message' in result && result.message) {
  //       setVerifyMsg(result.message);
  //     } else if ('error' in result && result.error) {
  //       setVerifyMsg(result.error);
  //     } else {
  //       setVerifyMsg('Verification failed');
  //     }
  //   } catch (error: any) {
  //     console.error('verifyDomain error', error);
  //     setVerifyMsg('Verification failed');
  //   } finally {
  //     setVerifying(false);
  //   }
  // }

  // // Load organizations on mount
  // useEffect(() => {
  //   const loadOrganizations = async () => {
  //     try {
  //       const orgs = await authClient.organization.list();
  //       setOrganizations(orgs.data || []);
  //     } catch (error) {
  //       console.error('Failed to load organizations:', error);
  //     }
  //   };

  //   loadOrganizations();
  // }, [activeOrganization]);

  return (
    <div className="grid gap-6">
      <SettingsCard
        title="Organizations"
        // description="Test organization creation, member invites, and management functionality"
      >
        <div className="space-y-6">
          <Tabs
            defaultValue={organizations && organizations.length > 0 ? 'my-organizations' : 'create'}
          >
            <TabsList>
              <TabsTrigger value="my-organizations">My Organizations</TabsTrigger>
              {organizations && organizations.length > 0 && (
                <>
                  <TabsTrigger value="invite">Invite Member</TabsTrigger>
                  <TabsTrigger value="pending">Pending Invitations</TabsTrigger>
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="team">Team</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </>
              )}
              <TabsTrigger value="create">Create Organization</TabsTrigger>
            </TabsList>

            <TabsContent value="my-organizations">
              {organizations && organizations.length > 0 && (
                <MyOrganizations
                  organizations={organizations}
                  activeOrg={activeOrganization}
                  handleSetActiveOrg={handleSetActiveOrganization}
                />
              )}
            </TabsContent>

            <TabsContent value="create">
              <CreateOrganization />
            </TabsContent>

            <TabsContent value="invite">
              {activeOrganization && (
                <InviteMember orgId={activeOrganization.id} orgName={activeOrganization.name} />
              )}
            </TabsContent>

            <TabsContent value="pending">
              {activeOrganization && (
                <PendingInvites orgId={activeOrganization.id} orgName={activeOrganization.name} />
              )}
            </TabsContent>

            <TabsContent value="members">
              {activeOrganization && <MemberList orgId={activeOrganization.id} />}
            </TabsContent>

            <TabsContent value="team">
              {activeOrganization && <TeamManager orgId={activeOrganization.id} />}
            </TabsContent>

            <TabsContent value="settings">
              {activeOrganization && <SettingsEditor orgId={activeOrganization.id} />}
            </TabsContent>
          </Tabs>
        </div>
      </SettingsCard>
    </div>
  );
}
