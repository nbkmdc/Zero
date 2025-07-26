import {
  pgTableCreator,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { defaultUserSettings } from '../lib/schemas';

export const createTable = pgTableCreator((name) => `mail0_${name}`);

export const user = createTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  defaultConnectionId: text('default_connection_id'),
  customPrompt: text('custom_prompt'),
  phoneNumber: text('phone_number').unique(),
  phoneNumberVerified: boolean('phone_number_verified'),
});

export const session = createTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('session_user_id_idx').on(t.userId),
    index('session_expires_at_idx').on(t.expiresAt),
  ],
);

export const account = createTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [
    index('account_user_id_idx').on(t.userId),
    index('account_provider_user_id_idx').on(t.providerId, t.userId),
    index('account_expires_at_idx').on(t.accessTokenExpiresAt),
  ],
);

export const userHotkeys = createTable(
  'user_hotkeys',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    shortcuts: jsonb('shortcuts').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [index('user_hotkeys_shortcuts_idx').on(t.shortcuts)],
);

export const verification = createTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    index('verification_identifier_idx').on(t.identifier),
    index('verification_expires_at_idx').on(t.expiresAt),
  ],
);

export const earlyAccess = createTable(
  'early_access',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    isEarlyAccess: boolean('is_early_access').notNull().default(false),
    hasUsedTicket: text('has_used_ticket').default(''),
  },
  (t) => [index('early_access_is_early_access_idx').on(t.isEarlyAccess)],
);

export const connection = createTable(
  'connection',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name'),
    picture: text('picture'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    scope: text('scope').notNull(),
    providerId: text('provider_id').$type<'google' | 'microsoft'>().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [
    unique().on(t.userId, t.email),
    index('connection_user_id_idx').on(t.userId),
    index('connection_expires_at_idx').on(t.expiresAt),
    index('connection_provider_id_idx').on(t.providerId),
  ],
);

export const summary = createTable(
  'summary',
  {
    messageId: text('message_id').primaryKey(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connection.id, { onDelete: 'cascade' }),
    saved: boolean('saved').notNull().default(false),
    tags: text('tags'),
    suggestedReply: text('suggested_reply'),
  },
  (t) => [
    index('summary_connection_id_idx').on(t.connectionId),
    index('summary_connection_id_saved_idx').on(t.connectionId, t.saved),
    index('summary_saved_idx').on(t.saved),
  ],
);

// Testing
export const note = createTable(
  'note',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    threadId: text('thread_id').notNull(),
    content: text('content').notNull(),
    color: text('color').notNull().default('default'),
    isPinned: boolean('is_pinned').default(false),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('note_user_id_idx').on(t.userId),
    index('note_thread_id_idx').on(t.threadId),
    index('note_user_thread_idx').on(t.userId, t.threadId),
    index('note_is_pinned_idx').on(t.isPinned),
  ],
);

export const userSettings = createTable(
  'user_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
      .unique(),
    settings: jsonb('settings').notNull().default(defaultUserSettings),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [index('user_settings_settings_idx').on(t.settings)],
);

export const writingStyleMatrix = createTable(
  'writing_style_matrix',
  {
    connectionId: text()
      .notNull()
      .references(() => connection.id, { onDelete: 'cascade' }),
    numMessages: integer().notNull(),
    // TODO: way too much pain to get this type to work,
    // revisit later
    style: jsonb().$type<unknown>().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return [
      primaryKey({
        columns: [table.connectionId],
      }),
      index('writing_style_matrix_style_idx').on(table.style),
    ];
  },
);

export const jwks = createTable(
  'jwks',
  {
    id: text('id').primaryKey(),
    publicKey: text('public_key').notNull(),
    privateKey: text('private_key').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => [index('jwks_created_at_idx').on(t.createdAt)],
);

export const oauthApplication = createTable(
  'oauth_application',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    icon: text('icon'),
    metadata: text('metadata'),
    clientId: text('client_id').unique(),
    clientSecret: text('client_secret'),
    redirectURLs: text('redirect_u_r_ls'),
    type: text('type'),
    disabled: boolean('disabled'),
    userId: text('user_id'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    index('oauth_application_user_id_idx').on(t.userId),
    index('oauth_application_disabled_idx').on(t.disabled),
  ],
);

export const oauthAccessToken = createTable(
  'oauth_access_token',
  {
    id: text('id').primaryKey(),
    accessToken: text('access_token').unique(),
    refreshToken: text('refresh_token').unique(),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    clientId: text('client_id'),
    userId: text('user_id'),
    scopes: text('scopes'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    index('oauth_access_token_user_id_idx').on(t.userId),
    index('oauth_access_token_client_id_idx').on(t.clientId),
    index('oauth_access_token_expires_at_idx').on(t.accessTokenExpiresAt),
  ],
);

export const oauthConsent = createTable(
  'oauth_consent',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id'),
    userId: text('user_id'),
    scopes: text('scopes'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
    consentGiven: boolean('consent_given'),
  },
  (t) => [
    index('oauth_consent_user_id_idx').on(t.userId),
    index('oauth_consent_client_id_idx').on(t.clientId),
    index('oauth_consent_given_idx').on(t.consentGiven),
  ],
);

// Historical Email Analysis Tables
export const emailAnalysis = createTable(
  'email_analysis',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connection.id, { onDelete: 'cascade' }),
    messageId: text('message_id').notNull(),
    threadId: text('thread_id').notNull(),
    subject: text('subject'),
    sender: text('sender'),
    receivedAt: timestamp('received_at'),
    importanceScore: text('importance_score').default('0.50'), // Using text for decimal precision
    category: text('category').default('normal'),
    tags: text('tags').array(),
    isSpam: boolean('is_spam').default(false),
    spamConfidence: text('spam_confidence').default('0.00'),
    reasoning: text('reasoning'),
    processedAt: timestamp('processed_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('email_analysis_connection_id_idx').on(t.connectionId),
    index('email_analysis_message_id_idx').on(t.messageId),
    index('email_analysis_category_idx').on(t.category),
    index('email_analysis_is_spam_idx').on(t.isSpam),
    index('email_analysis_importance_score_idx').on(t.importanceScore),
    index('email_analysis_received_at_idx').on(t.receivedAt),
    index('email_analysis_processed_at_idx').on(t.processedAt),
  ],
);

export const historicalAnalysisBatch = createTable(
  'historical_analysis_batch',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connection.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status').default('pending').notNull(), // pending, running, completed, failed, cancelled
    dateRangeStart: timestamp('date_range_start'),
    dateRangeEnd: timestamp('date_range_end'),
    totalEmails: integer('total_emails').default(0),
    processedEmails: integer('processed_emails').default(0),
    spamDetected: integer('spam_detected').default(0),
    importantFound: integer('important_found').default(0),
    processingStart: timestamp('processing_start'),
    processingEnd: timestamp('processing_end'),
    errorMessage: text('error_message'),
    settings: jsonb('settings'), // Store analysis settings/preferences
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('historical_batch_connection_id_idx').on(t.connectionId),
    index('historical_batch_user_id_idx').on(t.userId),
    index('historical_batch_status_idx').on(t.status),
    index('historical_batch_created_at_idx').on(t.createdAt),
  ],
);

export const emailPreferences = createTable(
  'email_preferences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
      .unique(),
    connectionId: text('connection_id').references(() => connection.id, { onDelete: 'cascade' }),
    importanceRules: jsonb('importance_rules').default('[]'), // Array of importance rules
    spamKeywords: text('spam_keywords').array().default([]),
    trustedSenders: text('trusted_senders').array().default([]),
    autoDeleteSpam: boolean('auto_delete_spam').default(false),
    autoArchiveOld: boolean('auto_archive_old').default(false),
    archiveDaysThreshold: integer('archive_days_threshold').default(365),
    batchSize: integer('batch_size').default(50),
    maxDailyProcessing: integer('max_daily_processing').default(1000),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('email_preferences_user_id_idx').on(t.userId),
    index('email_preferences_connection_id_idx').on(t.connectionId),
  ],
);
