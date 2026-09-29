CREATE TYPE "public"."catering_fulfilment" AS ENUM('pickup', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."catering_order_status" AS ENUM('draft', 'requested', 'booked', 'declined', 'expired', 'cancelled', 'completed');--> statement-breakpoint
CREATE SEQUENCE "public"."catering_order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE TABLE "catering_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"actor" text NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "catering_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"item_id" text NOT NULL,
	"item_name" text NOT NULL,
	"qty" integer NOT NULL,
	"way_id" text,
	"way_label" text,
	"toppings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"topping_labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extras" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extra_labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unit_cents" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"for_name" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catering_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"token" text NOT NULL,
	"status" "catering_order_status" DEFAULT 'draft' NOT NULL,
	"store" text NOT NULL,
	"fulfilment" "catering_fulfilment" NOT NULL,
	"event_at" timestamp with time zone NOT NULL,
	"headcount" integer NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"company" text,
	"po_number" text,
	"onsite_contact_name" text,
	"onsite_contact_phone" text,
	"address" jsonb,
	"distance_miles" numeric(5, 1),
	"range_unknown" boolean DEFAULT false NOT NULL,
	"plate_sets" integer DEFAULT 0 NOT NULL,
	"food_cents" integer NOT NULL,
	"delivery_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer NOT NULL,
	"tip_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_customer_id" text,
	"stripe_payment_method_id" text,
	"requested_at" timestamp with time zone,
	"respond_by" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"decline_reason" text,
	"cancelled_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"customer_note" text,
	"owner_note" text,
	"pending_change" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catering_orders_number_unique" UNIQUE("number"),
	CONSTRAINT "catering_orders_token_unique" UNIQUE("token"),
	CONSTRAINT "catering_orders_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
CREATE TABLE "catering_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"ordering_on" boolean DEFAULT false NOT NULL,
	"hours" jsonb DEFAULT '{"hollywood":{"0":[{"open":"10:00","close":"20:00"}],"1":[{"open":"10:00","close":"20:00"}],"2":[{"open":"10:00","close":"20:00"}],"3":[{"open":"10:00","close":"20:00"}],"4":[{"open":"10:00","close":"20:00"}],"5":[{"open":"10:00","close":"20:00"}],"6":[{"open":"10:00","close":"20:00"}]},"vannuys":{"0":[{"open":"10:00","close":"20:00"}],"1":[{"open":"10:00","close":"20:00"}],"2":[{"open":"10:00","close":"20:00"}],"3":[{"open":"10:00","close":"20:00"}],"4":[{"open":"10:00","close":"20:00"}],"5":[{"open":"10:00","close":"20:00"}],"6":[{"open":"10:00","close":"20:00"}]}}'::jsonb NOT NULL,
	"days_off" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"delivery_fee_cents" integer DEFAULT 2500 NOT NULL,
	"range_miles" integer DEFAULT 10 NOT NULL,
	"reply_hours" integer DEFAULT 24 NOT NULL,
	"lead_hours" integer DEFAULT 48 NOT NULL,
	"big_lead_hours" integer DEFAULT 72 NOT NULL,
	"big_headcount" integer DEFAULT 50 NOT NULL,
	"owner_email" text DEFAULT 'chris@chrisneddys.com' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catering_events" ADD CONSTRAINT "catering_events_order_id_catering_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."catering_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catering_order_items" ADD CONSTRAINT "catering_order_items_order_id_catering_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."catering_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catering_events_order_id_idx" ON "catering_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "catering_order_items_order_id_idx" ON "catering_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "catering_orders_status_idx" ON "catering_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "catering_orders_event_at_idx" ON "catering_orders" USING btree ("event_at");--> statement-breakpoint
CREATE INDEX "catering_orders_email_idx" ON "catering_orders" USING btree ("contact_email");