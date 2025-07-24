CREATE TABLE "mail0_domain" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"domain" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verification_token" text,
	"ses_identity_arn" text,
	"dkim_tokens" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_domain_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "mail0_domain_account" (
	"id" text PRIMARY KEY NOT NULL,
	"domain_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_domain_account_domain_id_email_unique" UNIQUE("domain_id","email")
);
--> statement-breakpoint
ALTER TABLE "mail0_domain" ADD CONSTRAINT "mail0_domain_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_domain_account" ADD CONSTRAINT "mail0_domain_account_domain_id_mail0_domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."mail0_domain"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "domain_user_id_idx" ON "mail0_domain" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "domain_verified_idx" ON "mail0_domain" USING btree ("verified");--> statement-breakpoint
CREATE INDEX "domain_account_domain_id_idx" ON "mail0_domain_account" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "domain_account_active_idx" ON "mail0_domain_account" USING btree ("active");