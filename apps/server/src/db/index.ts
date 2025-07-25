import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { Pool } from 'pg';

const createDrizzle = (conn: Pool) => drizzle({ client: conn, schema });

const createConn = (url: string) =>
  new Pool({
    connectionString: url,
  });

const createDb = (url: string) => {
  const conn = createConn(url);
  const db = createDrizzle(conn);
  return { db, conn };
};

/**
 * To be used in Wrangler runtime, in Durable Objects specifically
 * @param url
 * @returns
 */
export const createWranglerDB = (url: string) => createDb(url);

/**
 * To be used in Docker image, to connect to the database.
 * @param url
 * @returns
 */
export const createDockerDB = (url: string) => createDb(url);

export type DB = ReturnType<typeof createDrizzle>;
export type Conn = ReturnType<typeof createConn>;
