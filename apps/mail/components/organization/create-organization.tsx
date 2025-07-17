import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { toast } from 'sonner';

export default function CreateOrganization() {
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgDomain, setOrgDomain] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [domainVerified, setDomainVerified] = useState(false);
  const [domainVerificationToken, setDomainVerificationToken] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);

  const trpc = useTRPC();

  const verifyDomainMutation = useMutation(trpc.organization.verifyDomain.mutationOptions());

  // Test organization creation
  const handleCreateOrganization = async () => {
    if (!orgName || !orgSlug || !orgDomain || !domainVerified) {
      toast.error('Please fill in all fields and verify your domain');
      return;
    }
    setCreatingOrg(true);
    try {
      await authClient.organization.create({
        name: orgName,
        slug: orgSlug,
      });
      toast.success(`Organization "${orgName}" created successfully!`);
      setOrgName('');
      setOrgSlug('');
      setOrgDomain('');
      setDomainVerificationToken(null);
      setDomainVerified(false);
      setVerifyMsg(null);
      setVerificationToken(null);
      // Refresh organizations list
      const orgs = await authClient.organization.list();
      setOrganizations(orgs.data || []);
    } catch (error: any) {
      toast.error(`Failed to create organization: ${error.message}`);
    } finally {
      setCreatingOrg(false);
    }
  };

  // Check domain verification and slug availability
  const handleAddDomain = async () => {
    if (!orgName || !orgSlug || !orgDomain) {
      toast.error('Please fill in organization name, slug, and domain');
      return;
    }
    setVerifying(true);
    setVerifyMsg(null);

    try {
      // Check if slug is available
      const orgs = await authClient.organization.list();
      const slugExists = orgs.data?.some((org) => org.slug === orgSlug);
      if (slugExists) {
        toast.error('Organization slug already exists. Please choose a different one.');
        setVerifying(false);
        return;
      }

      // Check domain verification directly
      const result = await verifyDomainMutation.mutateAsync({
        domain: orgDomain,
        verificationToken: verificationToken ?? undefined,
      });

      // Store the verification token for reuse
      if (result.verificationToken) {
        setVerificationToken(result.verificationToken);
      }

      if (result.verified) {
        setDomainVerified(true);
        setVerifyMsg('Domain verified! You can now create your organization.');
      } else {
        setVerifyMsg(
          result.message || 'Domain verification failed. Please add the TXT record to your DNS.',
        );
      }
    } catch (error: any) {
      toast.error(`Failed to verify domain: ${error.message}`);
    } finally {
      setVerifying(false);
    }
  };

  // DEBUG BYPASS VERIFICATION
  const handleDebugBypass = () => {
    setDomainVerified(true);
    toast.success('DEBUG: Domain verification bypassed!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Create Organization
        </CardTitle>
        <CardDescription>
          Create a new organization. You must verify your domain before proceeding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="My Organization"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">Organization Slug</Label>
            <Input
              id="org-slug"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
              placeholder="my-org"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-domain">Organization Domain</Label>
            <Input
              id="org-domain"
              value={orgDomain}
              onChange={(e) => setOrgDomain(e.target.value)}
              placeholder="example.com"
            />
            <Button
              onClick={handleAddDomain}
              disabled={!orgName || !orgSlug || !orgDomain || verifying}
              className="mt-2 w-full"
              type="button"
            >
              {verifying ? 'Checking...' : 'Verify Domain & Check Slug'}
            </Button>
          </div>
        </div>
        {verifyMsg && (
          <div className="bg-muted mt-4 rounded border p-4">
            <div className="text-sm text-blue-600">{verifyMsg}</div>
            {verificationToken && !domainVerified && (
              <div className="mt-2">
                <div className="mb-2 text-sm">Add this TXT record to your DNS:</div>
                <code className="mb-2 block rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-900">
                  zero-verification={verificationToken}
                </code>
                <Button onClick={handleAddDomain} disabled={verifying} size="sm" type="button">
                  {verifying ? 'Checking...' : 'Retry Verification'}
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={handleDebugBypass} style={{ marginLeft: 8 }}>
              DEBUG: Bypass Verification
            </Button>
          </div>
        )}
        <Button
          onClick={handleCreateOrganization}
          disabled={creatingOrg || !orgName || !orgSlug || !orgDomain || !domainVerified}
          className="w-full"
          type="button"
        >
          {creatingOrg ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Organization'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
