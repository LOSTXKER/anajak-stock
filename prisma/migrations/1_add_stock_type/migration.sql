-- CreateEnum
CREATE TYPE "StockType" AS ENUM ('STOCKED', 'MADE_TO_ORDER', 'DROP_SHIP');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "stockType" "StockType" NOT NULL DEFAULT 'STOCKED';
