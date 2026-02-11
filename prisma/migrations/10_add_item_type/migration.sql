-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('FINISHED_GOOD', 'RAW_MATERIAL', 'CONSUMABLE');

-- AlterTable: Add item_type column with default
ALTER TABLE "products" ADD COLUMN "item_type" "ItemType" NOT NULL DEFAULT 'FINISHED_GOOD';

-- Backfill: Set item_type based on existing category names
UPDATE "products" SET "item_type" = 'RAW_MATERIAL'
  FROM "categories" WHERE "products"."categoryId" = "categories"."id" AND "categories"."name" = 'วัตถุดิบ';

UPDATE "products" SET "item_type" = 'CONSUMABLE'
  FROM "categories" WHERE "products"."categoryId" = "categories"."id" AND "categories"."name" = 'อุปกรณ์';

-- CreateIndex
CREATE INDEX "products_item_type_active_idx" ON "products"("item_type", "active");
