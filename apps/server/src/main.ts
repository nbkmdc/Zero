import {
  createUpdatedMatrixFromNewEmail,
  initializeStyleMatrixFromEmail,
  type EmailMatrix,
  type WritingStyleMatrix,
} from './services/writing-style-service';
import {
  account,
  connection,
  note,
  session,
  user,
  userHotkeys,
  userSettings,
  writingStyleMatrix,
} from './db/schema';
import { EProviders, type ISubscribeBatch, type IThreadBatch } from './types';
import { getContainer, getRandom } from '@cloudflare/containers';
import { oAuthDiscoveryMetadata } from 'better-auth/plugins';
import { getZeroDB, verifyToken } from './lib/server-utils';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import { EWorkflowType, runWorkflow } from './pipelines';
import { ZeroAgent, ZeroDriver } from './routes/agent';
import { contextStorage } from 'hono/context-storage';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { defaultUserSettings } from './lib/schemas';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { getZeroDriver } from './lib/server-utils';
import { routePartykitRequest } from 'partyserver';
import { enableBrainFunction } from './lib/brain';
import { trpcServer } from '@hono/trpc-server';
import { agentsMiddleware } from 'hono-agents';
import { ZeroMCP } from './routes/agent/mcp';
import { publicRouter } from './routes/auth';
import { autumnApi } from './routes/autumn';
import type { HonoContext } from './ctx';
import { createAuth } from './lib/auth';
import { aiRouter } from './routes/ai';
import { ServerContainer } from '.';
import { Autumn } from 'autumn-js';
import { appRouter } from './trpc';
import { cors } from 'hono/cors';
import { Effect } from 'effect';
import { type DB } from './db';
import { Hono } from 'hono';

const SENTRY_HOST = 'o4509328786915328.ingest.us.sentry.io';
const SENTRY_PROJECT_IDS = new Set(['4509328795303936']);

export default class extends WorkerEntrypoint<Env> {
  db: DB | undefined;

  private createInternalRoutes() {
    return new Hono<HonoContext>()
      .use('*', async (c, next) => {
        // const authHeader = c.req.header('Authorization');
        // const expectedSecret = env.CLOUDFLARE_INTERNAL_SECRET || 'internal-secret';

        // if (!authHeader || !authHeader.startsWith('Bearer ')) {
        //   return c.json({ success: false, error: 'Missing authorization' }, 401);
        // }

        // const token = authHeader.split(' ')[1];
        // if (token !== expectedSecret) {
        //   return c.json({ success: false, error: 'Invalid authorization' }, 401);
        // }

        await next();
      })
      .post('/durable-objects/:type/:id/:method', async (c) => {
        try {
          console.log('here');

          const { type, id, method } = c.req.param();
          // console.log(type, id, method);
          const { args } = await c.req.json();

          // console.log(args);

          let stub:
            | DurableObjectStub<ZeroAgent>
            | DurableObjectStub<ZeroMCP>
            | DurableObjectStub<ZeroDriver>;
          switch (type) {
            case 'ZERO_MCP':
              stub = this.env.ZERO_MCP.get(this.env.ZERO_MCP.idFromName(id));
              break;
            case 'ZERO_DRIVER':
              stub = this.env.ZERO_DRIVER.get(this.env.ZERO_DRIVER.idFromName(id));
              break;
            default:
              return c.json({ success: false, error: 'Unknown durable object type' }, 400);
          }

          console.log('[stub:]', stub);

          const result = await (stub as any)[method](...args);

          console.log('[RESULT]', result);

          return c.json({ success: true, data: result });
        } catch (error) {
          return c.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            500,
          );
        }
      })
      .get('/kv/:namespace/:key', async (c) => {
        try {
          const { namespace, key } = c.req.param();
          const kvNamespace = (this.env as any)[namespace];
          if (!kvNamespace) {
            return c.json({ success: false, error: 'Unknown KV namespace' }, 400);
          }

          const result = await kvNamespace.get(key);
          return c.json({ success: true, data: result });
        } catch (error) {
          return c.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            500,
          );
        }
      })
      .put('/kv/:namespace/:key', async (c) => {
        try {
          const { namespace, key } = c.req.param();
          const { value, metadata } = await c.req.json();
          const kvNamespace = (this.env as any)[namespace];
          if (!kvNamespace) {
            return c.json({ success: false, error: 'Unknown KV namespace' }, 400);
          }

          await kvNamespace.put(key, value, metadata ? { metadata } : undefined);
          return c.json({ success: true });
        } catch (error) {
          return c.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            500,
          );
        }
      })
      .delete('/kv/:namespace/:key', async (c) => {
        try {
          const { namespace, key } = c.req.param();
          const kvNamespace = (this.env as any)[namespace];
          if (!kvNamespace) {
            return c.json({ success: false, error: 'Unknown KV namespace' }, 400);
          }

          await kvNamespace.delete(key);
          return c.json({ success: true });
        } catch (error) {
          return c.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            500,
          );
        }
      })
      .get('/kv/:namespace', async (c) => {
        try {
          const { namespace } = c.req.param();
          const kvNamespace = (this.env as any)[namespace];
          if (!kvNamespace) {
            return c.json({ success: false, error: 'Unknown KV namespace' }, 400);
          }

          const url = new URL(c.req.url);
          const options: any = {};
          if (url.searchParams.get('cursor')) options.cursor = url.searchParams.get('cursor');
          if (url.searchParams.get('limit'))
            options.limit = parseInt(url.searchParams.get('limit')!);

          const result = await kvNamespace.list(options);
          return c.json({ success: true, data: result });
        } catch (error) {
          return c.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            500,
          );
        }
      })
      .post('/queue/:name/send', async (c) => {
        try {
          const { name } = c.req.param();
          const { message } = await c.req.json();

          let queue;
          switch (name) {
            case 'thread_queue':
              queue = this.env.thread_queue;
              break;
            case 'subscribe_queue':
              queue = this.env.subscribe_queue;
              break;
            default:
              return c.json({ success: false, error: 'Unknown queue' }, 400);
          }

          await queue.send(message);
          return c.json({ success: true });
        } catch (error) {
          return c.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            500,
          );
        }
      })
      .get('/r2/:bucket/:key', async (c) => {
        try {
          const { bucket, key } = c.req.param();
          let r2Bucket;

          switch (bucket) {
            case 'THREADS_BUCKET':
              r2Bucket = this.env.THREADS_BUCKET;
              break;
            default:
              return c.json({ success: false, error: 'Unknown R2 bucket' }, 400);
          }

          const result = await r2Bucket.get(key);
          return c.json({ success: true, data: result });
        } catch (error) {
          return c.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            500,
          );
        }
      })
      .put('/r2/:bucket/:key', async (c) => {
        try {
          const { bucket, key } = c.req.param();
          const { value, metadata } = await c.req.json();
          let r2Bucket;

          switch (bucket) {
            case 'THREADS_BUCKET':
              r2Bucket = this.env.THREADS_BUCKET;
              break;
            default:
              return c.json({ success: false, error: 'Unknown R2 bucket' }, 400);
          }

          await r2Bucket.put(key, value, metadata ? { customMetadata: metadata } : undefined);
          return c.json({ success: true });
        } catch (error) {
          return c.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            500,
          );
        }
      })
      .delete('/r2/:bucket/:key', async (c) => {
        try {
          const { bucket, key } = c.req.param();
          let r2Bucket;

          switch (bucket) {
            case 'THREADS_BUCKET':
              r2Bucket = this.env.THREADS_BUCKET;
              break;
            default:
              return c.json({ success: false, error: 'Unknown R2 bucket' }, 400);
          }

          await r2Bucket.delete(key);
          return c.json({ success: true });
        } catch (error) {
          return c.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            500,
          );
        }
      });
  }

  private app = new Hono<HonoContext>()
    .use(
      '*',
      cors({
        origin: (origin) => {
          if (!origin) return null;
          let hostname: string;
          try {
            hostname = new URL(origin).hostname;
          } catch {
            return null;
          }
          const cookieDomain = this.env.COOKIE_DOMAIN;
          if (!cookieDomain) return null;
          if (hostname === cookieDomain || hostname.endsWith('.' + cookieDomain)) {
            return origin;
          }
          return null;
        },
        credentials: true,
        allowHeaders: ['Content-Type', 'Authorization'],
        exposeHeaders: ['X-Zero-Redirect'],
      }),
    )
    .get('.well-known/oauth-authorization-server', async (c) => {
      const auth = createAuth();
      return oAuthDiscoveryMetadata(auth)(c.req.raw);
    })
    .mount(
      '/sse',
      async (request, env, ctx) => {
        const authBearer = request.headers.get('Authorization');
        if (!authBearer) {
          return new Response('Unauthorized', { status: 401 });
        }
        const auth = createAuth();
        const session = await auth.api.getMcpSession({ headers: request.headers });
        if (!session) {
          return new Response('Unauthorized', { status: 401 });
        }
        ctx.props = {
          userId: session?.userId,
        };
        return ZeroMCP.serveSSE('/sse', { binding: 'ZERO_MCP' }).fetch(request, env, ctx);
      },
      { replaceRequest: false },
    )
    .mount(
      '/mcp',
      async (request, env, ctx) => {
        const authBearer = request.headers.get('Authorization');
        if (!authBearer) {
          return new Response('Unauthorized', { status: 401 });
        }
        const auth = createAuth();
        const session = await auth.api.getMcpSession({ headers: request.headers });
        ctx.props = {
          userId: session?.userId,
        };
        return ZeroMCP.serve('/mcp', { binding: 'ZERO_MCP' }).fetch(request, env, ctx);
      },
      { replaceRequest: false },
    )
    // .route('/api', this.api)
    .route('/internal', this.createInternalRoutes())
    .use(
      '*',
      agentsMiddleware({
        options: {
          onBeforeConnect: (c) => {
            if (!c.headers.get('Cookie')) {
              return new Response('Unauthorized', { status: 401 });
            }
          },
        },
      }),
    )
    .get('/health', (c) => c.json({ message: 'Zero Server is Up!' }))
    .get('/', (c) => c.redirect(`${this.env.VITE_PUBLIC_APP_URL}`))
    .post('/monitoring/sentry', async (c) => {
      try {
        const envelopeBytes = await c.req.arrayBuffer();
        const envelope = new TextDecoder().decode(envelopeBytes);
        const piece = envelope.split('\n')[0];
        const header = JSON.parse(piece);
        const dsn = new URL(header['dsn']);
        const project_id = dsn.pathname?.replace('/', '');

        if (dsn.hostname !== SENTRY_HOST) {
          throw new Error(`Invalid sentry hostname: ${dsn.hostname}`);
        }

        if (!project_id || !SENTRY_PROJECT_IDS.has(project_id)) {
          throw new Error(`Invalid sentry project id: ${project_id}`);
        }

        const upstream_sentry_url = `https://${SENTRY_HOST}/api/${project_id}/envelope/`;
        await fetch(upstream_sentry_url, {
          method: 'POST',
          body: envelopeBytes,
        });

        return c.json({}, { status: 200 });
      } catch (e) {
        console.error('error tunneling to sentry', e);
        return c.json({ error: 'error tunneling to sentry' }, { status: 500 });
      }
    })
    .post('/a8n/notify/:providerId', async (c) => {
      if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, { status: 401 });
      if (this.env.DISABLE_WORKFLOWS === 'true') return c.json({ message: 'OK' }, { status: 200 });
      const providerId = c.req.param('providerId');
      if (providerId === EProviders.google) {
        const body = await c.req.json<{ historyId: string }>();
        const subHeader = c.req.header('x-goog-pubsub-subscription-name');
        if (!subHeader) {
          console.log('[GOOGLE] no subscription header', body);
          return c.json({}, { status: 200 });
        }
        const isValid = await verifyToken(c.req.header('Authorization')!.split(' ')[1]);
        if (!isValid) {
          console.log('[GOOGLE] invalid request', body);
          return c.json({}, { status: 200 });
        }
        try {
          await this.env.thread_queue.send({
            providerId,
            historyId: body.historyId,
            subscriptionName: subHeader!,
          });
        } catch (error) {
          console.error('Error sending to thread queue', error, {
            providerId,
            historyId: body.historyId,
            subscriptionName: subHeader,
          });
        }
        return c.json({ message: 'OK' }, { status: 200 });
      }
    });

  async fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    console.log('Got a fetch request', pathname);
    if (pathname.startsWith('/api')) {
      // console.log('pathname', pathname, Array.from(request.headers.entries()));
      const containerInstance = getContainer(this.env.SERVER_CONTAINER, pathname);
      return containerInstance.fetch(request);
    }
    return this.app.fetch(request, this.env);
  }

  async queue(batch: MessageBatch<any>) {
    switch (true) {
      case batch.queue.startsWith('subscribe-queue'): {
        console.log('batch', batch);
        try {
          await Promise.all(
            batch.messages.map(async (msg: Message<ISubscribeBatch>) => {
              const connectionId = msg.body.connectionId;
              const providerId = msg.body.providerId;
              console.log('connectionId', connectionId);
              console.log('providerId', providerId);
              try {
                await enableBrainFunction({ id: connectionId, providerId });
              } catch (error) {
                console.error(
                  `Failed to enable brain function for connection ${connectionId}:`,
                  error,
                );
              }
            }),
          );
          console.log('[SUBSCRIBE_QUEUE] batch done');
        } finally {
          batch.ackAll();
        }
        return;
      }
      case batch.queue.startsWith('thread-queue'): {
        console.log('batch', batch);
        try {
          await Promise.all(
            batch.messages.map(async (msg: Message<IThreadBatch>) => {
              const providerId = msg.body.providerId;
              const historyId = msg.body.historyId;
              const subscriptionName = msg.body.subscriptionName;
              const workflow = runWorkflow(EWorkflowType.MAIN, {
                providerId,
                historyId,
                subscriptionName,
              });

              try {
                const result = await Effect.runPromise(workflow);
                console.log('[THREAD_QUEUE] result', result);
              } catch (error) {
                console.error('Error running workflow', error);
              }
            }),
          );
        } finally {
          batch.ackAll();
        }
        break;
      }
    }
  }

  async scheduled() {
    console.log('[SCHEDULED] Checking for expired subscriptions...');
    const allAccounts = await this.env.subscribed_accounts.list();
    console.log('[SCHEDULED] allAccounts', allAccounts.keys);
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    const expiredSubscriptions: Array<{ connectionId: string; providerId: EProviders }> = [];

    const nowTs = Date.now();

    const unsnoozeMap: Record<string, { threadIds: string[]; keyNames: string[] }> = {};

    let cursor: string | undefined = undefined;
    do {
      const listResp: {
        keys: { name: string; metadata?: { wakeAt?: string } }[];
        cursor?: string;
      } = await this.env.snoozed_emails.list({ cursor, limit: 1000 });
      cursor = listResp.cursor;

      for (const key of listResp.keys) {
        try {
          const wakeAtIso = (key as any).metadata?.wakeAt as string | undefined;
          if (!wakeAtIso) continue;
          const wakeAt = new Date(wakeAtIso).getTime();
          if (wakeAt > nowTs) continue;

          const [threadId, connectionId] = key.name.split('__');
          if (!threadId || !connectionId) continue;

          if (!unsnoozeMap[connectionId]) {
            unsnoozeMap[connectionId] = { threadIds: [], keyNames: [] };
          }
          unsnoozeMap[connectionId].threadIds.push(threadId);
          unsnoozeMap[connectionId].keyNames.push(key.name);
        } catch (error) {
          console.error('Failed to prepare unsnooze for key', key.name, error);
        }
      }
    } while (cursor);

    await Promise.all(
      Object.entries(unsnoozeMap).map(async ([connectionId, { threadIds, keyNames }]) => {
        try {
          const agent = await getZeroDriver(connectionId);
          await agent.queue('unsnoozeThreadsHandler', { connectionId, threadIds, keyNames });
        } catch (error) {
          console.error('Failed to enqueue unsnooze tasks', { connectionId, threadIds, error });
        }
      }),
    );

    await Promise.all(
      allAccounts.keys.map(async (key) => {
        const [connectionId, providerId] = key.name.split('__');
        const lastSubscribed = await this.env.gmail_sub_age.get(key.name);

        if (lastSubscribed) {
          const subscriptionDate = new Date(lastSubscribed);
          if (subscriptionDate < fiveDaysAgo) {
            console.log(
              `[SCHEDULED] Found expired Google subscription for connection: ${connectionId}`,
            );
            expiredSubscriptions.push({ connectionId, providerId: providerId as EProviders });
          }
        }
      }),
    );

    // Send expired subscriptions to queue for renewal
    if (expiredSubscriptions.length > 0) {
      console.log(
        `[SCHEDULED] Sending ${expiredSubscriptions.length} expired subscriptions to renewal queue`,
      );
      await Promise.all(
        expiredSubscriptions.map(async ({ connectionId, providerId }) => {
          await this.env.subscribe_queue.send({ connectionId, providerId });
        }),
      );
    }

    console.log(
      `[SCHEDULED] Processed ${allAccounts.keys.length} accounts, found ${expiredSubscriptions.length} expired subscriptions`,
    );
  }
}

export { ZeroAgent, ZeroMCP, ZeroDriver, ServerContainer };
