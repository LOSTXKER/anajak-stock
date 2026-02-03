-- Add orderRef field to movement_lines for tracking ERP order references
ALTER TABLE "movement_lines" ADD COLUMN "orderRef" TEXT;

-- Create index for efficient order-based queries
CREATE INDEX "movement_lines_orderRef_idx" ON "movement_lines"("orderRef");
