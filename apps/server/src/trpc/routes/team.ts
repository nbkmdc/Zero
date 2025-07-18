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
      const { organizationId, name } = input;
      const team = await ctx.c.var.auth.api.createTeam({
        organizationId,
        name,
      });
      return { success: true, id: team.id } as const;
    }),
  updateTeam: activeConnectionProcedure
    .input(z.object({ organizationId: z.string(), teamId: z.string(), name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { teamId, name } = input;
      const team = await ctx.c.var.auth.api.updateTeam({
        teamId,
        data: {
          name,
        },
      });
      return { success: true, id: team.id } as const;
    }),
  deleteTeam: activeConnectionProcedure
    .input(z.object({ organizationId: z.string(), teamId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { organizationId, teamId } = input;
      const team = await ctx.c.var.auth.api.removeTeam({
        teamId,
        organizationId,
      });
      return { success: true, id: team.id } as const;
    }),
});
