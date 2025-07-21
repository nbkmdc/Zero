import { activeConnectionProcedure, router } from '../trpc';
import { getZeroDB } from '../../lib/server-utils';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const teamRouter = router({
  listTeams: activeConnectionProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const { organizationId } = input;
        const teams = await ctx.c.var.auth.api.listOrganizationTeams({
          headers: ctx.c.req.raw.headers,
          query: {
            organizationId,
          },
        });
        return { teams: Array.isArray(teams) ? teams : [] } as const;
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list teams',
        });
      }
    }),
  createTeam: activeConnectionProcedure
    .input(z.object({ organizationId: z.string(), name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { organizationId, name } = input;
        const team = await ctx.c.var.auth.api.createTeam({
          body: {
            organizationId,
            name,
          },
          headers: ctx.c.req.raw.headers,
          request: ctx.c.req.raw,
        });
        return { success: true, id: team.id } as const;
      } catch (error) {
        console.error('createTeam error', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create team',
        });
      }
    }),
  updateTeam: activeConnectionProcedure
    .input(z.object({ organizationId: z.string(), teamId: z.string(), name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { teamId, name } = input;
        const team = await ctx.c.var.auth.api.updateTeam({
          body: {
            teamId,
            data: {
              name,
            },
          },
          headers: ctx.c.req.raw.headers,
          request: ctx.c.req.raw,
        });
        return { success: true, id: team?.id } as const;
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update team',
        });
      }
    }),
  deleteTeam: activeConnectionProcedure
    .input(z.object({ organizationId: z.string(), teamId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { organizationId, teamId } = input;
        await ctx.c.var.auth.api.removeTeam({
          body: {
            teamId,
            organizationId,
          },
          headers: ctx.c.req.raw.headers,
          request: ctx.c.req.raw,
        });
        return { success: true } as const;
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete team',
        });
      }
    }),

  getTeam: activeConnectionProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const { teamId } = input;
        const { sessionUser } = ctx;
        const db = getZeroDB(sessionUser.id);
        const team = await db.findTeam(teamId);
        return {
          team: team
            ? {
                id: team.id,
                name: team.name,
                createdAt: team.createdAt,
                updatedAt: team.updatedAt,
              }
            : null,
        };
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get team',
        });
      }
    }),

  listTeamMembers: activeConnectionProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const { teamId } = input;
        console.log('listTeamMembers input', { teamId });
        const members = await ctx.c.var.auth.api.listTeamMembers({
          query: {
            teamId,
          },
          headers: ctx.c.req.raw.headers,
        });
        console.log('listTeamMembers members', members);
        return { members };
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list team members',
        });
      }
    }),

  addTeamMember: activeConnectionProcedure
    .input(z.object({ teamId: z.string(), userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { teamId, userId } = input;
        console.log('addTeamMember input', { teamId, userId });
        await ctx.c.var.auth.api.addTeamMember({
          body: {
            teamId,
            userId,
          },
          headers: ctx.c.req.raw.headers,
        });
        console.log('addTeamMember success');
        return { success: true };
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add team member',
        });
      }
    }),

  removeTeamMember: activeConnectionProcedure
    .input(z.object({ teamId: z.string(), userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { teamId, userId } = input;
        await ctx.c.var.auth.api.removeTeamMember({
          body: {
            teamId,
            userId,
          },
          headers: ctx.c.req.raw.headers,
          request: ctx.c.req.raw,
        });
        return { success: true };
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove team member',
        });
      }
    }),

  setActiveTeam: activeConnectionProcedure
    .input(z.object({ teamId: z.string().nullable() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { teamId } = input;
        await ctx.c.var.auth.api.setActiveTeam({
          body: {
            teamId,
          },
          headers: ctx.c.req.raw.headers,
          request: ctx.c.req.raw,
        });
        return { success: true };
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to set active team',
        });
      }
    }),
});
