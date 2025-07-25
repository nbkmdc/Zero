import { contextStorage } from 'hono/context-storage';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { getZeroDB } from './lib/server-utils';
import { trpcServer } from '@hono/trpc-server';
import { publicRouter } from './routes/auth';
import { autumnApi } from './routes/autumn';
import type { HonoContext } from './ctx';
import { createAuth } from './lib/auth';
import { aiRouter } from './routes/ai';
import { Autumn } from 'autumn-js';
import { appRouter } from './trpc';
import { cors } from 'hono/cors';
import { env } from './env';
import { Hono } from 'hono';

const api = new Hono<HonoContext>()
  .use(contextStorage())
  .use('*', async (c, next) => {
    const auth = createAuth();
    c.set('auth', auth);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set('sessionUser', session?.user);

    if (c.req.header('Authorization') && !session?.user) {
      const token = c.req.header('Authorization')?.split(' ')[1];

      if (token) {
        const localJwks = await auth.api.getJwks();
        const jwks = createLocalJWKSet(localJwks);

        const { payload } = await jwtVerify(token, jwks);
        const userId = payload.sub;

        if (userId) {
          const db = await getZeroDB(userId);
          c.set('sessionUser', await db.findUser());
        }
      }
    }

    const autumn = new Autumn({ secretKey: env.AUTUMN_SECRET_KEY });
    c.set('autumn', autumn);

    await next();

    c.set('sessionUser', undefined);
    c.set('autumn', undefined as any);
    c.set('auth', undefined as any);
  })
  .route('/ai', aiRouter)
  .route('/autumn', autumnApi)
  .route('/public', publicRouter)
  .on(['GET', 'POST', 'OPTIONS'], '/auth/*', (c) => {
    return c.var.auth.handler(c.req.raw);
  })
  .use(
    trpcServer({
      endpoint: '/api/trpc',
      router: appRouter,
      createContext: (_, c) => {
        return { c, sessionUser: c.var['sessionUser'], db: c.var['db'] };
      },
      allowMethodOverride: true,
      onError: (opts) => {
        console.error('Error in TRPC handler:', opts.error);
      },
    }),
  )
  .onError(async (err, c) => {
    if (err instanceof Response) return err;
    console.error('Error in Hono handler:', err);
    return c.json(
      {
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500,
    );
  });

const app = new Hono<HonoContext>()
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
        const cookieDomain = env.COOKIE_DOMAIN;
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
  .get('/api/health', (c) => c.json({ message: 'Zero Server is Up from Server!' }))
  .get('/api/env', (c) => c.json({ env, processEnv: process.env }))
  .route('/api', api);

export default {
  port: 1337,
  fetch: app.fetch,
};
