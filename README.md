# ระบบจัดการสต๊อคสินค้า (Inventory Management System)

ระบบจัดการสต๊อคสินค้าครบวงจร พร้อมระบบ PR/PO และรายงานสถิติ

## Features

### Phase 1: MVP (Implemented)
- ✅ ระบบ Authentication ผ่าน **Supabase Auth**
- ✅ Role-based Access Control (Admin, Inventory, Requester, Approver, Purchasing, Viewer)
- ✅ Master Data Management (Products, Warehouses, Locations, Suppliers, Categories, Units)
- ✅ Stock Movement System (Issue, Receive, Transfer, Adjust)
- ✅ Movement Workflow (Draft → Submit → Approve → Post)
- ✅ PR (Purchase Requisition) with approval workflow
- ✅ PO (Purchase Order) with status tracking
- ✅ GRN (Goods Received Note) with partial receive support
- ✅ Dashboard with alerts
- ✅ Audit logging

### Phase 2: Reports
- ✅ Stock balance reports
- ✅ Low stock alerts
- ✅ Movement ledger report
- 📋 Top issue reports
- 📋 Dead stock analysis
- 📋 Supplier performance analytics
- ✅ Export to CSV

### Phase 3: Automation
- ✅ Auto-PR from Reorder Point
- ✅ Import Products from CSV/Excel
- 📋 Barcode/QR scanning

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Auth**: **Supabase Auth** (Email/Password + OAuth)
- **Forms**: React Hook Form + Zod validation

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (for PostgreSQL database & Authentication)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd anajaktshirt-stock
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from the example:
```bash
cp .env.example .env
```

4. Update `.env` with your Supabase credentials:
```env
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

5. Generate Prisma client:
```bash
npm run db:generate
```

6. Push the schema to your database:
```bash
npm run db:push
```

7. Seed the database with initial data:
```bash
npm run db:seed
```

8. Start the development server:
```bash
npm run dev
```

9. Open [http://localhost:3000](http://localhost:3000) in your browser

### Creating Users with Supabase Auth

เนื่องจากใช้ **Supabase Auth** คุณต้องสร้าง users ผ่าน Supabase Dashboard:

1. ไปที่ [Supabase Dashboard](https://supabase.com/dashboard)
2. เลือก Project ของคุณ
3. ไปที่ **Authentication** → **Users**
4. คลิก **Add User** → **Create New User**
5. ใส่ Email และ Password
6. หลังจาก user login ครั้งแรก ระบบจะสร้าง record ใน table `users` อัตโนมัติ
7. หากต้องการเปลี่ยน Role ให้ไปที่ **Prisma Studio** หรือ SQL editor:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

| Role | คำอธิบาย |
|------|----------|
| ADMIN | ผู้ดูแลระบบ - เข้าถึงทุกอย่าง |
| INVENTORY | คลังสินค้า - จัดการสต๊อคและ GRN |
| REQUESTER | ผู้ขอเบิก - สร้าง PR |
| APPROVER | ผู้อนุมัติ - อนุมัติ Movement และ PR/PO |
| PURCHASING | ฝ่ายจัดซื้อ - จัดการ PO และ Suppliers |
| VIEWER | ผู้ดูรายงาน - ดูได้อย่างเดียว |

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/          # Login page
│   ├── (dashboard)/
│   │   ├── dashboard/      # Main dashboard
│   │   ├── products/       # Product management
│   │   ├── stock/          # Stock balances
│   │   ├── movements/      # Stock movements
│   │   ├── pr/             # Purchase Requisitions
│   │   ├── po/             # Purchase Orders
│   │   ├── grn/            # Goods Received Notes
│   │   ├── reports/        # Reports
│   │   └── settings/       # System settings
│   ├── auth/
│   │   └── callback/       # Supabase Auth callback
│   └── api/
│       └── auth/           # Auth API routes
├── actions/                # Server actions
├── components/
│   ├── layout/            # Layout components
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── supabase/          # Supabase clients
│   ├── auth.ts            # Auth utilities
│   ├── prisma.ts          # Prisma client
│   └── utils.ts           # Utility functions
└── types/                 # TypeScript types
```

## Database Schema

The system uses a Movement Ledger approach where:
- All stock changes go through `StockMovement` documents
- `StockBalance` is a cache that gets updated when movements are posted
- No direct stock modifications are allowed

### Key Tables
- `users` - User data (synced from Supabase Auth)
- `products` - Product master data
- `warehouses` & `locations` - Storage locations
- `stock_balances` - Current stock quantities (cache)
- `stock_movements` & `movement_lines` - Stock movement ledger
- `prs` & `pr_lines` - Purchase requisitions
- `pos` & `po_lines` - Purchase orders
- `grns` & `grn_lines` - Goods received notes
- `audit_logs` - Complete audit trail

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed initial data
npm run db:studio    # Open Prisma Studio
```

## Business Rules

1. **Stock Management**
   - Stock balances are calculated from posted movements
   - Negative stock is not allowed (configurable)
   - All movements require approval before posting

2. **Document Workflow**
   - Draft → Submit → Approve → Post
   - Posted documents cannot be deleted (use adjustments)
   - All changes are logged in audit_logs

3. **PR/PO Process**
   - PR → Approve → Convert to PO
   - PO → Approve → Send → Receive (GRN)
   - Supports partial receiving

## Supabase Setup

### Required Settings

1. **Authentication** → **Providers**:
   - เปิด Email provider

2. **Authentication** → **URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

3. (Optional) **Authentication** → **Providers** → เปิด OAuth providers ที่ต้องการ (Google, GitHub, etc.)

## License

MIT
