// import { DriverRpcDO } from './routes/agent/rpc';
import type { ZeroAgent, ZeroDriver, ZeroMCP } from './main';
import A, { type AxiosInstance } from 'axios';
import { env } from './env';

class CloudflareProxy {
  private baseUrl: string;
  private secret: string;
  private instance: AxiosInstance;

  constructor() {
    this.baseUrl = env.CLOUDFLARE_WORKER_URL;
    this.secret = env.CLOUDFLARE_INTERNAL_SECRET;
    this.instance = A.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.secret}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/internal${endpoint}`;
    let response;
    if (options.method === 'POST') {
      response = this.instance.post(url, options.body, {
        headers: {
          Authorization: `Bearer ${this.secret}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    } else {
      response = this.instance.get(url, {
        headers: {
          Authorization: `Bearer ${this.secret}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    }
    try {
      response = await response;
    } catch (error: any) {
      throw new Error(`Proxy request failed: ${error.message}`);
    }
    if (!response) {
      throw new Error(response || 'Proxy request failed');
    }

    return response.data as T;
  }

  async durableObjectCall<T>(
    objectType: string,
    objectId: string,
    method: string,
    args: any[] = [],
  ): Promise<T> {
    return this.makeRequest(`/durable-objects/${objectType}/${objectId}/${method}`, {
      method: 'POST',
      body: JSON.stringify({ args }),
    });
  }

  async kvGet(namespace: string, key: string) {
    return this.makeRequest(`/kv/${namespace}/${key}`, {
      method: 'GET',
    });
  }

  async kvPut(namespace: string, key: string, value: string, metadata?: any) {
    return this.makeRequest(`/kv/${namespace}/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value, metadata }),
    });
  }

  async kvDelete(namespace: string, key: string) {
    return this.makeRequest(`/kv/${namespace}/${key}`, {
      method: 'DELETE',
    });
  }

  async kvList(namespace: string, options: any = {}) {
    const params = new URLSearchParams(options);
    return this.makeRequest(`/kv/${namespace}?${params}`, {
      method: 'GET',
    });
  }

  async queueSend(queueName: string, message: any) {
    return this.makeRequest(`/queue/${queueName}/send`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async r2Get(bucketName: string, key: string) {
    return this.makeRequest(`/r2/${bucketName}/${key}`, {
      method: 'GET',
    });
  }

  async r2Put(bucketName: string, key: string, value: any, metadata?: any) {
    return this.makeRequest(`/r2/${bucketName}/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value, metadata }),
    });
  }

  async r2Delete(bucketName: string, key: string) {
    return this.makeRequest(`/r2/${bucketName}/${key}`, {
      method: 'DELETE',
    });
  }
}

export const cloudflareProxy = new CloudflareProxy();
// Helper function to create dynamic method wrappers using Proxy
function createMethodWrapper<T extends object>(objectType: string, id: string): T {
  return new Proxy({} as T, {
    get(target, prop) {
      console.log('target!', target);
      console.log('prop!', prop);

      if (typeof prop === 'string') {
        return (...args: any[]) => cloudflareProxy.durableObjectCall(objectType, id, prop, args);
      }
      return undefined;
    },
  });
}

export const durableObjects = {
  ZERO_AGENT: {
    get: (id: string) => {
      return createMethodWrapper<ZeroAgent>('ZERO_AGENT', id);
    },
  },

  ZERO_MCP: {
    get: (id: string) => {
      return createMethodWrapper<ZeroMCP>('ZERO_MCP', id);
    },
  },

  ZERO_DRIVER: {
    get: (id: string) => {
      return createMethodWrapper<ZeroDriver>('ZERO_DRIVER', id);
    },
  },
};

export const kvNamespaces = {
  gmail_history_id: {
    get: (key: string) => cloudflareProxy.kvGet('gmail_history_id', key),
    put: (key: string, value: string, metadata?: any) =>
      cloudflareProxy.kvPut('gmail_history_id', key, value, metadata),
    delete: (key: string) => cloudflareProxy.kvDelete('gmail_history_id', key),
    list: (options?: any) => cloudflareProxy.kvList('gmail_history_id', options),
  },
  gmail_processing_threads: {
    get: (key: string) => cloudflareProxy.kvGet('gmail_processing_threads', key),
    put: (key: string, value: string, metadata?: any) =>
      cloudflareProxy.kvPut('gmail_processing_threads', key, value, metadata),
    delete: (key: string) => cloudflareProxy.kvDelete('gmail_processing_threads', key),
    list: (options?: any) => cloudflareProxy.kvList('gmail_processing_threads', options),
  },
  subscribed_accounts: {
    get: (key: string) => cloudflareProxy.kvGet('subscribed_accounts', key),
    put: (key: string, value: string, metadata?: any) =>
      cloudflareProxy.kvPut('subscribed_accounts', key, value, metadata),
    delete: (key: string) => cloudflareProxy.kvDelete('subscribed_accounts', key),
    list: (options?: any) => cloudflareProxy.kvList('subscribed_accounts', options),
  },
  connection_labels: {
    get: (key: string) => cloudflareProxy.kvGet('connection_labels', key),
    put: (key: string, value: string, metadata?: any) =>
      cloudflareProxy.kvPut('connection_labels', key, value, metadata),
    delete: (key: string) => cloudflareProxy.kvDelete('connection_labels', key),
    list: (options?: any) => cloudflareProxy.kvList('connection_labels', options),
  },
  prompts_storage: {
    get: (key: string) => cloudflareProxy.kvGet('prompts_storage', key),
    put: (key: string, value: string, metadata?: any) =>
      cloudflareProxy.kvPut('prompts_storage', key, value, metadata),
    delete: (key: string) => cloudflareProxy.kvDelete('prompts_storage', key),
    list: (options?: any) => cloudflareProxy.kvList('prompts_storage', options),
  },
  gmail_sub_age: {
    get: (key: string) => cloudflareProxy.kvGet('gmail_sub_age', key),
    put: (key: string, value: string, metadata?: any) =>
      cloudflareProxy.kvPut('gmail_sub_age', key, value, metadata),
    delete: (key: string) => cloudflareProxy.kvDelete('gmail_sub_age', key),
    list: (options?: any) => cloudflareProxy.kvList('gmail_sub_age', options),
  },
  snoozed_emails: {
    get: (key: string) => cloudflareProxy.kvGet('snoozed_emails', key),
    put: (key: string, value: string, metadata?: any) =>
      cloudflareProxy.kvPut('snoozed_emails', key, value, metadata),
    delete: (key: string) => cloudflareProxy.kvDelete('snoozed_emails', key),
    list: (options?: any) => cloudflareProxy.kvList('snoozed_emails', options),
  },
};

export const queues = {
  thread_queue: {
    send: (message: any) => cloudflareProxy.queueSend('thread_queue', message),
  },
  subscribe_queue: {
    send: (message: any) => cloudflareProxy.queueSend('subscribe_queue', message),
  },
};

export const r2Buckets = {
  THREADS_BUCKET: {
    get: (key: string) => cloudflareProxy.r2Get('THREADS_BUCKET', key),
    put: (key: string, value: any, metadata?: any) =>
      cloudflareProxy.r2Put('THREADS_BUCKET', key, value, metadata),
    delete: (key: string) => cloudflareProxy.r2Delete('THREADS_BUCKET', key),
  },
};
