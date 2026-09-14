CREATE TABLE "sign_in_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"ip" text NOT NULL,
	"succeeded" boolean NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sign_in_attempts_email_attempted_at_idx" ON "sign_in_attempts" USING btree ("email","attempted_at");--> statement-breakpoint
CREATE INDEX "sign_in_attempts_ip_attempted_at_idx" ON "sign_in_attempts" USING btree ("ip","attempted_at");