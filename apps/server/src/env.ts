export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '3000',

  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || 'localhost',
  VITE_PUBLIC_BACKEND_URL: process.env.VITE_PUBLIC_BACKEND_URL || 'http://localhost:8787',
  VITE_PUBLIC_APP_URL: process.env.VITE_PUBLIC_APP_URL || 'http://localhost:3000',
  JWT_SECRET: process.env.JWT_SECRET || 'secret',

  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '123',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '123',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '123',

  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  DISABLE_CALLS: process.env.DISABLE_CALLS || 'true',
  VOICE_SECRET: process.env.VOICE_SECRET || '',
  GOOGLE_S_ACCOUNT: process.env.GOOGLE_S_ACCOUNT || '{}',
  DROP_AGENT_TABLES: process.env.DROP_AGENT_TABLES || 'false',
  THREAD_SYNC_MAX_COUNT: process.env.THREAD_SYNC_MAX_COUNT || '5',
  THREAD_SYNC_LOOP: process.env.THREAD_SYNC_LOOP || 'false',
  DISABLE_WORKFLOWS: process.env.DISABLE_WORKFLOWS || 'true',
  AUTORAG_ID: process.env.AUTORAG_ID || '',
  AUTUMN_SECRET_KEY: process.env.AUTUMN_SECRET_KEY || '',

  REDIS_URL: process.env.REDIS_URL || '',
  REDIS_TOKEN: process.env.REDIS_TOKEN || '',

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',

  HYPERDRIVE_CONNECTION_STRING:
    process.env.HYPERDRIVE_CONNECTION_STRING ||
    'postgresql://postgres:postgres@host.docker.internal:5432/zerodotemail',

  CLOUDFLARE_WORKER_URL: process.env.CLOUDFLARE_WORKER_URL || 'http://host.docker.internal:8787',
  CLOUDFLARE_INTERNAL_SECRET: process.env.CLOUDFLARE_INTERNAL_SECRET || 'internal-secret',

  ZERO_DB_URL: process.env.ZERO_DB_URL || '',
  ZERO_AGENT_URL: process.env.ZERO_AGENT_URL || '',
  ZERO_MCP_URL: process.env.ZERO_MCP_URL || '',
  ZERO_DRIVER_URL: process.env.ZERO_DRIVER_URL || '',

  THREAD_QUEUE_URL: process.env.THREAD_QUEUE_URL || '',
  SUBSCRIBE_QUEUE_URL: process.env.SUBSCRIBE_QUEUE_URL || '',

  GMAIL_HISTORY_ID_KV_URL: process.env.GMAIL_HISTORY_ID_KV_URL || '',
  GMAIL_PROCESSING_THREADS_KV_URL: process.env.GMAIL_PROCESSING_THREADS_KV_URL || '',
  SUBSCRIBED_ACCOUNTS_KV_URL: process.env.SUBSCRIBED_ACCOUNTS_KV_URL || '',
  CONNECTION_LABELS_KV_URL: process.env.CONNECTION_LABELS_KV_URL || '',
  PROMPTS_STORAGE_KV_URL: process.env.PROMPTS_STORAGE_KV_URL || '',
  GMAIL_SUB_AGE_KV_URL: process.env.GMAIL_SUB_AGE_KV_URL || '',
  SNOOZED_EMAILS_KV_URL: process.env.SNOOZED_EMAILS_KV_URL || '',

  THREADS_BUCKET_URL: process.env.THREADS_BUCKET_URL || '',

  AI_URL: process.env.AI_URL || '',
  VECTORIZE_URL: process.env.VECTORIZE_URL || '',
  VECTORIZE_MESSAGE_URL: process.env.VECTORIZE_MESSAGE_URL || '',
};

export type LocalEnv = typeof env;
