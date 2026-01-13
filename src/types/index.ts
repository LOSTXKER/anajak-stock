import {
  User,
  Product,
  Category,
  UnitOfMeasure,
  Warehouse,
  Location,
  Supplier,
  StockBalance,
  StockMovement,
  MovementLine,
  PR,
  PRLine,
  PO,
  POLine,
  GRN,
  GRNLine,
  Role,
  MovementType,
  DocStatus,
  PRStatus,
  POStatus,
  GRNStatus,
  VatType,
} from '@/generated/prisma'

// Re-export enums
export { Role, MovementType, DocStatus, PRStatus, POStatus, GRNStatus, VatType }

// Extended types with relations
export type UserSafe = Omit<User, 'passwordHash'>

export type ProductWithRelations = Product & {
  category: Category | null
  unit: UnitOfMeasure | null
  stockBalances?: StockBalanceWithLocation[]
}

export type StockBalanceWithLocation = StockBalance & {
  location: Location & {
    warehouse: Warehouse
  }
}

export type StockBalanceWithProduct = StockBalance & {
  product: Product & {
    category: Category | null
    unit: UnitOfMeasure | null
  }
  location: Location & {
    warehouse: Warehouse
  }
}

export type LocationWithWarehouse = Location & {
  warehouse: Warehouse
}

export type MovementWithRelations = StockMovement & {
  createdBy: UserSafe
  approvedBy: UserSafe | null
  lines: MovementLineWithProduct[]
}

export type MovementLineWithProduct = MovementLine & {
  product: Product
  fromLocation: LocationWithWarehouse | null
  toLocation: LocationWithWarehouse | null
}

export type PRWithRelations = PR & {
  requester: UserSafe
  approver: UserSafe | null
  lines: PRLineWithProduct[]
}

export type PRLineWithProduct = PRLine & {
  product: Product
}

export type POWithRelations = PO & {
  supplier: Supplier
  pr: PR | null
  createdBy: UserSafe
  approvedBy: UserSafe | null
  lines: POLineWithProduct[]
  grns?: GRN[]
}

export type POLineWithProduct = POLine & {
  product: Product
  grnLines?: GRNLine[]
}

export type GRNWithRelations = GRN & {
  po: PO & {
    supplier: Supplier
  }
  receivedBy: UserSafe
  lines: GRNLineWithProduct[]
}

export type GRNLineWithProduct = GRNLine & {
  product: Product
  poLine: POLine
}

// Action response types
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

// Pagination types
export type PaginationParams = {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export type PaginatedResult<T> = {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Dashboard types
export type DashboardStats = {
  totalProducts: number
  totalStockValue: number
  lowStockCount: number
  pendingPRCount: number
  pendingPOCount: number
  todayMovements: number
}

export type LowStockItem = {
  product: Product
  location: Location & { warehouse: Warehouse }
  qtyOnHand: number
  reorderPoint: number
}

export type UpcomingPO = {
  id: string
  poNumber: string
  supplier: Supplier
  eta: Date
  total: number
  daysUntilDue: number
}
