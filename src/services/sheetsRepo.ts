/**
 * Repository over the Real3D workbook.
 *
 * Design notes
 *  - Transactions are APPEND-ONLY. Two users writing at once cannot lose an
 *    entry, which is what replaces server-side locking.
 *  - Inventory is a fast cache of Current_Stock, updated after each append.
 *    The ledger remains authoritative, so `reconcileInventory` can always
 *    rebuild exact figures if a cache write is missed.
 *  - Products/Inventory are read together and briefly cached, because most
 *    screens need both.
 */

import {
  TAB, PRODUCTS_COLUMNS, TRANSACTIONS_COLUMNS, INVENTORY_COLUMNS,
  USERS_COLUMNS, SUPPLIERS_COLUMNS, CUSTOMERS_COLUMNS, PREORDERS_COLUMNS,
  productFromRow, productToRow, inventoryFromRow, inventoryToRow,
  transactionFromRow, transactionToRow, userFromRow, userToRow,
  supplierFromRow, supplierToRow, customerFromRow, customerToRow,
  preOrderFromRow, preOrderToRow,
  deriveStockFromLedger, stockDelta, stockStatus, tabRange,
  generateOrderId, findUserByEmail,
  type Row,
} from '@/lib/sheetSchema'
import {
  getValues, batchGetValues, appendRows, updateValues, clearValues,
} from './sheetsClient'
import { requireSpreadsheetId } from './sheetConfig'
import { productDisplayName } from '@/lib/utils'
import type {
  Product, Transaction, User, Supplier, Customer, PreOrder,
  DashboardData, BOMItem, StockSummaryItem, LowStockAlert, TrendDataPoint,
} from '@/types'

// ─── Caching ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 20_000

interface Catalogue {
  products: Product[]
  bySku: Map<string, Product>
  fetchedAt: number
}
let catalogue: Catalogue | null = null

/** Drop caches so the next read hits the sheet. Call after any write. */
export function invalidateCache(): void {
  catalogue = null
}

function rangeFor(tab: string, columns: readonly string[]): string {
  return tabRange(tab, columns.length)
}

/** Header row plus data rows, split. */
function splitRows(rows: Row[]): { header: Row; data: Row[] } {
  if (rows.length === 0) return { header: [], data: [] }
  return { header: rows[0], data: rows.slice(1) }
}

// ─── Products + Inventory ────────────────────────────────────────────────────

/**
 * Products joined with Inventory stock levels.
 * A product with no Inventory row reads as zero stock rather than failing.
 */
export async function loadCatalogue(force = false): Promise<Product[]> {
  if (!force && catalogue && Date.now() - catalogue.fetchedAt < CACHE_TTL_MS) {
    return catalogue.products
  }

  const id = requireSpreadsheetId()
  const [prodRows, invRows] = await batchGetValues(id, [
    rangeFor(TAB.products, PRODUCTS_COLUMNS),
    rangeFor(TAB.inventory, INVENTORY_COLUMNS),
  ])

  const p = splitRows(prodRows)
  const products: Product[] = []
  for (const row of p.data) {
    const parsed = productFromRow(p.header, row)
    if (parsed) products.push(parsed)
  }

  const inv = splitRows(invRows)
  const stock = new Map<string, number>()
  for (const row of inv.data) {
    const r = inventoryFromRow(inv.header, row)
    if (r) stock.set(r.sku.toUpperCase(), r.currentStock)
  }

  for (const prod of products) {
    prod.currentStock = stock.get(prod.sku.toUpperCase()) ?? 0
  }

  const bySku = new Map<string, Product>()
  products.forEach((x) => bySku.set(x.sku.toUpperCase(), x))
  catalogue = { products, bySku, fetchedAt: Date.now() }
  return products
}

export async function getAllProducts(): Promise<Product[]> {
  return loadCatalogue()
}

export async function getProduct(sku: string): Promise<Product | null> {
  const all = await loadCatalogue()
  const key = sku.trim().toUpperCase()
  return all.find((p) => p.sku.toUpperCase() === key) ?? null
}

export async function searchProducts(query: string): Promise<Product[]> {
  const all = await loadCatalogue()
  const q = query.trim().toLowerCase()
  if (!q) return []
  return all.filter((p) =>
    p.sku.toLowerCase().includes(q) ||
    productDisplayName(p.material, p.brand, p.color).toLowerCase().includes(q)
  )
}

export async function addProduct(
  product: Omit<Product, 'currentStock'>
): Promise<Product> {
  const id = requireSpreadsheetId()
  const existing = await getProduct(product.sku)
  if (existing) {
    throw new Error(`SKU ${product.sku} already exists in Products.`)
  }

  await appendRows(id, `${TAB.products}!A1`, [productToRow(product)])

  // Seed an Inventory row at zero so the SKU is visible to stock reports
  const created: Product = { ...product, currentStock: 0 }
  await appendRows(id, `${TAB.inventory}!A1`, [inventoryToRow(created, 0)])

  invalidateCache()
  return created
}

export async function updateProduct(product: Product): Promise<Product> {
  const id = requireSpreadsheetId()
  const rows = await getValues(id, rangeFor(TAB.products, PRODUCTS_COLUMNS))
  const { header, data } = splitRows(rows)
  const key = product.sku.trim().toUpperCase()

  const idx = data.findIndex((r) => {
    const p = productFromRow(header, r)
    return p && p.sku.toUpperCase() === key
  })
  if (idx === -1) throw new Error(`SKU ${product.sku} not found in Products.`)

  // +2 because the sheet is 1-based and row 1 is the header
  const rowNumber = idx + 2
  await updateValues(id, `${TAB.products}!A${rowNumber}`, [productToRow(product)])
  invalidateCache()
  return product
}

/**
 * Remove a product.
 * Its transaction history is untouched — the ledger is never rewritten.
 */
export async function deleteProduct(sku: string): Promise<void> {
  const id = requireSpreadsheetId()
  const key = sku.trim().toUpperCase()

  await removeRowByKey(id, TAB.products, PRODUCTS_COLUMNS, (row, header) => {
    const p = productFromRow(header, row)
    return Boolean(p && p.sku.toUpperCase() === key)
  })
  await removeRowByKey(id, TAB.inventory, INVENTORY_COLUMNS, (row, header) => {
    const r = inventoryFromRow(header, row)
    return Boolean(r && r.sku.toUpperCase() === key)
  })

  invalidateCache()
}

/**
 * Delete matching rows by rewriting the tab's data region.
 *
 * Only used for reference data (products, suppliers, customers, users), never
 * for Transactions.
 */
async function removeRowByKey(
  spreadsheetId: string,
  tab: string,
  columns: readonly string[],
  matches: (row: Row, header: Row) => boolean
): Promise<void> {
  const range = rangeFor(tab, columns)
  const rows = await getValues(spreadsheetId, range)
  const { header, data } = splitRows(rows)
  if (header.length === 0) return

  const kept = data.filter((r) => !matches(r, header))
  if (kept.length === data.length) return   // nothing matched

  await clearValues(spreadsheetId, `${tab}!A2:${lastColumnLetter(columns.length)}`)
  if (kept.length > 0) {
    await updateValues(spreadsheetId, `${tab}!A2`, kept)
  }
}

function lastColumnLetter(count: number): string {
  let end = ''
  let n = count
  while (n > 0) {
    const rem = (n - 1) % 26
    end = String.fromCharCode(65 + rem) + end
    n = Math.floor((n - 1) / 26)
  }
  return end
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function getTransactions(params?: {
  sku?: string
}): Promise<Transaction[]> {
  const id = requireSpreadsheetId()
  const rows = await getValues(id, rangeFor(TAB.transactions, TRANSACTIONS_COLUMNS))
  const { header, data } = splitRows(rows)

  const products = await loadCatalogue()
  const bySku = new Map(products.map((p) => [p.sku.toUpperCase(), p]))

  const out: Transaction[] = []
  for (const row of data) {
    const t = transactionFromRow(header, row)
    if (!t) continue
    if (params?.sku && t.sku.toUpperCase() !== params.sku.toUpperCase()) continue
    const p = bySku.get(t.sku.toUpperCase())
    // productName is not stored in the sheet; resolve it for display
    t.productName = p ? productDisplayName(p.material, p.brand, p.color) : t.sku
    out.push(t)
  }

  // Newest first
  out.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
  return out
}

/**
 * Record a transaction.
 *
 * Order matters: append the ledger row FIRST, then refresh the Inventory cache.
 * If the second step fails the ledger is still correct and reconcile can repair
 * the cache. Doing it the other way round could lose the movement entirely.
 */
export async function postTransaction(
  tx: Omit<Transaction, 'stockBefore' | 'stockAfter'>
): Promise<Transaction> {
  const id = requireSpreadsheetId()

  const product = await getProduct(tx.sku)
  if (!product) throw new Error(`SKU ${tx.sku} is not in Products.`)

  const before = product.currentStock
  const delta = stockDelta(tx.transactionType, tx.quantity)
  const after = before + delta

  if (tx.quantity <= 0 || !Number.isInteger(tx.quantity)) {
    throw new Error('Quantity must be a whole number greater than zero.')
  }
  if (after < 0) {
    const unit = product.category === 'filament' ? 'spools' : 'bottles'
    throw new Error(
      `Not enough stock: ${before} ${unit} available, tried to remove ${tx.quantity}.`
    )
  }

  const complete: Transaction = { ...tx, stockBefore: before, stockAfter: after }
  await appendRows(id, `${TAB.transactions}!A1`, [transactionToRow(complete)])

  // Update the Inventory cache for this SKU
  try {
    await writeInventoryStock(id, product, after)
  } catch {
    // Ledger is safe; the cache will be corrected by reconcileInventory.
  }

  invalidateCache()
  return complete
}

/** Write a single SKU's stock into the Inventory tab. */
async function writeInventoryStock(
  spreadsheetId: string,
  product: Product,
  stock: number
): Promise<void> {
  const range = rangeFor(TAB.inventory, INVENTORY_COLUMNS)
  const rows = await getValues(spreadsheetId, range)
  const { header, data } = splitRows(rows)
  const key = product.sku.toUpperCase()

  const idx = data.findIndex((r) => {
    const row = inventoryFromRow(header, r)
    return row && row.sku.toUpperCase() === key
  })

  const payload = inventoryToRow(product, stock)
  if (idx === -1) {
    await appendRows(spreadsheetId, `${TAB.inventory}!A1`, [payload])
  } else {
    await updateValues(spreadsheetId, `${TAB.inventory}!A${idx + 2}`, [payload])
  }
}

/**
 * Rebuild the whole Inventory tab from the ledger.
 * The ledger is append-only, so this always yields the true figures.
 */
export async function reconcileInventory(): Promise<number> {
  const id = requireSpreadsheetId()
  const [txRows] = await batchGetValues(id, [
    rangeFor(TAB.transactions, TRANSACTIONS_COLUMNS),
  ])
  const tx = splitRows(txRows)
  const ledger: Transaction[] = []
  for (const row of tx.data) {
    const t = transactionFromRow(tx.header, row)
    if (t) ledger.push(t)
  }

  const totals = deriveStockFromLedger(ledger)
  const products = await loadCatalogue(true)

  const rows = products.map((p) =>
    inventoryToRow(p, totals.get(p.sku.toUpperCase()) ?? 0)
  )

  await clearValues(id, `${TAB.inventory}!A2:${lastColumnLetter(INVENTORY_COLUMNS.length)}`)
  if (rows.length) await updateValues(id, `${TAB.inventory}!A2`, rows)

  invalidateCache()
  return rows.length
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  const id = requireSpreadsheetId()
  const rows = await getValues(id, rangeFor(TAB.users, USERS_COLUMNS))
  const { header, data } = splitRows(rows)
  const out: User[] = []
  for (const row of data) {
    const u = userFromRow(header, row)
    if (u) out.push(u)
  }
  return out
}

/** Resolve a signed-in Google email against the Users tab. */
export async function findUser(email: string): Promise<User | undefined> {
  const users = await getUsers()
  return findUserByEmail(users, email)
}

export async function addUser(user: Omit<User, 'id'>): Promise<User> {
  const id = requireSpreadsheetId()
  await appendRows(id, `${TAB.users}!A1`, [userToRow(user)])
  return { ...user, id: user.email.toLowerCase() }
}

export async function updateUser(user: User): Promise<User> {
  const id = requireSpreadsheetId()
  const rows = await getValues(id, rangeFor(TAB.users, USERS_COLUMNS))
  const { header, data } = splitRows(rows)
  const key = user.email.trim().toLowerCase()

  const idx = data.findIndex((r) => {
    const u = userFromRow(header, r)
    return u && u.email.trim().toLowerCase() === key
  })
  if (idx === -1) throw new Error(`User ${user.email} not found.`)

  await updateValues(id, `${TAB.users}!A${idx + 2}`, [userToRow(user)])
  return user
}

export async function deleteUser(userId: string): Promise<void> {
  const id = requireSpreadsheetId()
  const key = userId.trim().toLowerCase()
  await removeRowByKey(id, TAB.users, USERS_COLUMNS, (row, header) => {
    const u = userFromRow(header, row)
    return Boolean(u && (u.id === key || u.email.toLowerCase() === key))
  })
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

export async function getSuppliers(): Promise<Supplier[]> {
  const id = requireSpreadsheetId()
  const rows = await getValues(id, rangeFor(TAB.suppliers, SUPPLIERS_COLUMNS))
  const { header, data } = splitRows(rows)
  const out: Supplier[] = []
  for (const row of data) {
    const s = supplierFromRow(header, row)
    if (s) out.push(s)
  }
  return out
}

export async function addSupplier(
  supplier: Omit<Supplier, 'supplierId'>
): Promise<Supplier> {
  const id = requireSpreadsheetId()
  const created: Supplier = { ...supplier, supplierId: `SUP-${Date.now()}` }
  await appendRows(id, `${TAB.suppliers}!A1`, [supplierToRow(created)])
  return created
}

export async function updateSupplier(supplier: Supplier): Promise<Supplier> {
  const id = requireSpreadsheetId()
  const rows = await getValues(id, rangeFor(TAB.suppliers, SUPPLIERS_COLUMNS))
  const { header, data } = splitRows(rows)
  const idx = data.findIndex((r) => {
    const s = supplierFromRow(header, r)
    return s && s.supplierId === supplier.supplierId
  })
  if (idx === -1) throw new Error('Supplier not found.')
  await updateValues(id, `${TAB.suppliers}!A${idx + 2}`, [supplierToRow(supplier)])
  return supplier
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  const id = requireSpreadsheetId()
  await removeRowByKey(id, TAB.suppliers, SUPPLIERS_COLUMNS, (row, header) => {
    const s = supplierFromRow(header, row)
    return Boolean(s && s.supplierId === supplierId)
  })
}

// ─── Customers ───────────────────────────────────────────────────────────────

export async function getCustomers(): Promise<Customer[]> {
  const id = requireSpreadsheetId()
  const rows = await getValues(id, rangeFor(TAB.customers, CUSTOMERS_COLUMNS))
  const { header, data } = splitRows(rows)
  const out: Customer[] = []
  for (const row of data) {
    const c = customerFromRow(header, row)
    if (c) out.push(c)
  }
  return out
}

export async function addCustomer(
  customer: Omit<Customer, 'customerId'>
): Promise<Customer> {
  const id = requireSpreadsheetId()
  const created: Customer = { ...customer, customerId: `CUS-${Date.now()}` }
  await appendRows(id, `${TAB.customers}!A1`, [customerToRow(created)])
  return created
}

export async function updateCustomer(customer: Customer): Promise<Customer> {
  const id = requireSpreadsheetId()
  const rows = await getValues(id, rangeFor(TAB.customers, CUSTOMERS_COLUMNS))
  const { header, data } = splitRows(rows)
  const idx = data.findIndex((r) => {
    const c = customerFromRow(header, r)
    return c && c.customerId === customer.customerId
  })
  if (idx === -1) throw new Error('Customer not found.')
  await updateValues(id, `${TAB.customers}!A${idx + 2}`, [customerToRow(customer)])
  return customer
}

export async function deleteCustomer(customerId: string): Promise<void> {
  const id = requireSpreadsheetId()
  await removeRowByKey(id, TAB.customers, CUSTOMERS_COLUMNS, (row, header) => {
    const c = customerFromRow(header, row)
    return Boolean(c && c.customerId === customerId)
  })
}

// ─── Pre-orders ──────────────────────────────────────────────────────────────

export async function getPreOrders(): Promise<PreOrder[]> {
  const id = requireSpreadsheetId()
  const rows = await getValues(id, rangeFor(TAB.preOrders, PREORDERS_COLUMNS))
  const { header, data } = splitRows(rows)
  const out: PreOrder[] = []
  for (const row of data) {
    const o = preOrderFromRow(header, row)
    if (o) out.push(o)
  }
  return out
}

export async function postPreOrder(
  order: Omit<PreOrder, 'orderId' | 'dateEntered'>
): Promise<PreOrder> {
  const id = requireSpreadsheetId()
  const created: PreOrder = {
    ...order,
    orderId: generateOrderId(),
    dateEntered: new Date().toISOString().slice(0, 10),
  }
  await appendRows(id, `${TAB.preOrders}!A1`, [preOrderToRow(created)])
  return created
}

export async function updatePreOrderStatus(
  orderId: string,
  status: PreOrder['status']
): Promise<void> {
  const id = requireSpreadsheetId()
  const rows = await getValues(id, rangeFor(TAB.preOrders, PREORDERS_COLUMNS))
  const { header, data } = splitRows(rows)
  const idx = data.findIndex((r) => {
    const o = preOrderFromRow(header, r)
    return o && o.orderId === orderId
  })
  if (idx === -1) throw new Error('Pre-order not found.')

  const existing = preOrderFromRow(header, data[idx])
  if (!existing) throw new Error('Pre-order could not be read.')
  await updateValues(
    id, `${TAB.preOrders}!A${idx + 2}`, [preOrderToRow({ ...existing, status })]
  )
}

// ─── Dashboard + BOM ─────────────────────────────────────────────────────────

export async function getDashboard(): Promise<DashboardData> {
  const products = await loadCatalogue()
  const transactions = await getTransactions()

  // Stock totals per material
  const byMaterial = new Map<string, StockSummaryItem>()
  for (const p of products) {
    const key = `${p.category}|${p.material}`
    const entry = byMaterial.get(key)
    if (entry) {
      entry.totalStock += p.currentStock
    } else {
      byMaterial.set(key, {
        material: String(p.material),
        category: p.category,
        totalStock: p.currentStock,
        unit: p.category === 'filament' ? 'spools' : 'bottles',
      })
    }
  }

  const lowStockAlerts: LowStockAlert[] = products
    .filter((p) => p.currentStock < p.minStock)
    .map((p) => ({
      sku: p.sku,
      productName: productDisplayName(p.material, p.brand, p.color),
      category: p.category,
      currentStock: p.currentStock,
      minStock: p.minStock,
      deficit: Math.max(0, p.minStock - p.currentStock),
    }))
    .sort((a, b) => b.deficit - a.deficit)

  // 14-day movement trend
  const trend = new Map<string, TrendDataPoint>()
  const today = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    trend.set(iso, {
      date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      stockIn: 0, sales: 0, internalUse: 0,
    })
  }
  for (const t of transactions) {
    const point = trend.get(t.date)
    if (!point) continue
    if (t.transactionType === 'stock_in') point.stockIn += t.quantity
    else if (t.transactionType === 'sale') point.sales += t.quantity
    else point.internalUse += t.quantity
  }

  const todayIso = today.toISOString().slice(0, 10)

  return {
    stockSummary: Array.from(byMaterial.values())
      .sort((a, b) => b.totalStock - a.totalStock),
    lowStockAlerts,
    trendData: Array.from(trend.values()),
    recentTransactions: transactions.slice(0, 8),
    totalFilamentSkus: products.filter((p) => p.category === 'filament').length,
    totalResinSkus: products.filter((p) => p.category === 'resin').length,
    totalTransactionsToday: transactions.filter((t) => t.date === todayIso).length,
  }
}

export async function getBOM(): Promise<BOMItem[]> {
  const products = await loadCatalogue()
  const preOrders = await getPreOrders()

  const pending = new Map<string, number>()
  for (const o of preOrders) {
    if (o.status !== 'pending') continue
    const key = o.sku.toUpperCase()
    pending.set(key, (pending.get(key) ?? 0) + o.quantityRequired)
  }

  return products
    .map((p) => {
      const deficit = Math.max(0, p.minStock - p.currentStock)
      const preOrderQty = pending.get(p.sku.toUpperCase()) ?? 0
      const totalRequired = deficit + preOrderQty
      return {
        sku: p.sku,
        productName: productDisplayName(p.material, p.brand, p.color),
        material: String(p.material),
        color: p.color,
        category: p.category,
        currentStock: p.currentStock,
        minStock: p.minStock,
        deficit,
        preOrderQty,
        totalRequired,
        toOrder: totalRequired,
      }
    })
    .filter((i) => i.deficit > 0 || i.preOrderQty > 0)
    .sort((a, b) => b.toOrder - a.toOrder)
}

/** Current stock status text for a SKU, used by the scanner. */
export function statusFor(product: Product): string {
  return stockStatus(product.currentStock, product.minStock)
}
