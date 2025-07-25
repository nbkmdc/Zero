import {
  type EmailMatrix,
  createUpdatedMatrixFromNewEmail,
  type WritingStyleMatrix,
  initializeStyleMatrixFromEmail,
} from '../services/writing-style-service';
import {
  user,
  connection,
  note,
  account,
  session,
  userSettings,
  userHotkeys,
  writingStyleMatrix,
} from '../db/schema';
import { type Conn, type DB, createDockerDB as createDb } from '../db';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import type { defaultUserSettings } from './schemas';
import type { EProviders } from '../types';
import { env } from '../env';

export class ZeroDB {
  private userId: string;
  private conn: Conn;
  private db: DB;

  async runThenTerminate(cb: PromiseLike<any>) {
    const response = await cb;
    // await this.terminate();
    return response;
  }

  constructor(userId: string) {
    const { db, conn } = createDb(env.HYPERDRIVE_CONNECTION_STRING);
    this.db = db;
    this.conn = conn;
    this.userId = userId;
  }

  terminate() {
    return this.conn.end();
  }

  async findUser(): Promise<typeof user.$inferSelect | undefined> {
    return this.runThenTerminate(
      this.db.query.user.findFirst({
        where: eq(user.id, this.userId),
      }),
    );
  }

  async findUserConnection(
    connectionId: string,
  ): Promise<typeof connection.$inferSelect | undefined> {
    return await this.db.query.connection.findFirst({
      where: and(eq(connection.userId, this.userId), eq(connection.id, connectionId)),
    });
  }

  async updateUser(data: Partial<typeof user.$inferInsert>) {
    return await this.db.update(user).set(data).where(eq(user.id, this.userId));
  }

  async deleteConnection(connectionId: string) {
    const connections = await this.findManyConnections();
    if (connections.length <= 1) {
      throw new Error('Cannot delete the last connection. At least one connection is required.');
    }
    return await this.db
      .delete(connection)
      .where(and(eq(connection.id, connectionId), eq(connection.userId, this.userId)));
  }

  async findFirstConnection(): Promise<typeof connection.$inferSelect | undefined> {
    return await this.db.query.connection.findFirst({
      where: eq(connection.userId, this.userId),
    });
  }

  async findManyConnections(): Promise<(typeof connection.$inferSelect)[]> {
    return await this.db.query.connection.findMany({
      where: eq(connection.userId, this.userId),
    });
  }

  async findManyNotesByThreadId(threadId: string): Promise<(typeof note.$inferSelect)[]> {
    return await this.db.query.note.findMany({
      where: and(eq(note.userId, this.userId), eq(note.threadId, threadId)),
      orderBy: [desc(note.isPinned), asc(note.order), desc(note.createdAt)],
    });
  }

  async createNote(payload: typeof note.$inferInsert) {
    return await this.db
      .insert(note)
      .values({
        ...payload,
        userId: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
  }

  async updateNote(
    noteId: string,
    payload: Partial<typeof note.$inferInsert>,
  ): Promise<typeof note.$inferSelect | undefined> {
    const [updated] = await this.db
      .update(note)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(and(eq(note.id, noteId), eq(note.userId, this.userId)))
      .returning();
    return updated;
  }

  async updateManyNotes(
    notes: { id: string; order: number; isPinned?: boolean | null }[],
  ): Promise<boolean> {
    return await this.db.transaction(async (tx) => {
      for (const n of notes) {
        const updateData: Record<string, unknown> = {
          order: n.order,
          updatedAt: new Date(),
        };

        if (n.isPinned !== undefined) {
          updateData.isPinned = n.isPinned;
        }
        await tx
          .update(note)
          .set(updateData)
          .where(and(eq(note.id, n.id), eq(note.userId, this.userId)));
      }
      return true;
    });
  }

  async findManyNotesByIds(noteIds: string[]): Promise<(typeof note.$inferSelect)[]> {
    return await this.db.query.note.findMany({
      where: and(eq(note.userId, this.userId), inArray(note.id, noteIds)),
    });
  }

  async deleteNote(noteId: string) {
    return await this.db.delete(note).where(and(eq(note.id, noteId), eq(note.userId, this.userId)));
  }

  async findNoteById(noteId: string): Promise<typeof note.$inferSelect | undefined> {
    return await this.db.query.note.findFirst({
      where: and(eq(note.id, noteId), eq(note.userId, this.userId)),
    });
  }

  async findHighestNoteOrder(): Promise<{ order: number } | undefined> {
    return await this.db.query.note.findFirst({
      where: eq(note.userId, this.userId),
      orderBy: desc(note.order),
      columns: { order: true },
    });
  }

  async deleteUser() {
    return await this.db.transaction(async (tx) => {
      await tx.delete(connection).where(eq(connection.userId, this.userId));
      await tx.delete(account).where(eq(account.userId, this.userId));
      await tx.delete(session).where(eq(session.userId, this.userId));
      await tx.delete(userSettings).where(eq(userSettings.userId, this.userId));
      await tx.delete(user).where(eq(user.id, this.userId));
      await tx.delete(userHotkeys).where(eq(userHotkeys.userId, this.userId));
    });
  }

  async findUserSettings(): Promise<typeof userSettings.$inferSelect | undefined> {
    return await this.db.query.userSettings.findFirst({
      where: eq(userSettings.userId, this.userId),
    });
  }

  async findUserHotkeys(): Promise<(typeof userHotkeys.$inferSelect)[]> {
    return await this.db.query.userHotkeys.findMany({
      where: eq(userHotkeys.userId, this.userId),
    });
  }

  async insertUserHotkeys(shortcuts: (typeof userHotkeys.$inferInsert)[]) {
    return await this.db
      .insert(userHotkeys)
      .values({
        userId: this.userId,
        shortcuts,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userHotkeys.userId,
        set: {
          shortcuts,
          updatedAt: new Date(),
        },
      });
  }

  async insertUserSettings(settings: typeof defaultUserSettings) {
    return await this.db.insert(userSettings).values({
      id: crypto.randomUUID(),
      userId: this.userId,
      settings,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async updateUserSettings(settings: typeof defaultUserSettings) {
    return await this.db
      .insert(userSettings)
      .values({
        id: crypto.randomUUID(),
        userId: this.userId,
        settings,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          settings,
          updatedAt: new Date(),
        },
      });
  }

  async createConnection(
    providerId: EProviders,
    email: string,
    updatingInfo: {
      expiresAt: Date;
      scope: string;
    },
  ): Promise<{ id: string }[]> {
    return await this.db
      .insert(connection)
      .values({
        ...updatingInfo,
        providerId,
        id: crypto.randomUUID(),
        email,
        userId: this.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [connection.email, connection.userId],
        set: {
          ...updatingInfo,
          updatedAt: new Date(),
        },
      })
      .returning({ id: connection.id });
  }

  /**
   * @param connectionId Dangerous, use findUserConnection instead
   * @returns
   */
  async findConnectionById(
    connectionId: string,
  ): Promise<typeof connection.$inferSelect | undefined> {
    return await this.db.query.connection.findFirst({
      where: eq(connection.id, connectionId),
    });
  }

  async syncUserMatrix(connectionId: string, emailStyleMatrix: EmailMatrix) {
    await this.db.transaction(async (tx) => {
      const [existingMatrix] = await tx
        .select({
          numMessages: writingStyleMatrix.numMessages,
          style: writingStyleMatrix.style,
        })
        .from(writingStyleMatrix)
        .where(eq(writingStyleMatrix.connectionId, connectionId));

      if (existingMatrix) {
        const newStyle = createUpdatedMatrixFromNewEmail(
          existingMatrix.numMessages,
          existingMatrix.style as WritingStyleMatrix,
          emailStyleMatrix,
        );

        await tx
          .update(writingStyleMatrix)
          .set({
            numMessages: existingMatrix.numMessages + 1,
            style: newStyle,
          })
          .where(eq(writingStyleMatrix.connectionId, connectionId));
      } else {
        const newStyle = initializeStyleMatrixFromEmail(emailStyleMatrix);

        await tx
          .insert(writingStyleMatrix)
          .values({
            connectionId,
            numMessages: 1,
            style: newStyle,
          })
          .onConflictDoNothing();
      }
    });
  }

  async findWritingStyleMatrix(
    connectionId: string,
  ): Promise<typeof writingStyleMatrix.$inferSelect | undefined> {
    return await this.db.query.writingStyleMatrix.findFirst({
      where: eq(writingStyleMatrix.connectionId, connectionId),
      columns: {
        numMessages: true,
        style: true,
        updatedAt: true,
        connectionId: true,
      },
    });
  }

  async deleteActiveConnection(connectionId: string) {
    return await this.db
      .delete(connection)
      .where(and(eq(connection.userId, this.userId), eq(connection.id, connectionId)));
  }

  async updateConnection(
    connectionId: string,
    updatingInfo: Partial<typeof connection.$inferInsert>,
  ) {
    return await this.db
      .update(connection)
      .set(updatingInfo)
      .where(eq(connection.id, connectionId));
  }
}
