ALTER TABLE "products" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "products" AS p
SET "position" = ranked.rn - 1
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at") AS rn
  FROM "products"
) AS ranked
WHERE p."id" = ranked."id";
