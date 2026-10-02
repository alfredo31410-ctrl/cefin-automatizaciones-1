CREATE TYPE "public"."automation_status" AS ENUM('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ERROR', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."automation_type" AS ENUM('PREVENTA', 'VENTA', 'RETARGETING', 'CALENTAMIENTO');--> statement-breakpoint
CREATE TYPE "public"."trigger_status" AS ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."user_line_role" AS ENUM('ADMIN', 'OPERATOR', 'VIEWER');--> statement-breakpoint
CREATE TABLE "automation_groups" (
	"automation_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_groups_pk" PRIMARY KEY("automation_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_id" uuid NOT NULL,
	"name" varchar(240) NOT NULL,
	"type" "automation_type" NOT NULL,
	"status" "automation_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid,
	"activated_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"resume_status" "automation_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automations_id_line_id_unique" UNIQUE("id","line_id"),
	CONSTRAINT "automations_name_not_blank" CHECK (length(trim("automations"."name")) > 0),
	CONSTRAINT "automations_resume_status_valid" CHECK ("automations"."resume_status" is null or "automations"."resume_status" in ('ACTIVE', 'SCHEDULED'))
);
--> statement-breakpoint
CREATE TABLE "event_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_id" uuid NOT NULL,
	"automation_id" uuid,
	"user_id" uuid,
	"event" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"external_id" varchar(255),
	"member_count" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_id_line_id_unique" UNIQUE("id","line_id"),
	CONSTRAINT "groups_name_not_blank" CHECK (length(trim("groups"."name")) > 0),
	CONSTRAINT "groups_member_count_non_negative" CHECK ("groups"."member_count" is null or "groups"."member_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lines_slug_unique" UNIQUE("slug"),
	CONSTRAINT "lines_name_not_blank" CHECK (length(trim("lines"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" uuid NOT NULL,
	"content" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "trigger_status" DEFAULT 'PENDING' NOT NULL,
	"attachment_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "triggers_content_not_blank" CHECK (length(trim("triggers"."content")) > 0)
);
--> statement-breakpoint
CREATE TABLE "user_lines" (
	"user_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"role" "user_line_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_lines_pk" PRIMARY KEY("user_id","line_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(160) NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_not_blank" CHECK (length(trim("users"."email")) > 3)
);
--> statement-breakpoint
ALTER TABLE "automation_groups" ADD CONSTRAINT "automation_groups_automation_line_fk" FOREIGN KEY ("automation_id","line_id") REFERENCES "public"."automations"("id","line_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_groups" ADD CONSTRAINT "automation_groups_group_line_fk" FOREIGN KEY ("group_id","line_id") REFERENCES "public"."groups"("id","line_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_automation_line_fk" FOREIGN KEY ("automation_id","line_id") REFERENCES "public"."automations"("id","line_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lines" ADD CONSTRAINT "user_lines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lines" ADD CONSTRAINT "user_lines_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_groups_group_id_idx" ON "automation_groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "automation_groups_line_id_idx" ON "automation_groups" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "automations_line_id_idx" ON "automations" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "automations_status_idx" ON "automations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "automations_line_status_idx" ON "automations" USING btree ("line_id","status");--> statement-breakpoint
CREATE INDEX "event_logs_line_id_idx" ON "event_logs" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "event_logs_created_at_idx" ON "event_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "event_logs_line_created_at_idx" ON "event_logs" USING btree ("line_id","created_at");--> statement-breakpoint
CREATE INDEX "groups_line_id_idx" ON "groups" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "triggers_automation_id_idx" ON "triggers" USING btree ("automation_id");--> statement-breakpoint
CREATE INDEX "triggers_status_idx" ON "triggers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "triggers_scheduled_at_idx" ON "triggers" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "triggers_pending_schedule_idx" ON "triggers" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "user_lines_line_id_idx" ON "user_lines" USING btree ("line_id");