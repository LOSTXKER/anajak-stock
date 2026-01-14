# 🏢 Anajak Suite - Business Management Platform for Thai SMEs

> ระบบจัดการธุรกิจครบวงจรสำหรับ SME ไทย

---

## 📋 สารบัญ

1. [วิสัยทัศน์และพันธกิจ](#วิสัยทัศน์และพันธกิจ)
2. [Product Model: แบบ Google / Adobe](#product-model-แบบ-google--adobe)
3. [ภาพรวมผลิตภัณฑ์](#ภาพรวมผลิตภัณฑ์)
4. [สถาปัตยกรรมระบบ](#สถาปัตยกรรมระบบ)
5. [รายละเอียดแต่ละ App](#รายละเอียดแต่ละ-app)
6. [Technology Stack](#technology-stack)
7. [Roadmap](#roadmap)
8. [Business Model](#business-model)
9. [การแข่งขัน](#การแข่งขัน)

---

## 🎯 วิสัยทัศน์และพันธกิจ

### Vision
> "ทำให้ทุก SME ไทยเข้าถึงระบบจัดการธุรกิจระดับมืออาชีพ ในราคาที่จับต้องได้"

### Mission
- สร้างระบบที่ใช้งานง่าย ไม่ต้องเป็น IT ก็ใช้ได้
- ราคาเหมาะสมกับ SME (ไม่ใช่ Enterprise pricing)
- ออกแบบสำหรับบริบทธุรกิจไทย (ภาษาไทย, ภาษี, กฎหมาย)
- เชื่อมต่อกับระบบที่ SME ใช้อยู่ (PEAK, Line, Shopee, Lazada)

### Target Users
- ธุรกิจ SME ขนาด 1-50 คน
- ร้านค้าออนไลน์ / Reseller
- ธุรกิจค้าส่ง / ค้าปลีก
- ธุรกิจบริการ
- Startup ขนาดเล็ก

---

## 🧩 Product Model: แบบ Google / Adobe

### แนวคิด: Suite of Independent Apps

Anajak Suite ใช้โมเดลเดียวกับ **Google Workspace** และ **Adobe Creative Cloud**:

```
┌─────────────────────────────────────────────────────────────────┐
│                         GOOGLE                                   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │ Gmail  │ │ Drive  │ │  Docs  │ │ Sheets │ │  Meet  │ ...    │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │
│                    ↓ Google Account (SSO) ↓                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         ADOBE                                    │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │Photoshop│ │Illustr│ │Premiere│ │  XD    │ │Lightroom│ ...   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │
│                    ↓ Adobe ID (SSO) ↓                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      ANAJAK SUITE                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │ Stock  │ │ Sales  │ │  HRM   │ │  Chat  │ │  POS   │ ...    │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │
│                    ↓ Anajak ID (SSO) ↓                           │
└─────────────────────────────────────────────────────────────────┘
```

### หลักการสำคัญ

| หลักการ | รายละเอียด | ตัวอย่าง |
|---------|------------|---------|
| **🔐 Single Sign-On (SSO)** | เข้าสู่ระบบครั้งเดียว ใช้ได้ทุก App | Anajak ID |
| **📦 Independent Apps** | แต่ละ App ทำงานเดี่ยวได้ ไม่ต้องพึ่งพา App อื่น | Stock ใช้ได้เดี่ยวๆ |
| **🔗 Seamless Integration** | Apps เชื่อมต่อกันได้อย่างราบรื่น | Sales ดึงสินค้าจาก Stock |
| **🛒 Flexible Purchasing** | ซื้อแยก App หรือซื้อเป็น Bundle | Retail Bundle |
| **🎨 Consistent Design** | ทุก App ใช้ Design System เดียวกัน | Anajak UI |

### เปรียบเทียบกับคู่แข่ง

| | **Google** | **Adobe** | **Anajak** |
|---|-----------|----------|------------|
| **SSO** | Google Account | Adobe ID | Anajak ID |
| **แยก Apps** | ✅ | ✅ | ✅ |
| **Data Sharing** | ✅ Drive ↔ Docs | ✅ PS ↔ AI | ✅ Stock ↔ Sales |
| **Bundle Pricing** | ✅ Workspace | ✅ Creative Cloud | ✅ Suite Plans |
| **Design System** | Material Design | Adobe Spectrum | Anajak UI |
| **Cloud-based** | ✅ | ✅ | ✅ |

### ข้อดีของโมเดลนี้

| ข้อดี | สำหรับลูกค้า | สำหรับเรา |
|------|--------------|----------|
| **🎯 โฟกัส** | แต่ละ App ทำได้ดี ไม่จับฉ่าย | พัฒนาทีละ App ได้ |
| **💰 ประหยัด** | ซื้อเฉพาะที่ต้องการ | หลาย Revenue Stream |
| **🔧 ยืดหยุ่น** | เพิ่ม/ลด App ได้ตามต้องการ | ทีมแยกดูแลได้ |
| **🚀 Scalable** | เติบโตไปพร้อมธุรกิจ | เพิ่ม App ใหม่ง่าย |
| **🔄 ไม่ผูกมัด** | ไม่ต้องซื้อทั้งหมด | ลูกค้าเข้าถึงได้ง่าย |

### การเชื่อมต่อระหว่าง Apps

```
📦 Stock                    🛒 Sales
├── สินค้า     ──────────▶  ├── ดึงสินค้ามาขาย
├── สต๊อค      ◀──────────  ├── หักสต๊อคเมื่อขาย
└── ราคาทุน   ──────────▶  └── คำนวณกำไร

🛒 Sales                    💰 Account (PEAK)
├── Invoice   ──────────▶  ├── บันทึกบัญชี
└── ยอดขาย    ──────────▶  └── ภาษี

👥 HRM                      📊 BI
├── พนักงาน  ──────────▶  ├── รายงานบุคคล
└── เงินเดือน ──────────▶  └── วิเคราะห์ต้นทุน

🛍️ POS                      📦 Stock
├── ขาย       ──────────▶  ├── หักสต๊อค Real-time
└── รายงาน    ◀──────────  └── เช็คสต๊อค

💬 Chat                     🛒 Sales
├── แชทลูกค้า ──────────▶  ├── สร้าง Lead
└── Support   ──────────▶  └── สร้าง Ticket
```

### Bundle Packages (ตัวอย่าง)

```
┌───────────────────────────────────────────────────────────────────────┐
│  🛍️ RETAIL BUNDLE         🏢 OFFICE BUNDLE       🎯 ALL-IN-ONE       │
│  ─────────────────         ────────────────       ─────────────       │
│  สำหรับร้านค้า             สำหรับสำนักงาน         ทุกอย่างครบ         │
│                                                                        │
│  • Stock ✅                • HRM ✅               • ทุก App ✅         │
│  • Sales ✅                • Chat ✅                                   │
│  • POS ✅                  • BI ✅                                     │
│  • Delivery ✅                                                         │
│                                                                        │
│  ฿999/เดือน                ฿799/เดือน            ฿1,499/เดือน        │
│  (ประหยัด 30%)            (ประหยัด 25%)          (ประหยัด 40%)        │
└───────────────────────────────────────────────────────────────────────┘
```

### ❓ ทำไมไม่ทำเป็น App เดียวจบ?

> **คำถามที่พบบ่อย:** "ทำไมไม่รวม Sales กับ Stock เป็นแอปเดียว?" หรือ "ทำไมไม่ทำ All-in-One ERP?"

#### 🔴 ปัญหาของ All-in-One App

```
┌─────────────────────────────────────────────────────────────────┐
│                    ❌ ALL-IN-ONE APP                            │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Stock + Sales + HRM + Chat + POS + Delivery + BI + ...   │ │
│  │                                                            │ │
│  │  • ซับซ้อน ใช้งานยาก                                        │ │
│  │  • ต้องจ่ายทั้งหมด แม้ใช้แค่บางส่วน                          │ │
│  │  • Update ยาก กระทบทั้งระบบ                                 │ │
│  │  • เหมาะกับองค์กรใหญ่ ไม่ใช่ SME                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ตัวอย่าง: SAP, Oracle → ราคาแพง, ใช้ยาก, ต้องจ้าง Consultant  │
└─────────────────────────────────────────────────────────────────┘
```

#### เปรียบเทียบ 2 แนวทาง

| | **All-in-One App** | **Suite of Apps** |
|---|-------------------|-------------------|
| **ความซับซ้อน** | 😵 ซับซ้อน เมนูเยอะ | 😊 แต่ละ App เรียบง่าย |
| **เวลาเรียนรู้** | ⏰ นาน ต้องอบรม | ⚡ เร็ว ใช้งานได้เลย |
| **ราคา** | 💰 จ่ายทั้งหมด | 💵 จ่ายเฉพาะที่ใช้ |
| **Flexibility** | 🔒 ถูกบังคับใช้ทั้งหมด | 🔓 เลือกได้ตามต้องการ |
| **Updates** | 🐢 ช้า กลัว Breaking | 🚀 เร็ว แยก Release |
| **Performance** | 🐌 หนัก โหลดทุกอย่าง | ⚡ เบา โหลดเฉพาะที่ใช้ |
| **เหมาะกับ** | 🏭 Enterprise | 🏪 SME |

#### 🟢 ทำไม Suite of Apps ดีกว่าสำหรับ SME

**1. 💰 ประหยัดเงิน - จ่ายเท่าที่ใช้**
```
ร้านขายของออนไลน์เล็กๆ:
❌ All-in-One: จ่าย ฿3,000/เดือน (ได้ HRM, Manufacturing ที่ไม่ใช้)
✅ Suite:      จ่าย ฿499/เดือน  (ซื้อแค่ Stock)
```

**2. 🎯 ไม่งง - แต่ละ App ทำหน้าที่เดียว**
```
❌ All-in-One: เมนู 50+ อัน ไม่รู้จะเริ่มตรงไหน
✅ Suite:      Stock = จัดการคลัง, Sales = ขายของ (ชัดเจน)
```

**3. 🚀 เติบโตไปด้วยกัน**
```
วันนี้:    ใช้แค่ Stock (ฟรี)
เดือนหน้า: เพิ่ม Sales (฿499)
ปีหน้า:    เพิ่ม HRM + Chat (฿799)

→ จ่ายตามการเติบโต ไม่ต้องลงทุนก้อนใหญ่ตั้งแต่แรก
```

**4. 🔧 เลือกสิ่งที่ดีที่สุด**
```
บางธุรกิจ:
• ใช้ Anajak Stock (คลัง)
• ใช้ PEAK (บัญชี) ← เพราะนักบัญชีคุ้นเคย
• ใช้ Anajak Chat (แชท)

→ ไม่ถูกบังคับใช้ทั้งหมดจากเจ้าเดียว
```

#### 🤔 แล้วมันไม่ยุ่งยากเหรอ ใช้หลาย App?

**ไม่ยุ่งยากครับ เพราะ:**

| ความกังวล | วิธีแก้ |
|-----------|--------|
| **"ต้อง Login หลายครั้ง"** | ❌ ไม่ต้อง! SSO เข้าครั้งเดียว ใช้ได้ทุก App |
| **"ข้อมูลไม่เชื่อมกัน"** | ❌ ไม่จริง! Data Sync อัตโนมัติ |
| **"หน้าตาไม่เหมือนกัน"** | ❌ ไม่จริง! ใช้ Design System เดียวกัน |
| **"ต้องเปิดหลายหน้าต่าง"** | มี Portal รวม Dashboard ทุก App |

```
┌─────────────────────────────────────────────────────────────────┐
│                    🏠 ANAJAK PORTAL                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🔐 Login ครั้งเดียว → เข้าถึงทุก App                      │  │
│  │                                                           │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │  │
│  │  │📦 Stock │ │🛒 Sales │ │👥 HRM   │ │💬 Chat  │        │  │
│  │  │  คลิก   │ │  คลิก   │ │  คลิก   │ │  คลิก   │        │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │  │
│  │                                                           │  │
│  │  📊 Dashboard รวม: ยอดขาย + สต๊อค + พนักงาน              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### 📌 สรุป: ทำไมเลือก Suite ไม่ใช่ All-in-One

| เหตุผล | อธิบาย |
|--------|--------|
| **🎯 SME First** | ออกแบบมาสำหรับธุรกิจเล็ก ไม่ใช่ Enterprise |
| **💰 Pay as you grow** | จ่ายตามที่ใช้ ไม่ต้องลงทุนก้อนใหญ่ |
| **🧩 Modular** | เพิ่ม/ลด App ได้ตามความต้องการ |
| **🚀 Fast & Light** | แต่ละ App เบา โหลดเร็ว |
| **🔗 Connected** | เชื่อมกันได้ แม้แยก App |
| **🌐 Open** | เชื่อมกับระบบอื่นได้ (PEAK, Shopee, etc.) |

---

## 📱 ภาพรวมผลิตภัณฑ์

```
┌─────────────────────────────────────────────────────────────────────┐
│                        🏢 ANAJAK SUITE                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    🏠 Anajak Portal                          │   │
│  │              (Dashboard รวม / SSO / Settings)                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │   📦    │ │   🛒    │ │   💰    │ │   👥    │ │   💬    │      │
│  │  Stock  │ │  Sales  │ │ Account │ │   HRM   │ │  Chat   │      │
│  │   ✅    │ │   📋    │ │  🔗     │ │   📋    │ │   📋    │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
│                                                                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │   🛍️   │ │   🚚    │ │   📊    │ │   🔌    │ │   🤖    │      │
│  │   POS   │ │Delivery │ │   BI    │ │ Connect │ │   AI    │      │
│  │   📋    │ │   📋    │ │   📋    │ │   📋    │ │   📋    │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
│                                                                      │
│  ✅ = เสร็จแล้ว   🔗 = เชื่อมระบบอื่น   📋 = วางแผน                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Apps ทั้งหมด

| App | ชื่อ | รายละเอียด | สถานะ |
|-----|-----|------------|-------|
| 📦 | **Anajak Stock** | คลังสินค้า, PR/PO/GRN, สต๊อค | ✅ Done |
| 🛒 | **Anajak Sales** | ขาย, ใบเสนอราคา, Invoice, CRM | 📋 Plan |
| 💰 | **Anajak Account** | บัญชี, ภาษี (หรือเชื่อม PEAK) | 🔗 Integrate |
| 👥 | **Anajak HRM** | พนักงาน, เงินเดือน, ลางาน | 📋 Plan |
| 💬 | **Anajak Chat** | แชทภายใน, แชทลูกค้า, Ticket | 📋 Plan |
| 🛍️ | **Anajak POS** | ขายหน้าร้าน, ขายบูธ | 📋 Plan |
| 🚚 | **Anajak Delivery** | จัดส่ง, Tracking, ขนส่ง | 📋 Plan |
| 📊 | **Anajak BI** | Dashboard, รายงาน, วิเคราะห์ | 📋 Plan |
| 🔌 | **Anajak Connect** | API Hub, Marketplace Sync | 📋 Plan |
| 🤖 | **Anajak AI** | AI Assistant, พยากรณ์, แนะนำ | 📋 Plan |

---

## 🏗️ สถาปัตยกรรมระบบ

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │   Web   │  │ Mobile  │  │   API   │  │ Widget  │            │
│  │  (PWA)  │  │  (RN)   │  │ Client  │  │ Embed   │            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
└───────┼────────────┼────────────┼────────────┼──────────────────┘
        │            │            │            │
        └────────────┴────────────┴────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                    API GATEWAY                                   │
│              (Authentication, Rate Limit, Routing)               │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                     SERVICES                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │  Auth   │  │  Stock  │  │  Sales  │  │   HRM   │  ...       │
│  │ Service │  │ Service │  │ Service │  │ Service │            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
└───────┼────────────┼────────────┼────────────┼──────────────────┘
        │            │            │            │
┌───────┴────────────┴────────────┴────────────┴──────────────────┐
│                     SHARED LAYER                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Database   │  │    Cache    │  │   Storage   │              │
│  │ (Supabase)  │  │   (Redis)   │  │    (S3)     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Tenant Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ORGANIZATION                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Organization ID: org_abc123                                  ││
│  │ Name: ร้านเสื้อผ้า XYZ                                        ││
│  │ Plan: Business                                               ││
│  │ Apps: [Stock, Sales, HRM]                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Admin     │  │   Manager   │  │    Staff    │              │
│  │  (Owner)    │  │             │  │             │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  Data Isolation: Row-Level Security (RLS)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 รายละเอียดแต่ละ App

### 1. 📦 Anajak Stock (✅ เสร็จแล้ว)

**สถานะ:** Production Ready

**ฟีเจอร์:**
- ✅ จัดการสินค้าและ Variants (สี/ไซส์)
- ✅ คลังสินค้าหลาย Location
- ✅ รับ/เบิก/โอน/ปรับยอด สต๊อค
- ✅ ใบขอซื้อ (PR) → ใบสั่งซื้อ (PO) → รับสินค้า (GRN)
- ✅ Barcode Scanner
- ✅ รายงานและสถิติ
- ✅ Import/Export Excel
- ✅ API สำหรับเชื่อมต่อ

---

### 2. 🛒 Anajak Sales (📋 วางแผน)

**เป้าหมาย:** ระบบขายและ CRM สำหรับ B2B/B2C

**ฟีเจอร์หลัก:**
- [ ] ใบเสนอราคา (Quotation)
- [ ] ใบสั่งขาย (Sales Order)
- [ ] ใบแจ้งหนี้ (Invoice)
- [ ] ใบเสร็จรับเงิน (Receipt)
- [ ] จัดการลูกค้า (CRM)
- [ ] ประวัติการซื้อ
- [ ] ส่วนลด / โปรโมชั่น
- [ ] เชื่อม Stock อัตโนมัติ

**Flow:**
```
Quotation → Sales Order → Invoice → Receipt
     ↓           ↓
   ลูกค้า     หัก Stock
```

---

### 3. 💰 Anajak Account (🔗 เชื่อม PEAK)

**แนวทาง:** เชื่อมกับ PEAK Account แทนการทำเอง

**เหตุผล:**
- PEAK เป็นมาตรฐานบัญชีไทย
- มี e-Tax Invoice
- ลดเวลาพัฒนา
- ลูกค้าหลายรายใช้ PEAK อยู่แล้ว

**Integration:**
- [ ] Sync ข้อมูลลูกค้า/Supplier
- [ ] Push Invoice ไป PEAK
- [ ] Pull ข้อมูลบัญชีกลับมา
- [ ] Dashboard รวม

---

### 4. 👥 Anajak HRM (📋 วางแผน)

**เป้าหมาย:** จัดการพนักงาน ลางาน เงินเดือน

**ฟีเจอร์หลัก:**
- [ ] ทะเบียนพนักงาน
- [ ] โครงสร้างองค์กร
- [ ] เข้า-ออกงาน (Check-in/out)
- [ ] ลางาน / OT
- [ ] คำนวณเงินเดือน
- [ ] Payslip
- [ ] ประกันสังคม / ภาษี

---

### 5. 💬 Anajak Chat (📋 วางแผน)

**เป้าหมาย:** แชทภายในและแชทลูกค้า

**ฟีเจอร์หลัก:**
- [ ] แชทภายในทีม
- [ ] ช่องแชทตาม Department
- [ ] แชทลูกค้า (Live Chat Widget)
- [ ] Ticket System
- [ ] เชื่อม Line OA
- [ ] เชื่อม Facebook Messenger
- [ ] Chatbot พื้นฐาน

---

### 6. 🛍️ Anajak POS (📋 วางแผน)

**เป้าหมาย:** ขายหน้าร้าน / ขายบูธ

**ฟีเจอร์หลัก:**
- [ ] หน้าจอขาย (Touch-friendly)
- [ ] สแกน Barcode
- [ ] รับชำระเงินสด / โอน / บัตร
- [ ] พิมพ์ใบเสร็จ
- [ ] เปิด-ปิดกะ
- [ ] รายงานยอดขายรายวัน
- [ ] Offline Mode

---

### 7. 🚚 Anajak Delivery (📋 วางแผน)

**เป้าหมาย:** จัดการการจัดส่ง

**ฟีเจอร์หลัก:**
- [ ] สร้างใบจัดส่ง
- [ ] เชื่อมขนส่ง (Kerry, Flash, J&T, ไปรษณีย์)
- [ ] พิมพ์ใบปะหน้า
- [ ] Tracking
- [ ] แจ้งลูกค้าอัตโนมัติ
- [ ] COD Management

---

### 8. 📊 Anajak BI (📋 วางแผน)

**เป้าหมาย:** Dashboard และรายงานรวม

**ฟีเจอร์หลัก:**
- [ ] Dashboard รวมจากทุก App
- [ ] สร้าง Report แบบ Drag & Drop
- [ ] กราฟและแผนภูมิ
- [ ] Export PDF / Excel
- [ ] Schedule Report
- [ ] Alerts & Notifications

---

### 9. 🔌 Anajak Connect (📋 วางแผน)

**เป้าหมาย:** API Hub และ Marketplace Integration

**ฟีเจอร์หลัก:**
- [ ] Shopee Integration
- [ ] Lazada Integration
- [ ] Line OA Integration
- [ ] Facebook Shop
- [ ] WooCommerce
- [ ] Webhook Management
- [ ] API Marketplace

---

### 10. 🤖 Anajak AI (📋 วางแผน)

**เป้าหมาย:** AI ช่วยการทำงาน

**ฟีเจอร์หลัก:**
- [ ] พยากรณ์ยอดขาย
- [ ] แนะนำการสั่งซื้อ
- [ ] Chatbot ตอบลูกค้า
- [ ] วิเคราะห์ลูกค้า
- [ ] ตรวจจับความผิดปกติ

---

## 💻 Technology Stack

### Frontend
```yaml
Framework: Next.js 15+ (App Router)
UI Library: Tailwind CSS + Shadcn/ui
State: Zustand + React Query
Forms: React Hook Form + Zod
Charts: Recharts
Animation: Framer Motion
```

### Backend
```yaml
API: Next.js API Routes / tRPC
Auth: Supabase Auth (SSO)
Database: PostgreSQL (Supabase)
Cache: Redis (Upstash)
Queue: Inngest
Storage: Supabase Storage / S3
Email: Resend
```

### Infrastructure
```yaml
Hosting: Vercel
Database: Supabase
CDN: Vercel Edge
Monitoring: Sentry
Analytics: Posthog
CI/CD: GitHub Actions
```

### Monorepo Structure
```
anajak-suite/
├── apps/
│   ├── portal/         # Main entry point
│   ├── stock/          # Stock management
│   ├── sales/          # Sales & CRM
│   ├── hrm/            # HR management
│   ├── chat/           # Chat system
│   ├── pos/            # Point of Sale
│   └── docs/           # Documentation
│
├── packages/
│   ├── ui/             # @anajak/ui
│   ├── auth/           # @anajak/auth
│   ├── db/             # @anajak/db
│   ├── api/            # @anajak/api
│   ├── utils/          # @anajak/utils
│   └── config/         # @anajak/config
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 🗺️ Roadmap

### 2025 Q1: Foundation ✅
- [x] Anajak Stock - Core features
- [x] Anajak Stock - PR/PO/GRN workflow
- [x] Anajak Stock - Reports & Analytics
- [x] Anajak Stock - API for integrations

### 2025 Q2: Sales & Integration
- [ ] Anajak Portal - SSO & Dashboard
- [ ] Anajak Sales - Quotation & Invoice
- [ ] PEAK Account Integration
- [ ] Monorepo Setup

### 2025 Q3: Operations
- [ ] Anajak POS - Basic features
- [ ] Anajak Delivery - Shipping integration
- [ ] Anajak Connect - Shopee/Lazada sync
- [ ] Mobile App (PWA)

### 2025 Q4: People & Communication
- [ ] Anajak HRM - Employee management
- [ ] Anajak Chat - Internal chat
- [ ] Anajak BI - Dashboard builder

### 2026 Q1: Intelligence
- [ ] Anajak AI - Forecasting
- [ ] Anajak AI - Chatbot
- [ ] Advanced Analytics
- [ ] API Marketplace

---

## 💰 Business Model

### Pricing Tiers

| | 🆓 Free | 💼 Pro | 🏢 Business | 🏭 Enterprise |
|---|---------|--------|-------------|---------------|
| **ราคา** | ฿0/เดือน | ฿499/เดือน | ฿1,499/เดือน | ติดต่อ |
| **Apps** | 1 | 3 | All | All + Custom |
| **Users** | 1 | 5 | 20 | Unlimited |
| **Records** | 1,000 | 10,000 | 100,000 | Unlimited |
| **Storage** | 1 GB | 10 GB | 50 GB | Unlimited |
| **Support** | Community | Email | Priority | Dedicated |
| **API** | ❌ | ✅ | ✅ | ✅ |
| **Custom Domain** | ❌ | ❌ | ✅ | ✅ |
| **White Label** | ❌ | ❌ | ❌ | ✅ |

### Revenue Streams
1. **SaaS Subscription** - รายได้หลัก
2. **Add-on Features** - ฟีเจอร์เสริม
3. **Integration Marketplace** - ค่าธรรมเนียม Integration
4. **Professional Services** - ติดตั้ง/Customize
5. **Partner Program** - Reseller/Affiliate

---

## 🏆 การแข่งขัน

### Competitive Analysis

| | **Anajak** | **Odoo** | **Zoho** | **FlowAccount** |
|---|-----------|----------|----------|-----------------|
| **ราคา** | ฿499-1,499 | ฿1,000+ | ฿500+ | ฿500+ |
| **ภาษาไทย** | ✅ Native | ⚠️ บางส่วน | ⚠️ บางส่วน | ✅ |
| **SME Focus** | ✅ | ⚠️ | ⚠️ | ✅ |
| **ใช้งานง่าย** | ✅ | ❌ | ⚠️ | ✅ |
| **Inventory** | ✅ | ✅ | ✅ | ⚠️ |
| **Manufacturing** | ❌ | ✅ | ❌ | ❌ |
| **Customizable** | ✅ | ✅ | ⚠️ | ❌ |

### Unique Selling Points (USP)
1. **ออกแบบสำหรับ SME ไทย** - ไม่ใช่แปลจากต่างประเทศ
2. **ราคาเข้าถึงได้** - ไม่มี hidden cost
3. **ใช้งานง่าย** - ไม่ต้องอบรมหลายวัน
4. **Modern Tech Stack** - เร็ว, สวย, ใช้งานได้ทุก Device
5. **Open API** - เชื่อมต่อกับระบบอื่นได้

---

## 📞 Contact

- **Website:** anajak.com (TBD)
- **Email:** hello@anajak.com (TBD)
- **GitHub:** github.com/LOSTXKER

---

*เอกสารนี้อัปเดตล่าสุด: มกราคม 2026*
