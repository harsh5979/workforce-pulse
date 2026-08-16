CREATE TABLE IF NOT EXISTS "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" varchar(20) NOT NULL,
	"department" varchar(50),
	"timestamp_ist" timestamp with time zone NOT NULL,
	"week_number" integer NOT NULL,
	"app_used" varchar(100),
	"task_category" varchar(100),
	"duration_min" numeric(8, 2) NOT NULL,
	"is_repetitive" boolean NOT NULL,
	"raw_is_repetitive" varchar(30),
	"ingestion_flags" text[] DEFAULT '{}'::text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(50) NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_sessions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"title" varchar(200) DEFAULT 'New Conversation' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employees" (
	"employee_id" varchar(20) PRIMARY KEY NOT NULL,
	"full_name" varchar(100),
	"department" varchar(50),
	"role" varchar(100),
	"tenure_years" numeric(4, 1),
	"comp_annual_inr" numeric(14, 2),
	"comp_source" varchar(20),
	"working_hours_day" integer DEFAULT 8,
	"status" varchar(20) DEFAULT 'active',
	"terminated_on" date,
	"has_activity" boolean DEFAULT true,
	"has_metadata" boolean DEFAULT true,
	"raw_data" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingestion_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_at" timestamp DEFAULT now(),
	"rows_activity_raw" integer DEFAULT 0,
	"rows_activity_clean" integer DEFAULT 0,
	"rows_dropped" integer DEFAULT 0,
	"rows_fixed" integer DEFAULT 0,
	"rows_flagged" integer DEFAULT 0,
	"employees_no_meta" integer DEFAULT 0,
	"metadata_no_activity" integer DEFAULT 0,
	"duplicate_employees" integer DEFAULT 0,
	"notes" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
