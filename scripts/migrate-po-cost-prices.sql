-- ============================================================
-- Migration: refresh DRAFT/REJECTED PO prices from product page
-- ============================================================
-- ทำอะไร:
--   1. อัปเดต po_lines."unitPrice" ของ PO ที่ status = DRAFT หรือ REJECTED
--      - ถ้ามี variantId  -> product_variants."costPrice"
--      - ถ้าไม่มี variantId -> products."standardCost"
--   2. รีคำนวณ pos.subtotal / pos."vatAmount" / pos.total ตาม vatType เดิมของ PO
-- ไม่แตะ PO ที่ status อื่น (SUBMITTED, APPROVED, SENT, IN_PROGRESS,
-- PARTIALLY_RECEIVED, FULLY_RECEIVED, CLOSED, CANCELLED) เพราะ
-- PO เหล่านั้นอาจมี GRN และผูกกับ audit/บัญชีไปแล้ว
--
-- วิธีใช้:
--   1) รัน "STEP 0: PREVIEW" ก่อน เพื่อดูว่าจะมีกี่ line ที่จะถูกแก้
--      และราคาเก่า/ใหม่ต่างกันเท่าไร
--   2) รัน "STEP 1+2: MIGRATION" ในบล็อก BEGIN ... COMMIT (มี ROLLBACK
--      ตัวอย่างไว้ ถ้าอยากทดสอบโดยไม่บันทึก)
--   3) รัน "STEP 3: VERIFY" หลังรันเสร็จเพื่อยืนยันยอดถูกต้อง
-- ============================================================


-- ============================================================
-- STEP 0: PREVIEW (read-only)
-- ============================================================
-- ดู line ที่ราคาจะเปลี่ยน + ความต่าง
SELECT
  po."poNumber",
  po.status,
  pl.id              AS line_id,
  p.sku              AS product_sku,
  p.name             AS product_name,
  pv.sku             AS variant_sku,
  pl.qty,
  pl."unitPrice"     AS old_unit_price,
  CASE
    WHEN pl."variantId" IS NOT NULL THEN COALESCE(pv."costPrice", 0)
    ELSE COALESCE(p."standardCost", 0)
  END                AS new_unit_price,
  CASE
    WHEN pl."variantId" IS NOT NULL THEN COALESCE(pv."costPrice", 0)
    ELSE COALESCE(p."standardCost", 0)
  END - pl."unitPrice" AS diff
FROM po_lines pl
JOIN pos po                ON po.id = pl."poId"
JOIN products p            ON p.id = pl."productId"
LEFT JOIN product_variants pv ON pv.id = pl."variantId"
WHERE po.status IN ('DRAFT', 'REJECTED')
  AND pl."unitPrice" <> CASE
        WHEN pl."variantId" IS NOT NULL THEN COALESCE(pv."costPrice", 0)
        ELSE COALESCE(p."standardCost", 0)
      END
ORDER BY po."createdAt" DESC, pl.id;

-- นับจำนวน line/PO ที่จะกระทบ
SELECT
  COUNT(*)                       AS lines_to_update,
  COUNT(DISTINCT pl."poId")      AS pos_to_update
FROM po_lines pl
JOIN pos po                ON po.id = pl."poId"
JOIN products p            ON p.id = pl."productId"
LEFT JOIN product_variants pv ON pv.id = pl."variantId"
WHERE po.status IN ('DRAFT', 'REJECTED')
  AND pl."unitPrice" <> CASE
        WHEN pl."variantId" IS NOT NULL THEN COALESCE(pv."costPrice", 0)
        ELSE COALESCE(p."standardCost", 0)
      END;


-- ============================================================
-- STEP 1+2: MIGRATION (transactional)
-- ============================================================
-- ถ้าต้องการลองโดยไม่บันทึก ให้เปลี่ยน COMMIT เป็น ROLLBACK
BEGIN;

-- 1a) อัปเดตราคาของ line ที่มี variant
UPDATE po_lines pl
SET "unitPrice" = COALESCE(pv."costPrice", 0)
FROM pos po, product_variants pv
WHERE po.id = pl."poId"
  AND po.status IN ('DRAFT', 'REJECTED')
  AND pl."variantId" IS NOT NULL
  AND pv.id = pl."variantId";

-- 1b) อัปเดตราคาของ line ที่ไม่มี variant
UPDATE po_lines pl
SET "unitPrice" = COALESCE(p."standardCost", 0)
FROM pos po, products p
WHERE po.id = pl."poId"
  AND po.status IN ('DRAFT', 'REJECTED')
  AND pl."variantId" IS NULL
  AND p.id = pl."productId";

-- 2) รีคำนวณ subtotal / vatAmount / total ตาม vatType ของ PO
WITH line_sums AS (
  SELECT pl."poId" AS po_id,
         COALESCE(SUM(pl.qty * pl."unitPrice"), 0) AS subtotal
  FROM po_lines pl
  GROUP BY pl."poId"
)
UPDATE pos po
SET
  subtotal     = ls.subtotal,
  "vatAmount"  = CASE po."vatType"
    WHEN 'EXCLUDED' THEN ls.subtotal *  (po."vatRate" / 100)
    WHEN 'INCLUDED' THEN ls.subtotal - (ls.subtotal / (1 + po."vatRate" / 100))
    ELSE 0
  END,
  total        = CASE po."vatType"
    WHEN 'EXCLUDED' THEN ls.subtotal + ls.subtotal * (po."vatRate" / 100)
    ELSE ls.subtotal   -- NO_VAT และ INCLUDED: total = subtotal (ตาม calculatePOTotals)
  END,
  "updatedAt"  = NOW()
FROM line_sums ls
WHERE po.id = ls.po_id
  AND po.status IN ('DRAFT', 'REJECTED');

-- เปลี่ยนเป็น ROLLBACK; เพื่อทดสอบโดยไม่บันทึก
COMMIT;


-- ============================================================
-- STEP 3: VERIFY (read-only)
-- ============================================================
-- 3a) เช็คว่าไม่มี line ใน DRAFT/REJECTED ที่ยังราคาไม่ตรง (ควร = 0 row)
SELECT
  po."poNumber",
  pl.id AS line_id,
  pl."unitPrice" AS current_price,
  CASE
    WHEN pl."variantId" IS NOT NULL THEN COALESCE(pv."costPrice", 0)
    ELSE COALESCE(p."standardCost", 0)
  END AS expected_price
FROM po_lines pl
JOIN pos po                ON po.id = pl."poId"
JOIN products p            ON p.id = pl."productId"
LEFT JOIN product_variants pv ON pv.id = pl."variantId"
WHERE po.status IN ('DRAFT', 'REJECTED')
  AND pl."unitPrice" <> CASE
        WHEN pl."variantId" IS NOT NULL THEN COALESCE(pv."costPrice", 0)
        ELSE COALESCE(p."standardCost", 0)
      END;

-- 3b) เช็ค PO totals ว่าตรงกับผลรวม line จริง
SELECT
  po."poNumber",
  po.status,
  po."vatType",
  po."vatRate",
  po.subtotal       AS stored_subtotal,
  po."vatAmount"    AS stored_vat,
  po.total          AS stored_total,
  agg.calc_subtotal,
  CASE po."vatType"
    WHEN 'EXCLUDED' THEN agg.calc_subtotal *  (po."vatRate" / 100)
    WHEN 'INCLUDED' THEN agg.calc_subtotal - (agg.calc_subtotal / (1 + po."vatRate" / 100))
    ELSE 0
  END               AS calc_vat,
  CASE po."vatType"
    WHEN 'EXCLUDED' THEN agg.calc_subtotal + agg.calc_subtotal * (po."vatRate" / 100)
    ELSE agg.calc_subtotal
  END               AS calc_total
FROM pos po
JOIN (
  SELECT "poId", COALESCE(SUM(qty * "unitPrice"), 0) AS calc_subtotal
  FROM po_lines
  GROUP BY "poId"
) agg ON agg."poId" = po.id
WHERE po.status IN ('DRAFT', 'REJECTED')
ORDER BY po."createdAt" DESC;
