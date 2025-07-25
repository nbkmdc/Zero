import { defaultLabels, EProviders } from '../../types';

import { connection } from '../../db/schema';

import { createDockerDB as createDb } from '../../db';
import { kvNamespaces } from '../../cf-proxy';
import { eq } from 'drizzle-orm';
import { env } from '../../env';

export interface SubscriptionData {
  connectionId?: string;
  silent?: boolean;
  force?: boolean;
}

export interface UnsubscriptionData {
  connectionId?: string;
  providerId?: EProviders;
}

export abstract class BaseSubscriptionFactory {
  abstract readonly providerId: EProviders;

  abstract subscribe(data: { body: SubscriptionData }): Promise<Response>;

  abstract unsubscribe(data: { body: UnsubscriptionData }): Promise<Response>;

  abstract verifyToken(token: string): Promise<boolean>;

  protected async getConnectionFromDb(connectionId: string) {
    // Revisit
    const { db, conn } = createDb(env.HYPERDRIVE_CONNECTION_STRING);
    const connectionData = await db.query.connection.findFirst({
      where: eq(connection.id, connectionId),
    });
    await conn.end();
    return connectionData;
  }

  protected async initializeConnectionLabels(connectionId: string): Promise<void> {
    const existingLabels = await kvNamespaces.connection_labels.get(connectionId);
    if (!existingLabels?.trim().length) {
      await kvNamespaces.connection_labels.put(connectionId, JSON.stringify(defaultLabels));
    }
  }
}
