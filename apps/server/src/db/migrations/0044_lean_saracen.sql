ALTER TABLE "mail0_invitation" RENAME COLUMN "organizationId" TO "organization_id";--> statement-breakpoint
ALTER TABLE "mail0_invitation" RENAME COLUMN "teamId" TO "team_id";--> statement-breakpoint
ALTER TABLE "mail0_invitation" RENAME COLUMN "expiresAt" TO "expires_at";--> statement-breakpoint
ALTER TABLE "mail0_invitation" RENAME COLUMN "inviterId" TO "inviter_id";--> statement-breakpoint
ALTER TABLE "mail0_member" RENAME COLUMN "organizationId" TO "organization_id";--> statement-breakpoint
ALTER TABLE "mail0_member" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "mail0_member" RENAME COLUMN "teamId" TO "team_id";--> statement-breakpoint
ALTER TABLE "mail0_member" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "mail0_team" RENAME COLUMN "organizationId" TO "organization_id";--> statement-breakpoint
ALTER TABLE "mail0_team" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "mail0_team" RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
ALTER TABLE "mail0_member" DROP CONSTRAINT "mail0_member_userId_organizationId_unique";--> statement-breakpoint
ALTER TABLE "mail0_invitation" DROP CONSTRAINT "mail0_invitation_inviterId_mail0_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_invitation" DROP CONSTRAINT "mail0_invitation_organizationId_mail0_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_member" DROP CONSTRAINT "mail0_member_userId_mail0_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_member" DROP CONSTRAINT "mail0_member_organizationId_mail0_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_member" DROP CONSTRAINT "mail0_member_teamId_mail0_team_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_team" DROP CONSTRAINT "mail0_team_organizationId_mail0_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_invitation" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mail0_invitation" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "mail0_invitation" ALTER COLUMN "role" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mail0_member" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mail0_member" ALTER COLUMN "role" SET DEFAULT 'member';--> statement-breakpoint
ALTER TABLE "mail0_organization" ALTER COLUMN "slug" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mail0_invitation" ADD CONSTRAINT "mail0_invitation_organization_id_mail0_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."mail0_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_invitation" ADD CONSTRAINT "mail0_invitation_inviter_id_mail0_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_member" ADD CONSTRAINT "mail0_member_organization_id_mail0_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."mail0_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_member" ADD CONSTRAINT "mail0_member_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_team" ADD CONSTRAINT "mail0_team_organization_id_mail0_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."mail0_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_invitation" DROP COLUMN "createdAt";--> statement-breakpoint
ALTER TABLE "mail0_user" DROP COLUMN "active_organization_id";