/**
 * Mapping between the Real3D workbook and the app's domain types.
 *
 * This is the single source of truth for column order and value translation.
 * It mirrors google-apps-script/Migration.gs — if a column moves there, it
 * moves here.
 *
 * Dependency-free on purpose so it can be unit tested without a browser.
 */

import type {
  Product, Transaction, TransactionType, User, UserRole,
  Supplier, Customer, PreOrder, PreOrderStatus,
  MaterialCategory, MaterialType, ProductStatus,
} from '@/types'

// ─── Tab names ───────────────────────────────────────────────────────────────

export const TAB = {
  products:     'Products',
  transactions: 'Transactions',
  inventory:    'Inventory',
  users:        'Users',
  suppliers:    'Suppliers',
  customers:    'Customers',
  preOrders:    'PreOrders',
} as const

// ─── Column layouts (order matters: it is the sheet's physical order) ────────

export const PRODUCTS_COLUMNS = [
  'SKU', 'Category', 'Material', 'Color', 'Brand', 'Weight_kg', 'Diameter',
  'Reorder_Level', 'Warehouse', 'Rack', 'Col_No', 'Bin', 'Supplier_ID',
  'Purchase_Price', 'Selling_Price', 'MRP', 'Status',
] as const

/**
 * Column 10 is intentionally unnamed and column 11 repeats the timestamp, so
 * both the legacy "Timestamp" and newer "TimeStamp" positions stay populated.
 * Remarks is appended as column 12 — additive, so the agreed layout is intact.
 */
export const TRANSACTIONS_COLUMNS = [
  'Transaction_ID', 'SKU', 'Transaction_Type', 'Quantity', 'User',
  'Timestamp', 'Before_Stock', 'After_stock', 'Input_Type', '', 'TimeStamp',
  'Remarks',
] as const

export const INVENTORY_COLUMNS = [
  'SKU', 'Material', 'Color', 'Brand', 'Weight_kg', 'Reorder_level',
  'Current_Stock', 'Status', 'Last_Updated',
] as const

export const USERS_COLUMNS = [
  'Email', 'Name', 'Role', 'Can_Stock_In', 'Can_Stock_Out',
  'Can_Sell', 'Can_Edit', 'Can_Delete', 'Active',
] as const

export const SUPPLIERS_COLUMNS = [
  'Supplier_ID', 'Name', 'Contact_Person', 'Phone', 'Email', 'Address',
  'GST_Number', 'Materials_Supplied', 'Active',
] as const

export const CUSTOMERS_COLUMNS = [
  'Customer_ID', 'Name', 'Phone', 'Email', 'Address', 'GST_Number', 'Active',
] as const

export const PREORDERS_COLUMNS = [
  'Order_ID', 'Customer_Name', 'Customer_ID', 'SKU', 'Product_Name',
  'Quantity_Required', 'Date_Entered', 'Status',
] as const

/** All tabs the app expects, with their headers — used for setup validation. */
export const REQUIRED_TABS: Array<{ name: string; columns: readonly string[] }> = [
  { name: TAB.products,     columns: PRODUCTS_COLUMNS },
  { name: TAB.transactions, columns: TRANSACTIONS_COLUMNS },
  { name: TAB.inventory,    columns: INVENTORY_COLUMNS },
  { name: TAB.users,        columns: USERS_COLUMNS },
  { name: TAB.suppliers,    columns: SUPPLIERS_COLUMNS },
  { name: TAB.customers,    columns: CUSTOMERS_COLUMNS },
  { name: TAB.preOrders,    columns: PREORDERS_COLUMNS },
]

// ─── Primitive coercion ──────────────────────────────────────────────────────

export type Cell = string | number | boolean | null | undefined
export type Row = Cell[]

export function normaliseHeader(h: Cell): string {
  return String(h ?? '').trim().toLowerCase().replace(/\s+/g, '_')
}

/**
 * Resolve header names to column indices, tolerating case and spacing drift
 * (the workbook has both `Reorder_Level` and `Reorder_level`).
 * Later aliases win only if earlier ones are absent.
 */
export function headerIndex(
  headerRow: Row,
  aliases: Record<string, string[]>
): Record<string, number> {
  const norm = headerRow.map(normaliseHeader)
  const out: Record<string, number> = {}
  for (const [key, names] of Object.entries(aliases)) {
    out[key] = -1
    for (const n of names) {
      const at = norm.indexOf(normaliseHeader(n))
      if (at !== -1) { out[key] = at; break }
    }
  }
  return out
}

/**
 * Every column index whose header matches `name`.
 *
 * Needed because the Transactions tab has two columns that normalise to the
 * same key ("Timestamp" at 6 and "TimeStamp" at 11), so a single-index lookup
 * would silently always return the first one.
 */
export function allHeaderIndices(headerRow: Row, name: string): number[] {
  const target = normaliseHeader(name)
  const out: number[] = []
  headerRow.forEach((h, i) => {
    if (normaliseHeader(h) === target) out.push(i)
  })
  return out
}

export function cellString(row: Row, i: number, dflt = ''): string {
  if (i < 0 || i >= row.length) return dflt
  const v = row[i]
  if (v === null || v === undefined || v === '') return dflt
  return String(v).trim()
}

export function cellNumber(row: Row, i: number, dflt = 0): number {
  if (i < 0 || i >= row.length) return dflt
  const v = row[i]
  if (v === null || v === undefined || v === '') return dflt
  if (typeof v === 'number') return v
  const m = String(v).replace(/,/g, '').match(/-?[\d.]+/)
  return m ? parseFloat(m[0]) : dflt
}

export function cellBool(row: Row, i: number, dflt = false): boolean {
  if (i < 0 || i >= row.length) return dflt
  const v = row[i]
  if (v === null || v === undefined || v === '') return dflt
  if (typeof v === 'boolean') return v
  const s = String(v).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'y'
}

/** Strip a trailing "kg" etc. `"1kg"` -> 1. */
export function parseWeightKg(v: Cell, dflt = 1): number {
  if (v === null || v === undefined || v === '') return dflt
  if (typeof v === 'number') return v
  const m = String(v).match(/([\d.]+)/)
  return m ? parseFloat(m[1]) : dflt
}

// ─── Date handling ───────────────────────────────────────────────────────────

/**
 * Google Sheets stores dates as a serial day count from 1899-12-30.
 * Reading with UNFORMATTED_VALUE therefore yields numbers like 46202.58.
 */
const SHEETS_EPOCH_OFFSET_DAYS = 25569
const MS_PER_DAY = 86_400_000

export function serialToDate(serial: number): Date {
  return new Date(Math.round((serial - SHEETS_EPOCH_OFFSET_DAYS) * MS_PER_DAY))
}

export function dateToSerial(d: Date): number {
  return d.getTime() / MS_PER_DAY + SHEETS_EPOCH_OFFSET_DAYS
}

/** Accepts a Sheets serial, an ISO string, or a formatted date string. */
export function parseSheetDate(v: Cell): Date | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return serialToDate(v)
  const s = String(v).trim()
  if (/^-?[\d.]+$/.test(s)) return serialToDate(parseFloat(s))
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** `2026-09-04` in local time. */
export function toDatePart(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** `14:30:05` in local time. */
export function toTimePart(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * `2026-09-04 14:30:05` — written with valueInputOption=USER_ENTERED so Sheets
 * parses it into a real date value rather than storing text.
 *
 * The REST API only accepts JSON primitives, so a Date instance cannot be sent
 * directly the way it can from Apps Script.
 */
export function toSheetDateTime(d: Date): string {
  return `${toDatePart(d)} ${toTimePart(d)}`
}

/** `2026-09-04` for date-only columns. */
export function toSheetDate(d: Date): string {
  return toDatePart(d)
}

// ─── Enum translation ────────────────────────────────────────────────────────

/** Sheet spellings, exactly as they appear in the workbook. */
export const TRANSACTION_TYPE_TO_SHEET: Record<TransactionType, string> = {
  stock_in:     'Stock In',
  sale:         'Sale',
  internal_use: 'Internal Usage',
}

export function transactionTypeFromSheet(v: Cell): TransactionType {
  const s = String(v ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (s === 'stockin')  return 'stock_in'
  if (s === 'sale' || s === 'sold') return 'sale'
  // "Internal Usage", "Internal Use", "internal_use"
  return 'internal_use'
}

/** How a transaction was captured. Written to the Input_Type column. */
export const INPUT_TYPE = {
  barcode:  'Scanned Barcode Entry',
  qr:       'Scanned QR Entry',
  ocr:      'OCR Text Entry',
  manual:   'Manual Entry',
  quickAdd: 'Quick Add',
} as const
export type InputTypeKey = keyof typeof INPUT_TYPE

export function roleFromSheet(v: Cell): UserRole {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'admin') return 'admin'
  if (s === 'sales') return 'sales'
  if (s === 'warehouse') return 'warehouse'
  // Intern / Viewer / anything unrecognised gets the least-privileged role
  return 'sales'
}

export function roleToSheet(r: UserRole): string {
  return r.charAt(0).toUpperCase() + r.slice(1)
}

export function categoryFromSheet(v: Cell): MaterialCategory {
  return String(v ?? '').trim().toLowerCase() === 'resin' ? 'resin' : 'filament'
}

export function categoryToSheet(c: MaterialCategory): string {
  return c === 'resin' ? 'Resin' : 'Filament'
}

/**
 * Filament or Resin from free text.
 * "ABS-Like" is resin-only terminology — the category exists because
 * photopolymer resin cannot be true ABS. Plain ABS/ASA stay filament.
 */
export function inferCategory(material: string, color = ''): MaterialCategory {
  const t = `${material} ${color}`.toUpperCase()
  return /RESIN|ABS[\s-]?LIKE|PHOTOPOLYMER|WATER[\s-]?WASHABLE|CASTABLE|DENTAL/.test(t)
    ? 'resin'
    : 'filament'
}

export function stockStatus(stock: number, reorder: number): string {
  if (stock <= 0) return 'Out of Stock'
  if (stock < reorder) return 'Low Stock'
  return 'In Stock'
}

// ─── Products ────────────────────────────────────────────────────────────────

const PRODUCT_ALIASES = {
  sku: ['SKU'], category: ['Category'], material: ['Material'],
  color: ['Color', 'Colour'], brand: ['Brand'],
  weight: ['Weight_kg', 'Weight'], diameter: ['Diameter'],
  reorder: ['Reorder_Level', 'Reorder_level'],
  warehouse: ['Warehouse'], rack: ['Rack'], col: ['Col_No', 'Column'], bin: ['Bin'],
  supplierId: ['Supplier_ID'], purchase: ['Purchase_Price'],
  selling: ['Selling_Price'], mrp: ['MRP'], status: ['Status'],
}

export function productFromRow(headerRow: Row, row: Row): Product | null {
  const ix = headerIndex(headerRow, PRODUCT_ALIASES)
  const sku = cellString(row, ix.sku)
  if (!sku) return null

  const material = cellString(row, ix.material)
  const color = cellString(row, ix.color)
  const rawCategory = cellString(row, ix.category)

  return {
    sku,
    // Fall back to inference when the column is blank (pre-migration rows)
    category: rawCategory ? categoryFromSheet(rawCategory) : inferCategory(material, color),
    material: (material || 'Other') as MaterialType,
    brand: cellString(row, ix.brand),
    color,
    weightKg: parseWeightKg(row[ix.weight]),
    diameter: cellNumber(row, ix.diameter, 0) || undefined,
    currentStock: 0,               // joined from Inventory
    minStock: cellNumber(row, ix.reorder, 5),
    warehouse: cellString(row, ix.warehouse, 'Main'),
    rack: cellString(row, ix.rack),
    column: cellString(row, ix.col),
    bin: cellString(row, ix.bin),
    supplierId: cellString(row, ix.supplierId),
    purchasePrice: cellNumber(row, ix.purchase, 0),
    sellingPrice: cellNumber(row, ix.selling, 0),
    mrp: cellNumber(row, ix.mrp, 0),
    status: (cellString(row, ix.status, 'Active').toLowerCase() === 'inactive'
      ? 'inactive' : 'active') as ProductStatus,
  }
}

/** Domain -> row, in PRODUCTS_COLUMNS order. */
export function productToRow(p: Omit<Product, 'currentStock'>): Row {
  return [
    p.sku,
    categoryToSheet(p.category),
    p.material,
    p.color,
    p.brand,
    p.weightKg ?? 1,
    p.diameter ?? '',
    p.minStock,
    p.warehouse || 'Main',
    p.rack,
    p.column,
    p.bin,
    p.supplierId,
    p.purchasePrice,
    p.sellingPrice,
    p.mrp ?? 0,
    p.status === 'inactive' ? 'Inactive' : 'Active',
  ]
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface InventoryRow {
  sku: string
  currentStock: number
  reorderLevel: number
  status: string
  lastUpdated: Date | null
}

const INVENTORY_ALIASES = {
  sku: ['SKU'], material: ['Material'], color: ['Color'], brand: ['Brand'],
  weight: ['Weight_kg'], reorder: ['Reorder_level', 'Reorder_Level'],
  stock: ['Current_Stock'], status: ['Status'], updated: ['Last_Updated'],
}

export function inventoryFromRow(headerRow: Row, row: Row): InventoryRow | null {
  const ix = headerIndex(headerRow, INVENTORY_ALIASES)
  const sku = cellString(row, ix.sku)
  if (!sku) return null
  return {
    sku,
    currentStock: cellNumber(row, ix.stock, 0),
    reorderLevel: cellNumber(row, ix.reorder, 5),
    status: cellString(row, ix.status),
    lastUpdated: parseSheetDate(row[ix.updated]),
  }
}

export function inventoryToRow(p: Product, stock: number, now: Date = new Date()): Row {
  return [
    p.sku, p.material, p.color, p.brand, p.weightKg ?? 1, p.minStock,
    stock, stockStatus(stock, p.minStock), toSheetDateTime(now),
  ]
}

// ─── Transactions ────────────────────────────────────────────────────────────

const TRANSACTION_ALIASES = {
  id: ['Transaction_ID'], sku: ['SKU'], type: ['Transaction_Type'],
  qty: ['Quantity'], user: ['User'],
  before: ['Before_Stock'], after: ['After_stock', 'After_Stock'],
  inputType: ['Input_Type'], remarks: ['Remarks'],
}

export function transactionFromRow(headerRow: Row, row: Row): Transaction | null {
  const ix = headerIndex(headerRow, TRANSACTION_ALIASES)
  const id = cellString(row, ix.id)
  const sku = cellString(row, ix.sku)
  if (!id && !sku) return null

  // The tab carries two timestamp columns ("Timestamp" and "TimeStamp"), and
  // historical rows populated different ones. Try the rightmost first, since
  // that is where recent rows write, then fall back through the others.
  let when: Date | null = null
  const tsCols = allHeaderIndices(headerRow, 'Timestamp')
  for (let k = tsCols.length - 1; k >= 0 && !when; k--) {
    when = parseSheetDate(row[tsCols[k]])
  }

  return {
    transactionId: id,
    sku,
    transactionType: transactionTypeFromSheet(row[ix.type]),
    quantity: cellNumber(row, ix.qty, 0),
    userId: cellString(row, ix.user),
    userName: cellString(row, ix.user),
    timestamp: when ? when.toISOString() : '',
    date: when ? toDatePart(when) : '',
    time: when ? toTimePart(when) : '',
    stockBefore: cellNumber(row, ix.before, 0),
    stockAfter: cellNumber(row, ix.after, 0),
    inputType: cellString(row, ix.inputType),
    productName: '',   // resolved by joining Products
    remarks: cellString(row, ix.remarks),
  }
}

/**
 * Domain -> row, in TRANSACTIONS_COLUMNS order.
 * The timestamp is written to BOTH column 6 and column 11 so either position
 * reads correctly; column 10 stays blank as agreed.
 */
export function transactionToRow(t: Transaction): Row {
  const when = t.timestamp ? new Date(t.timestamp) : new Date()
  const stamp = toSheetDateTime(when)
  return [
    t.transactionId,
    t.sku,
    TRANSACTION_TYPE_TO_SHEET[t.transactionType],
    t.quantity,
    t.userId || t.userName,
    stamp,
    t.stockBefore,
    t.stockAfter,
    t.inputType || INPUT_TYPE.manual,
    '',
    stamp,
    t.remarks ?? '',
  ]
}

/** Signed effect of a transaction on stock. */
export function stockDelta(type: TransactionType, qty: number): number {
  return type === 'stock_in' ? qty : -qty
}

/**
 * Rebuild stock per SKU by replaying the ledger.
 * The ledger is append-only, so this is always the authoritative figure.
 */
export function deriveStockFromLedger(transactions: Transaction[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const t of transactions) {
    if (!t.sku) continue
    const key = t.sku.toUpperCase()
    totals.set(key, (totals.get(key) ?? 0) + stockDelta(t.transactionType, t.quantity))
  }
  return totals
}

/** `TXN-<epoch ms>`, matching the workbook's most recent convention. */
export function generateTransactionId(now: Date = new Date()): string {
  return `TXN-${now.getTime()}`
}

// ─── Users ───────────────────────────────────────────────────────────────────

const USER_ALIASES = {
  email: ['Email'], name: ['Name'], role: ['Role'],
  stockIn: ['Can_Stock_In'],
  stockOut: ['Can_Stock_Out', 'Can_Remove_Stock'],
  sell: ['Can_Sell'], edit: ['Can_Edit'], del: ['Can_Delete'],
  active: ['Active'],
}

/** Permission defaults by role, used when a flag column is missing. */
export const ROLE_DEFAULTS: Record<UserRole, {
  canStockIn: boolean; canStockOut: boolean; canSell: boolean
  canEdit: boolean; canDelete: boolean
}> = {
  admin:     { canStockIn: true,  canStockOut: true,  canSell: true,  canEdit: true,  canDelete: true  },
  warehouse: { canStockIn: true,  canStockOut: true,  canSell: false, canEdit: false, canDelete: false },
  sales:     { canStockIn: false, canStockOut: false, canSell: true,  canEdit: false, canDelete: false },
}

export function userFromRow(headerRow: Row, row: Row): User | null {
  const ix = headerIndex(headerRow, USER_ALIASES)
  const email = cellString(row, ix.email)
  if (!email) return null   // cannot sign in without an email

  const role = roleFromSheet(row[ix.role])
  const def = ROLE_DEFAULTS[role]

  return {
    id: email.toLowerCase(),
    email,
    name: cellString(row, ix.name, email),
    role,
    canStockIn:  ix.stockIn  >= 0 ? cellBool(row, ix.stockIn,  def.canStockIn)  : def.canStockIn,
    canStockOut: ix.stockOut >= 0 ? cellBool(row, ix.stockOut, def.canStockOut) : def.canStockOut,
    canSell:     ix.sell     >= 0 ? cellBool(row, ix.sell,     def.canSell)     : def.canSell,
    canEdit:     ix.edit     >= 0 ? cellBool(row, ix.edit,     def.canEdit)     : def.canEdit,
    canDelete:   ix.del      >= 0 ? cellBool(row, ix.del,      def.canDelete)   : def.canDelete,
    active:      ix.active   >= 0 ? cellBool(row, ix.active, true)              : true,
  }
}

export function userToRow(u: Omit<User, 'id'>): Row {
  const b = (v: boolean) => (v ? 1 : 0)
  return [
    u.email, u.name, roleToSheet(u.role),
    b(u.canStockIn), b(u.canStockOut), b(u.canSell), b(u.canEdit), b(u.canDelete),
    b(u.active),
  ]
}

/**
 * Find the user for a signed-in email.
 * Duplicate emails exist in the workbook (two cofounders share one address), so
 * the first active match wins, deterministically.
 */
export function findUserByEmail(users: User[], email: string): User | undefined {
  const target = email.trim().toLowerCase()
  const matches = users.filter((u) => u.email.trim().toLowerCase() === target)
  return matches.find((u) => u.active) ?? matches[0]
}

// ─── Suppliers / Customers / PreOrders ───────────────────────────────────────

export function supplierFromRow(headerRow: Row, row: Row): Supplier | null {
  const ix = headerIndex(headerRow, {
    id: ['Supplier_ID'], name: ['Name'], contact: ['Contact_Person'],
    phone: ['Phone'], email: ['Email'], address: ['Address'],
    gst: ['GST_Number'], materials: ['Materials_Supplied'], active: ['Active'],
  })
  const name = cellString(row, ix.name)
  if (!name) return null
  const mats = cellString(row, ix.materials)
  return {
    supplierId: cellString(row, ix.id),
    name,
    contactPerson: cellString(row, ix.contact),
    phone: cellString(row, ix.phone),
    email: cellString(row, ix.email),
    address: cellString(row, ix.address),
    gstNumber: cellString(row, ix.gst),
    materialsSupplied: mats ? mats.split(',').map((s) => s.trim()).filter(Boolean) : [],
  }
}

export function supplierToRow(s: Supplier): Row {
  return [
    s.supplierId, s.name, s.contactPerson, s.phone, s.email, s.address,
    s.gstNumber, s.materialsSupplied.join(', '), 1,
  ]
}

export function customerFromRow(headerRow: Row, row: Row): Customer | null {
  const ix = headerIndex(headerRow, {
    id: ['Customer_ID'], name: ['Name'], phone: ['Phone'], email: ['Email'],
    address: ['Address'], gst: ['GST_Number'], active: ['Active'],
  })
  const name = cellString(row, ix.name)
  if (!name) return null
  return {
    customerId: cellString(row, ix.id),
    name,
    phone: cellString(row, ix.phone),
    email: cellString(row, ix.email),
    address: cellString(row, ix.address),
    gstNumber: cellString(row, ix.gst),
  }
}

export function customerToRow(c: Customer): Row {
  return [c.customerId, c.name, c.phone, c.email, c.address, c.gstNumber, 1]
}

export function preOrderFromRow(headerRow: Row, row: Row): PreOrder | null {
  const ix = headerIndex(headerRow, {
    id: ['Order_ID'], customerName: ['Customer_Name'], customerId: ['Customer_ID'],
    sku: ['SKU'], productName: ['Product_Name'], qty: ['Quantity_Required'],
    entered: ['Date_Entered'], status: ['Status'],
  })
  const id = cellString(row, ix.id)
  if (!id) return null
  const entered = parseSheetDate(row[ix.entered])
  const status = cellString(row, ix.status, 'Pending').toLowerCase()
  return {
    orderId: id,
    customerName: cellString(row, ix.customerName),
    customerId: cellString(row, ix.customerId) || undefined,
    sku: cellString(row, ix.sku),
    productName: cellString(row, ix.productName),
    quantityRequired: cellNumber(row, ix.qty, 0),
    dateEntered: entered ? toDatePart(entered) : '',
    status: (status === 'fulfilled' ? 'fulfilled'
      : status === 'cancelled' ? 'cancelled' : 'pending') as PreOrderStatus,
  }
}

export function preOrderToRow(o: PreOrder): Row {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return [
    o.orderId, o.customerName, o.customerId ?? '', o.sku, o.productName,
    o.quantityRequired,
    toSheetDate(o.dateEntered ? new Date(o.dateEntered) : new Date()),
    cap(o.status),
  ]
}

/** `ORD-<epoch ms>`, consistent with transaction IDs. */
export function generateOrderId(now: Date = new Date()): string {
  return `ORD-${now.getTime()}`
}

/** A1 range covering a whole tab's columns, e.g. `Products!A:Q`. */
export function tabRange(tab: string, columnCount: number): string {
  let end = ''
  let n = columnCount
  while (n > 0) {
    const rem = (n - 1) % 26
    end = String.fromCharCode(65 + rem) + end
    n = Math.floor((n - 1) / 26)
  }
  return `${tab}!A:${end}`
}
