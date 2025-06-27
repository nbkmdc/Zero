import { createRateLimiterMiddleware, privateProcedure, router } from '../trpc';
import { getZeroDB } from '../../lib/server-utils';
import { Ratelimit } from '@upstash/ratelimit';
import { TRPCError } from '@trpc/server';
import { createDriver } from '../../lib/driver';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';

const signatureSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  content: z.string().max(10000, 'Content must be less than 10,000 characters'),
  isDefault: z.boolean().optional().default(false),
});

export const signaturesRouter = router({
  list: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(60, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:get-signatures-${sessionUser?.id}`,
      }),
    )
    .query(async ({ ctx }) => {
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);
      
      const signatures = await db.findManySignatures();
      
      return signatures;
    }),

  create: privateProcedure
    .input(signatureSchema.omit({ id: true }))
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      const newSignature = await db.createSignature({
        name: input.name,
        content: input.content,
        isDefault: input.isDefault || false,
      });

      return newSignature;
    }),

  update: privateProcedure
    .input(signatureSchema.required({ id: true }))
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      const updatedSignature = await db.updateSignature(input.id, {
        name: input.name,
        content: input.content,
        isDefault: input.isDefault || false,
      });

      if (!updatedSignature) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Signature not found' });
      }

      return updatedSignature;
    }),

  delete: privateProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      const deleted = await db.deleteSignature(input.id);
      
      if (!deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Signature not found' });
      }

      return { success: true };
    }),

  setConnectionDefault: privateProcedure
    .input(z.object({ connectionId: z.string(), signatureId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      if (input.signatureId) {
        const signatureExists = await db.findSignatureById(input.signatureId);
        if (!signatureExists) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Signature not found' });
        }
      }

      await db.updateConnection(input.connectionId, { defaultSignatureId: input.signatureId });

      return { success: true };
    }),

  importFromGmail: privateProcedure
    .input(z.object({ connectionId: z.string() }))
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(10, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:import-gmail-signatures-${sessionUser?.id}`,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionUser } = ctx;
      const db = getZeroDB(sessionUser.id);

      const connection = await db.findUserConnection(input.connectionId);
      if (!connection) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found' });
      }

      if (connection.providerId !== 'google') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This feature only works with Gmail connections' });
      }

      if (!connection.accessToken || !connection.refreshToken) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Connection tokens are missing' });
      }

      const driver = createDriver(connection.providerId, {
        auth: {
          userId: sessionUser.id,
          accessToken: connection.accessToken,
          refreshToken: connection.refreshToken,
          email: connection.email,
        },
      });

      const gmailSignatures = await driver.getGmailSignatures();
      
      if (gmailSignatures.length === 0) {
        return { imported: 0, skipped: 0, message: 'No signatures found in Gmail' };
      }

      const existingSignatures = await db.findManySignatures();

      let importedCount = 0;
      let skippedCount = 0;
      const importedSignatures: any[] = [];
      const skippedSignatures: any[] = [];

      for (const gmailSig of gmailSignatures) {
        try {
          const plainTextContent = sanitizeHtml(gmailSig.signature, {
            allowedTags: [],
            allowedAttributes: {},
            textFilter: (text) => {
              return text
                .replace(/\s+/g, ' ')
                .trim();
            }
          });

          if (plainTextContent) {
            const isDuplicate = existingSignatures.some((existing: any) => {
              const normalizeContent = (content: string) => 
                content.replace(/\s+/g, ' ').trim().toLowerCase();
              
              return normalizeContent(existing.content) === normalizeContent(plainTextContent);
            });

            if (isDuplicate) {
              skippedSignatures.push({
                email: gmailSig.email,
                displayName: gmailSig.displayName,
                reason: 'Duplicate content'
              });
              skippedCount++;
              continue;
            }

            let signatureName = gmailSig.displayName 
              ? `${gmailSig.displayName} (${gmailSig.email})`
              : gmailSig.email;

            let nameCounter = 1;
            const originalName = signatureName;
            while (existingSignatures.some((sig: any) => sig.name === signatureName)) {
              signatureName = `${originalName} ${nameCounter + 1}`;
              nameCounter++;
            }

            const newSignature = await db.createSignature({
              name: signatureName,
              content: plainTextContent,
              isDefault: false,
            });

            importedSignatures.push(newSignature);
            importedCount++;
          }
        } catch (error) {
          console.error('Failed to import signature:', error);
          skippedCount++;
          skippedSignatures.push({
            email: gmailSig.email,
            displayName: gmailSig.displayName,
            reason: 'Import error'
          });
        }
      }

      let message = '';
      if (importedCount > 0 && skippedCount > 0) {
        message = `Imported ${importedCount} new signature${importedCount === 1 ? '' : 's'}, skipped ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'}`;
      } else if (importedCount > 0) {
        message = `Successfully imported ${importedCount} signature${importedCount === 1 ? '' : 's'} from Gmail`;
      } else if (skippedCount > 0) {
        message = `All ${skippedCount} signature${skippedCount === 1 ? '' : 's'} already exist${skippedCount === 1 ? 's' : ''} - no new signatures imported`;
      } else {
        message = 'No signatures found to import';
      }

      return { 
        imported: importedCount,
        skipped: skippedCount,
        signatures: importedSignatures,
        skippedSignatures,
        message
      };
    }),
}); 