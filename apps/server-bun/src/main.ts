import { cors } from 'hono/cors';
import { env } from './env';
import { Hono } from 'hono';

const app = new Hono()
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
  .get('/health', (c) => c.json({ message: 'Zero Server (Bun) is Up!' }))
  .get('/', (c) => c.redirect(`${env.VITE_PUBLIC_APP_URL}`));

const port = parseInt(env.PORT);

console.log(`🚀 Zero Server (Bun) starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
