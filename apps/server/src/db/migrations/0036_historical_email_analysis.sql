-- Historical Email Analysis Tables
-- These tables store analysis results for historical email processing

-- Table for storing email analysis results
CREATE TABLE "mail0_email_analysis" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"message_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"subject" text,
	"sender" text,
	"received_at" timestamp,
	"importance_score" numeric(3,2) DEFAULT 0.50,
	"category" text DEFAULT 'normal',
	"tags" text[], -- Array of string tags
	"is_spam" boolean DEFAULT false,
	"spam_confidence" numeric(3,2) DEFAULT 0.00,
	"reasoning" text,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_email_analysis_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action
);

-- Table for tracking historical analysis batches/jobs
CREATE TABLE "mail0_historical_analysis_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL, -- pending, running, completed, failed, cancelled
	"date_range_start" timestamp,
	"date_range_end" timestamp,
	"total_emails" integer DEFAULT 0,
	"processed_emails" integer DEFAULT 0,
	"spam_detected" integer DEFAULT 0,
	"important_found" integer DEFAULT 0,
	"processing_start" timestamp,
	"processing_end" timestamp,
	"error_message" text,
	"settings" jsonb, -- Store analysis settings/preferences
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_historical_analysis_batch_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "mail0_historical_analysis_batch_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action
);

-- Table for user preferences related to historical analysis
CREATE TABLE "mail0_email_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connection_id" text,
	"importance_rules" jsonb DEFAULT '[]'::jsonb, -- Array of importance rules
	"spam_keywords" text[] DEFAULT '{}', -- Array of spam keywords
	"trusted_senders" text[] DEFAULT '{}', -- Array of trusted sender domains/emails
	"auto_delete_spam" boolean DEFAULT false,
	"auto_archive_old" boolean DEFAULT false,
	"archive_days_threshold" integer DEFAULT 365,
	"batch_size" integer DEFAULT 50,
	"max_daily_processing" integer DEFAULT 1000,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_email_preferences_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "mail0_email_preferences_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "mail0_email_preferences_user_id_unique" UNIQUE("user_id")
);

-- Indexes for performance
CREATE INDEX "email_analysis_connection_id_idx" ON "mail0_email_analysis" USING btree ("connection_id");
CREATE INDEX "email_analysis_message_id_idx" ON "mail0_email_analysis" USING btree ("message_id");
CREATE INDEX "email_analysis_category_idx" ON "mail0_email_analysis" USING btree ("category");
CREATE INDEX "email_analysis_is_spam_idx" ON "mail0_email_analysis" USING btree ("is_spam");
CREATE INDEX "email_analysis_importance_score_idx" ON "mail0_email_analysis" USING btree ("importance_score");
CREATE INDEX "email_analysis_received_at_idx" ON "mail0_email_analysis" USING btree ("received_at");
CREATE INDEX "email_analysis_processed_at_idx" ON "mail0_email_analysis" USING btree ("processed_at");

CREATE INDEX "historical_batch_connection_id_idx" ON "mail0_historical_analysis_batch" USING btree ("connection_id");
CREATE INDEX "historical_batch_user_id_idx" ON "mail0_historical_analysis_batch" USING btree ("user_id");
CREATE INDEX "historical_batch_status_idx" ON "mail0_historical_analysis_batch" USING btree ("status");
CREATE INDEX "historical_batch_created_at_idx" ON "mail0_historical_analysis_batch" USING btree ("created_at");

CREATE INDEX "email_preferences_user_id_idx" ON "mail0_email_preferences" USING btree ("user_id");
CREATE INDEX "email_preferences_connection_id_idx" ON "mail0_email_preferences" USING btree ("connection_id");
