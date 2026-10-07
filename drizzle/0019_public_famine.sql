CREATE TYPE "public"."closing_item_kind" AS ENUM('check', 'temp');--> statement-breakpoint
CREATE TABLE "closing_check_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_id" uuid NOT NULL,
	"item_id" uuid,
	"section" text NOT NULL,
	"label" text NOT NULL,
	"label_es" text,
	"kind" "closing_item_kind" DEFAULT 'check' NOT NULL,
	"max_value" integer,
	"value" text,
	"done" boolean NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closing_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store" text NOT NULL,
	"business_date" date NOT NULL,
	"crew_id" uuid,
	"crew_name" text NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "closing_checks_store_night_unique" UNIQUE("store","business_date")
);
--> statement-breakpoint
CREATE TABLE "closing_crew" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "closing_crew_store_code_unique" UNIQUE("store","code")
);
--> statement-breakpoint
CREATE TABLE "closing_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store" text NOT NULL,
	"section" text NOT NULL,
	"label" text NOT NULL,
	"label_es" text,
	"detail" text,
	"detail_es" text,
	"kind" "closing_item_kind" DEFAULT 'check' NOT NULL,
	"max_value" integer,
	"position" integer NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closing_stores" (
	"store" text PRIMARY KEY NOT NULL,
	"link_token" text NOT NULL,
	"opens_before_min" integer DEFAULT 30 NOT NULL,
	"grace_min" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "closing_stores_link_token_unique" UNIQUE("link_token")
);
--> statement-breakpoint
ALTER TABLE "closing_check_items" ADD CONSTRAINT "closing_check_items_check_id_closing_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."closing_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_check_items" ADD CONSTRAINT "closing_check_items_item_id_closing_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."closing_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_checks" ADD CONSTRAINT "closing_checks_crew_id_closing_crew_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."closing_crew"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "closing_items_store_live_position_idx" ON "closing_items" USING btree ("store","retired_at","position");