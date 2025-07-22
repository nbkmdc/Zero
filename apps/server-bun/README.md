# Zero Server (Bun)

This is the Bun-compatible version of the Zero email server, isolated from Cloudflare Workers runtime to run in Docker containers.

## Architecture

This server runs on Bun and communicates with Cloudflare services through a proxy layer. All Cloudflare bindings (Durable Objects, KV, Queues, R2) are accessed via HTTP requests to the main Cloudflare Worker.

## Environment Variables

The following environment variables need to be configured:

### Core Configuration

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `COOKIE_DOMAIN` - Domain for cookies
- `VITE_PUBLIC_BACKEND_URL` - Backend URL
- `VITE_PUBLIC_APP_URL` - Frontend URL
- `JWT_SECRET` - JWT signing secret

### Database

- `HYPERDRIVE_CONNECTION_STRING` - PostgreSQL connection string

### Cloudflare Proxy

- `CLOUDFLARE_WORKER_URL` - URL of the main Cloudflare Worker
- `CLOUDFLARE_INTERNAL_SECRET` - Secret for internal API authentication

### Service URLs (configured automatically by proxy)

- `ZERO_DB_URL` - Durable Object proxy URL
- `ZERO_AGENT_URL` - Durable Object proxy URL
- `ZERO_MCP_URL` - Durable Object proxy URL
- `ZERO_DRIVER_URL` - Durable Object proxy URL
- `THREAD_QUEUE_URL` - Queue proxy URL
- `SUBSCRIBE_QUEUE_URL` - Queue proxy URL
- Various KV namespace URLs
- `THREADS_BUCKET_URL` - R2 bucket proxy URL

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start
```

## Docker

```bash
# Build Docker image
docker build -t zero-server-bun .

# Run container
docker run -p 3000:3000 \
  -e CLOUDFLARE_WORKER_URL=https://your-worker.your-subdomain.workers.dev \
  -e CLOUDFLARE_INTERNAL_SECRET=your-secret \
  -e HYPERDRIVE_CONNECTION_STRING=postgresql://... \
  zero-server-bun
```

## Proxy Communication

This server communicates with Cloudflare services through internal API routes on the main Cloudflare Worker:

- `/internal/durable-objects/{type}/{id}/{method}` - Durable Object calls
- `/internal/kv/{namespace}/{key}` - KV operations
- `/internal/queue/{name}/send` - Queue operations
- `/internal/r2/{bucket}/{key}` - R2 operations

All requests are authenticated using the `CLOUDFLARE_INTERNAL_SECRET`.
