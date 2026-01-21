-- AlterTable: Add stockType to product_variants
ALTER TABLE "product_variants" ADD COLUMN "stockType" "StockType" NOT NULL DEFAULT 'STOCKED';
