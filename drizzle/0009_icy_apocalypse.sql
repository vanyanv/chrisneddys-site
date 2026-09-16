ALTER TABLE "store_settings" ADD COLUMN "shop_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "pause_note" text;