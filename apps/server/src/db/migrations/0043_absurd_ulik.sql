ALTER TABLE "mail0_user" DROP CONSTRAINT "mail0_user_default_organization_id_mail0_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "mail0_user" DROP COLUMN "default_organization_id";