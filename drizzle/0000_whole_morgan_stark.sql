CREATE TYPE "public"."edition_status" AS ENUM('available', 'reserved', 'sold');--> statement-breakpoint
CREATE TYPE "public"."product_image_kind" AS ENUM('view', 'certificate', 'sticker');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"status" "edition_status" DEFAULT 'available' NOT NULL,
	"reserved_until" timestamp with time zone,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editions_variant_number_unique" UNIQUE("variant_id","number")
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"view_id" text NOT NULL,
	"label" text NOT NULL,
	"alt" text NOT NULL,
	"src" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"kind" "product_image_kind" DEFAULT 'view' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_product_view_unique" UNIQUE("product_id","view_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"display_name_1" text NOT NULL,
	"display_name_2" text NOT NULL,
	"eyebrow" text NOT NULL,
	"description" text NOT NULL,
	"meta_description" text NOT NULL,
	"limited_note" text NOT NULL,
	"price_cents" integer NOT NULL,
	"one_size" boolean DEFAULT true NOT NULL,
	"per_order_limit" integer DEFAULT 6 NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"cap_color" text,
	"details" jsonb,
	"fit" text,
	"limited_copy" text,
	"why" text,
	"authenticity_copy" text,
	"authenticity_facts" jsonb,
	"photo_dir" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"label" text NOT NULL,
	"price_cents" integer,
	"inventory_quantity" integer,
	"edition_size" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "editions" ADD CONSTRAINT "editions_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "editions_variant_status_idx" ON "editions" USING btree ("variant_id","status");