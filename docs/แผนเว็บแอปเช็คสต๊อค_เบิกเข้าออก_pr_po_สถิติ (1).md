# แผนเว็บแอปเช็คสต๊อคสินค้า (Inventory + PR/PO + Statistics)

## 0) เป้าหมาย
- เช็คสต๊อคตามคลัง/โลเคชันได้ทันที
- คุมการเคลื่อนไหวสต๊อคด้วยระบบ “Movement Ledger” (รับเข้า/เบิกออก/โอนย้าย/ปรับยอด)
- ขอซื้อ (PR) → สั่งซื้อ (PO) → ติดตาม → รับเข้า (GRN) แบบครบวงจร
- มีสถิติให้เห็นของไหลเร็ว/จมทุน/ใกล้หมด/ซัพพลายเออร์ส่งช้า

---

## 1) ขอบเขตระบบ (Scope)
### 1.1 Must-have (MVP ใช้งานจริง)
1) สินค้า (SKU) + คลัง/โลเคชัน
2) สต๊อคคงเหลือแบบเรียลไทม์ (คำนวณจาก Movement)
3) เบิกออก/รับเข้า/โอนย้าย/ปรับยอด
4) PR (ใบขอซื้อ) + อนุมัติ
5) PO (ใบสั่งซื้อ) + สถานะติดตาม
6) รับเข้า (GRN) รองรับรับบางส่วน (Partial)
7) Dashboard + แจ้งเตือน (ใกล้หมด, PO ใกล้ถึงกำหนด)
8) สิทธิ์ผู้ใช้ (Roles) + Audit log

### 1.2 Nice-to-have (ทำหลัง MVP)
- สแกน QR/Barcode เบิก/รับเข้าแบบเร็ว
- Lot/Batch/Expiry (หมึก/เคมี)
- Auto-PR จาก Reorder Point
- Forecast การใช้ของ (Moving average)
- Export/Import CSV/Excel, ต่อบัญชี/ERP

---

## 2) ผู้ใช้งานและสิทธิ์ (Roles)
- **Admin**: ตั้งค่า, สิทธิ์, คลัง/โลเคชัน, หน่วย, หมวด
- **Inventory/Store**: รับเข้า, เบิกออก, โอนย้าย, ปรับยอด, ตรวจนับ
- **Requester**: ขอเบิก/ขอซื้อ (PR)
- **Approver**: อนุมัติ PR/PO/เบิกออก (ตามวงเงิน/แผนก)
- **Purchasing**: แปลง PR → PO, ติดตาม Supplier, ปิด PO
- **Manager/Viewer**: ดูรายงาน/สถิติอย่างเดียว

---

## 3) โมดูลระบบ
### 3.1 Master Data
- **Products (SKU)**: ชื่อ, หน่วย, หมวด, รูป, Barcode/QR, Reorder point, Min/Max, Cost (Standard/Last)
- **Warehouses / Locations**: คลัง, โซน, ชั้น, ช่อง
- **Suppliers**: ข้อมูลติดต่อ, เงื่อนไข, ประวัติราคา/Lead time

### 3.2 Stock Movement (หัวใจระบบ)
- ประเภท Movement: **Receive / Issue / Transfer / Adjust / Return**
- กติกา: **ห้ามแก้สต๊อคตรง ๆ** ทุกอย่างต้องผ่าน Movement
- ทุกเอกสารมี: สถานะ, ผู้ทำรายการ, ผู้อนุมัติ, ไฟล์แนบ, Audit log

### 3.3 Issue (เบิกออก)
- ฟิลด์หลัก: สินค้า, จำนวน, จากคลัง/โลเคชัน, เหตุผล/โปรเจกต์/ออเดอร์, ผู้ขอ, แนบรูป
- สถานะ: Draft → Submit → Approved → Posted (ตัดสต๊อค) → Closed
- นโยบาย: จะให้ติดลบหรือไม่ (แนะนำไม่ให้ติดลบ ยกเว้นสิทธิ์พิเศษ)

### 3.4 Receive / GRN (รับเข้า)
- รับจาก PO หรือรับทั่วไป
- รองรับรับบางส่วน, รับหลายรอบ
- บันทึกต้นทุนจริง (ต่อบรรทัด), ภาษี (ถ้าต้องการ)

### 3.5 PR (Purchase Requisition)
- ขอซื้อ: สินค้า/จำนวน/ต้องใช้เมื่อไหร่/เหตุผล
- สถานะ: Draft → Submit → Approved/Rejected → Converted to PO

### 3.6 PO (Purchase Order)
- PO: Supplier, ราคา, VAT/ไม่ VAT, เงื่อนไข, ETA
- สถานะ: Draft → Approved → Sent → In progress → Partially received → Fully received → Closed
- Timeline: บันทึกเลื่อนส่ง/โน้ตติดตาม

### 3.7 Reports & Dashboard
- สต๊อคใกล้หมด (Below ROP)
- มูลค่าสต๊อคคงเหลือ (ตามคลัง/หมวด)
- Top เบิกออก (รายวัน/สัปดาห์/เดือน)
- Dead stock (อายุสต๊อค)
- Supplier lead time เฉลี่ย (Order→Receive)
- PR→PO cycle time
- Stock accuracy (จากรอบตรวจนับ)

---

## 4) หน้าจอ (Screens / UX Flow)
1) **Dashboard**: การ์ดสรุป + แจ้งเตือน
2) **Products**: ค้นหา/กรอง/สแกน
3) **Stock by Warehouse/Location**: ตารางคงเหลือ + drill-down
4) **Quick Actions**: เบิกออก/รับเข้า/โอนย้าย/ปรับยอด
5) **PR**: สร้าง PR + Approve list
6) **PO**: สร้าง/อนุมัติ/ส่ง/ติดตาม + Receive (GRN)
7) **Movement Ledger**: ประวัติการเคลื่อนไหว + export
8) **Reports**: ตัวกรองช่วงเวลา/คลัง/หมวด/โปรเจกต์
9) **Settings**: คลัง, หน่วย, หมวด, ROP rules, Roles

---

## 5) โครงสร้างข้อมูล (Data Model + Prisma)
> ใช้ Prisma เป็นตัวคุม schema/migration ทั้งหมด

- **products**(id, sku, name, uom, category_id, barcode, reorder_point, min_qty, max_qty, standard_cost, active)
- **warehouses**(id, name)
- **locations**(id, warehouse_id, code, name)
- **stock_balances**(product_id, location_id, qty_on_hand) *(cache/materialized)*
- **stock_movements**(id, type, ref_type, ref_id, status, created_by, approved_by, posted_at)
- **movement_lines**(id, movement_id, product_id, from_location_id, to_location_id, qty, unit_cost)
- **suppliers**(id, name, phone, email, terms)
- **prs**(id, requester_id, need_by, status, note)
- **pr_lines**(id, pr_id, product_id, qty, note)
- **pos**(id, supplier_id, status, eta, vat_type, total)
- **po_lines**(id, po_id, product_id, qty, unit_price)
- **grns**(id, po_id, status, received_at)
- **grn_lines**(id, grn_id, po_line_id, product_id, qty_received, unit_cost)
- **attachments**(id, ref_type, ref_id, url)
- **audit_logs**(id, actor_id, action, ref_type, ref_id, meta, created_at)
- **users / roles / role_permissions** (หรือใช้ auth ภายนอกแล้วเก็บ role ใน DB)

**หมายเหตุ Prisma ที่ควรทำ**
- ใส่ index สำคัญ: `(product_id, location_id)` ใน `stock_balances` และ `movement_lines`
- ใส่ enum `MovementType`, `DocStatus`
- ทำ soft delete (`deletedAt`) กับ master data ที่ไม่อยากให้หาย

---

## 6) กติกาและมาตรฐาน (Business Rules)
- ยอดคงเหลือจริง = ผลรวม Movement ที่ **Posted** แล้ว (Ledger)
- มี `stock_balances` เป็น **cache** เพื่อให้หน้าเช็คสต๊อคเร็ว และอัปเดตทุกครั้งที่ post
- เอกสารทุกชนิดมีสถานะและประวัติการเปลี่ยนสถานะ (Audit)
- การอนุมัติ: ใช้ rule ตาม role/วงเงิน/แผนก
- ห้ามลบเอกสารที่ Posted แล้ว (ทำ Reverse/Adjust แทน)
- รองรับ Partial receive และ Partial close
- **Transaction บังคับ** ตอน Post เอกสาร (Prisma `$transaction`) เพื่อกันยอดเพี้ยน:
  - สร้าง movement + lines
  - อัปเดต stock_balances
  - เขียน audit_logs

---

## 7) Roadmap (แผนทำงานแบบ Prisma-first)
### Phase 1: MVP (2–4 สัปดาห์)
- Setup โปรเจกต์ Next.js + Prisma + Postgres
- ออกแบบ Prisma schema + migrate + seed (Products/Warehouses/Locations)
- Master: Products, Warehouses, Locations
- Movement: Issue/Receive/Transfer/Adjust (Draft→Approve→Post)
- Implement การ Post ด้วย Prisma `$transaction()` (movement + lines + update balances + audit)
- PR + Approve
- PO + Approve + Status + GRN (Partial)
- Dashboard แจ้งเตือน: ใกล้หมด + PO ใกล้ถึงกำหนด

### Phase 2: Report & Productivity (2–3 สัปดาห์)
- Reports: Top issue, stock value, dead stock
- Supplier performance: lead time
- Movement ledger export
- UI Quick actions + Search/Filter ดี ๆ

### Phase 3: Automation & Integrations (3–6 สัปดาห์)
- Barcode/QR scan
- Auto-PR จาก ROP
- Forecast
- Import/Export Excel + ต่อ ERP/บัญชี

---

## 8) เทคโนโลยีแนะนำ (Prisma-first)
- **Frontend**: Next.js + Tailwind
- **Backend**: Next.js Route Handlers / Server Actions (หรือแยก NestJS ทีหลังได้)
- **Database**: PostgreSQL
- **ORM/Migrations**: **Prisma** (schema + migrate + seed + type-safe query)
- **Auth**: NextAuth / Clerk / Supabase Auth (เลือกอย่างใดอย่างหนึ่ง)
- **Storage**: S3 หรือ Supabase Storage (แนบรูป/ไฟล์)
- **Realtime (optional)**: Pusher/Ably หรือ Supabase Realtime
- **Reporting**: Postgres views/materialized views + Prisma query

> แนวคิดหลัก: **Movement Ledger เป็น source of truth** และมี `stock_balances` เป็น cache เพื่อความเร็ว

---

## 9) สิ่งที่ต้องเตรียมก่อนเริ่ม (Checklist)
- รายชื่อคลัง/โลเคชันจริงที่ใช้งาน
- รายชื่อสินค้า (SKU) + หน่วยนับ + หมวด
- กฎการอนุมัติ (ใครอนุมัติอะไร)
- ต้องการให้สต๊อคติดลบได้ไหม
- รูปแบบ VAT/ไม่ VAT สำหรับ PO (ถ้าใช้)

---

## 10) ผลลัพธ์ที่ได้
- เช็คสต๊อคเร็วขึ้น + ลดของหาย/เบิกมั่ว
- รู้ของใกล้หมดก่อนงานสะดุด
- PR/PO ไม่หลง ไม่ต้องไล่ตามในแชท
- มีสถิติให้ตัดสินใจซื้อและลดจมทุนได้จริง

