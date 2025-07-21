import { ChevronDown, Loader2, Plus, Save, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation, useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTRPC } from '@/providers/query-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2, 'Team name is required'),
});

interface TeamManagerProps {
  orgId: string | undefined;
}

interface Team {
  id: string;
  name: string;
  organizationId: string | null;
  created_at: Date;
  updated_at: Date | null;
}

export function TeamManager({ orgId, orgSlug }: TeamManagerProps & { orgSlug: string }) {
  const [loading, setLoading] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const trpc = useTRPC();
  const setActiveOrgMutation = useMutation(trpc.organization.setActiveOrganization.mutationOptions());

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const { data: teamsData, refetch: refetchTeams } = useQuery({
    ...trpc.team.listTeams.queryOptions({ organizationId: orgId || '' }),
    enabled: !!orgId,
  });

  const { data: membersData, refetch: refetchMembers } = useQuery({
    ...trpc.organization.listMembers.queryOptions({ organizationId: orgId || '' }),
    enabled: !!orgId,
  });

  const createTeamMutation = useMutation(trpc.team.createTeam.mutationOptions());
  const updateTeamMutation = useMutation(trpc.team.updateTeam.mutationOptions());
  const deleteTeamMutation = useMutation(trpc.team.deleteTeam.mutationOptions());
  const addTeamMemberMutation = useMutation(trpc.team.addTeamMember.mutationOptions());
  const removeTeamMemberMutation = useMutation(trpc.team.removeTeamMember.mutationOptions());
  const listTeamMembersQuery = (teamId: string) => trpc.team.listTeamMembers.queryOptions({ teamId });

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!orgId) return;

    setLoading(true);
    try {
      await createTeamMutation.mutateAsync({
        organizationId: orgId,
        name: values.name,
      });
      toast.success('Team created');
      reset();
      refetchTeams();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  }

  async function deleteTeam(teamId: string) {
    if (!orgId) return;

    try {
      await deleteTeamMutation.mutateAsync({
        organizationId: orgId,
        teamId,
      });
      toast.success('Team deleted');
      refetchTeams();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete team');
    }
  }

  function toggleTeamExpansion(teamId: string) {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  }

  function EditableRow({ team }: { team: Team }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(team.name);
    const [activeOrgSet, setActiveOrgSet] = useState(false);

    console.log('EditableRow render for team', team.id);

    useEffect(() => {
      console.log('Ensuring active org for team', team.id);
      let cancelled = false;
      async function ensureActiveOrg() {
        if (!orgId || !orgSlug) return;
        try {
          const result = await setActiveOrgMutation.mutateAsync({ organizationId: orgId, organizationSlug: orgSlug });
          console.log('setActiveOrgMutation result for team', team.id, ':', result);
          if (!cancelled) setActiveOrgSet(true);
        } catch (e) {
          console.error('setActiveOrgMutation error for team', team.id, ':', e);
          if (!cancelled) setActiveOrgSet(false);
        }
      }
      ensureActiveOrg();
      return () => { cancelled = true; };
    }, [orgId, orgSlug, team.id]);

    const { data: teamMembersData, refetch: refetchTeamMembers } = useQuery({
      ...listTeamMembersQuery(team.id),
      enabled: !!team.id && activeOrgSet,
    }) as any;

    useEffect(() => {
      console.log('teamMembersData for team', team.id, ':', teamMembersData);
    }, [teamMembersData, team.id]);

    async function save() {
      if (!name.trim() || name === team.name || !orgId) {
        setEditing(false);
        return;
      }

      try {
        await updateTeamMutation.mutateAsync({
          organizationId: orgId,
          teamId: team.id,
          name,
        } as any);
        toast.success('Team updated');
        refetchTeams();
        setEditing(false);
      } catch (error: any) {
        toast.error(error.message || 'Failed to update team');
      }
    }

    async function assignMemberToTeam(memberId: string) {
      if (!team.id) return;
      try {
        await addTeamMemberMutation.mutateAsync({
          teamId: team.id,
          userId: memberId,
        } as any);
        toast.success('Member assigned to team');
        refetchTeamMembers();
        refetchMembers();
      } catch (error: any) {
        toast.error(error.message || 'Failed to assign member');
      }
    }
    async function removeMemberFromTeam(memberId: string) {
      if (!team.id) return;
      try {
        await removeTeamMemberMutation.mutateAsync({
          teamId: team.id,
          userId: memberId,
        } as any);
        toast.success('Member removed from team');
        refetchTeamMembers();
        refetchMembers();
      } catch (error: any) {
        toast.error(error.message || 'Failed to remove member');
      }
    }

    function getTeamMembers() {
      return ((teamMembersData as any)?.members) || [];
    }

    function getUnassignedMembers() {
      // Members not in any team (fallback to org members if needed)
      return membersData?.members.filter((m) => !m.teamId) || [];
    }

    const teamMembers = getTeamMembers();
    const isExpanded = expandedTeams.has(team.id);

    return (
      <Collapsible open={isExpanded} onOpenChange={() => toggleTeamExpansion(team.id)}>
        <div className="flex items-center gap-3 py-1">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-auto p-0">
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </Button>
          </CollapsibleTrigger>

          {editing ? (
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 flex-1" />
          ) : (
            <span className="flex-1">{team.name}</span>
          )}

          <Badge variant="secondary">{teamMembers.length} members</Badge>

          <div className="flex gap-2">
            {editing ? (
              <Button size="icon" variant="ghost" onClick={save} aria-label="Save">
                <Save className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditing(true)}
                aria-label="Edit"
              >
                <Save className="h-4 w-4 opacity-0 group-hover:opacity-100" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => deleteTeam(team.id)}
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CollapsibleContent className="ml-6 mt-2 space-y-2">
          {teamMembers.map((member) => (
            <div key={member.id} className="flex items-center gap-2 text-sm">
              <span>
                {member.name?.split(' ')[0] || member.email?.split('@')[0] || member.userId}
              </span>
              <Badge variant="outline">{member.role}</Badge>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => removeMemberFromTeam(member.id)}
                aria-label="Remove from team"
              >
                <UserMinus className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {/* Add unassigned members to this team */}
          {getUnassignedMembers().map((member) => (
            <div key={member.id} className="flex items-center gap-2 text-sm opacity-60">
              <span>
                {member.name?.split(' ')[0] || member.email?.split('@')[0] || member.userId}
              </span>
              <Badge variant="outline">{member.role}</Badge>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => assignMemberToTeam(member.id)}
                aria-label="Add to team"
              >
                <UserPlus className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Teams
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2">
            <Input placeholder="New team name" {...register('name')} />
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </form>
          {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}

          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <div className="space-y-2">
              {(teamsData?.teams ?? []).map((t) => <EditableRow key={t.id} team={t} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
