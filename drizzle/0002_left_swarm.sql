CREATE TYPE "public"."fulfilment" AS ENUM('ship', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'fulfilled', 'ready_for_pickup', 'picked_up', 'refunded', 'cancelled');--> statement-breakpoint
CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"sku" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"edition_number" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"fulfilment" "fulfilment" NOT NULL,
	"email" text,
	"name" text,
	"phone" text,
	"ship_to" jsonb,
	"subtotal_cents" integer NOT NULL,
	"shipping_cents" integer NOT NULL,
	"tax_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"carrier" text,
	"tracking_number" text,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "orders_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"store_name" text NOT NULL,
	"support_email" text NOT NULL,
	"pickup_enabled" boolean DEFAULT true NOT NULL,
	"pickup_address" text DEFAULT '5539 W. Sunset Blvd, Los Angeles, CA 90028' NOT NULL,
	"shipping_flat_cents" integer DEFAULT 600 NOT NULL,
	"shipping_free_over_cents" integer,
	"ship_countries" jsonb DEFAULT '["US"]'::jsonb NOT NULL,
	"returns_policy" text,
	"terms_text" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editions" ADD CONSTRAINT "editions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;