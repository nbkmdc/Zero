import { activeConnectionProcedure, privateProcedure, router } from '../trpc';
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
          body: {
            organizationId,
          },
        });
        console.log('teams', teams);
        return { teams } as const;
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
          organizationId,
          name,
        });
        return { success: true, id: team.id } as const;
      } catch (error) {
        console.error(error);
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
          teamId,
          data: {
            name,
          },
        });
        return { success: true, id: team.id } as const;
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
        const team = await ctx.c.var.auth.api.removeTeam({
          teamId,
          organizationId,
        });
        return { success: true, id: team.id } as const;
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
        const team = await ctx.c.var.auth.api.getTeam({
          teamId,
          headers: ctx.c.req.raw.headers,
        });
        return { team };
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
        const members = await ctx.c.var.auth.api.listTeamMembers({
          teamId,
          headers: ctx.c.req.raw.headers,
        });
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
        await ctx.c.var.auth.api.addTeamMember({
          teamId,
          userId,
          headers: ctx.c.req.raw.headers,
        });
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
          teamId,
          userId,
          headers: ctx.c.req.raw.headers,
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
          teamId,
          headers: ctx.c.req.raw.headers,
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
