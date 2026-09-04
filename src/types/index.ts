// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'warehouse' | 'sales'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  canStockIn: boolean
  canStockOut: boolean
  canSell: boolean
  canEdit: boolean
  canDelete: boolean
  active: boolean
  avatarUrl?: string
}

// ─── Material / Product ───────────────────────────────────────────────────────

export type MaterialCategory = 'filament' | 'resin'

export type FilamentMaterial =
  | 'PLA'
  | 'PLA Pro'
  | 'PETG'
  | 'ABS'
  | 'TPU'
  | 'ASA'
  | 'Nylon'
  | 'HIPS'
  | 'PVA'
  | 'Carbon Fiber'
  | 'Wood Fill'
  | 'Other'

export type ResinMaterial =
  | 'Standard Resin'
  | 'ABS-Like Resin'
  | 'Water-Washable Resin'
  | 'Flexible Resin'
  | 'Castable Resin'
  | 'Dental Resin'
  | 'Engineering Resin'
  | 'Other'

export type MaterialType = FilamentMaterial | ResinMaterial

export type ProductStatus = 'active' | 'inactive'

export interface Product {
  sku: string
  category: MaterialCategory
  material: MaterialType
  brand: string
  color: string
  weightPerSpool?: number   // grams per spool (filament)
  mlPerBottle?: number      // ml per bottle (resin)
  currentStock: number      // spools or bottles
  minStock: number          // reorder threshold
  warehouse: string
  rack: string
  column: string
  bin: string
  supplierId: string
  supplierName?: string
  purchasePrice: number
  sellingPrice: number
  lastTransactionDate?: string
  lastTransactionType?: TransactionType
  status: ProductStatus
}

// ─── Transaction ──────────────────────────────────────────────────────────────

export type TransactionType = 'stock_in' | 'sale' | 'internal_use'

export interface Transaction {
  transactionId: string
  date: string         // ISO date string
  time: string         // HH:MM:SS
  sku: string
  productName: string  // material + brand + color
  transactionType: TransactionType
  quantity: number     // whole numbers only
  stockBefore: number
  stockAfter: number
  userId: string
  userName: string
  remarks: string
  customerId?: string
  customerName?: string
}

// ─── Supplier ─────────────────────────────────────────────────────────────────

export interface Supplier {
  supplierId: string
  name: string
  contactPerson: string
  phone: string
  email: string
  address: string
  gstNumber: string
  materialsSupplied: string[]
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface Customer {
  customerId: string
  name: string
  phone: string
  email: string
  address: string
  gstNumber: string
}

// ─── Pre-Order ────────────────────────────────────────────────────────────────

export type PreOrderStatus = 'pending' | 'fulfilled' | 'cancelled'

export interface PreOrder {
  orderId: string
  customerName: string
  customerId?: string
  sku: string
  productName: string
  quantityRequired: number
  dateEntered: string
  status: PreOrderStatus
}

// ─── BOM ──────────────────────────────────────────────────────────────────────

export interface BOMItem {
  sku: string
  productName: string
  material: string
  color: string
  category: MaterialCategory
  currentStock: number
  minStock: number
  deficit: number           // from low stock: minStock - currentStock (if > 0)
  preOrderQty: number       // total pending pre-order quantity
  totalRequired: number     // deficit + preOrderQty
  toOrder: number           // final quantity to procure
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface StockSummaryItem {
  material: string
  category: MaterialCategory
  totalStock: number
  unit: string
}

export interface LowStockAlert {
  sku: string
  productName: string
  category: MaterialCategory
  currentStock: number
  minStock: number
  deficit: number
}

export interface TrendDataPoint {
  date: string
  stockIn: number
  sales: number
  internalUse: number
}

export interface DashboardData {
  stockSummary: StockSummaryItem[]
  lowStockAlerts: LowStockAlert[]
  trendData: TrendDataPoint[]
  recentTransactions: Transaction[]
  totalFilamentSkus: number
  totalResinSkus: number
  totalTransactionsToday: number
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchResult extends Product {
  matchScore?: number
}
