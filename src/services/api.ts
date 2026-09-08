/**
 * API surface used by the stores and pages.
 *
 * Previously this called a Google Apps Script web app. It now delegates to
 * sheetsRepo, which talks to the Google Sheets REST API directly, so there is
 * no script to paste or deployment URL to maintain — the user signs in with
 * Google and picks their workbook.
 *
 * The ApiResponse envelope is kept so callers did not have to change.
 */

import * as repo from './sheetsRepo'
import { NoSheetError } from './sheetConfig'
import { SheetsError } from './sheetsClient'
import { GoogleAuthError } from './googleAuth'
import type {
  ApiResponse, Product, Transaction, DashboardData,
  Supplier, Customer, PreOrder, BOMItem, User,
} from '@/types'

/**
 * Run a repository call and normalise both success and failure into
 * ApiResponse, turning low-level errors into messages a user can act on.
 */
async function wrap<T>(fn: () => Promise<T>): Promise<ApiResponse<T>> {
  try {
    return { success: true, data: await fn() }
  } catch (err) {
    return { success: false, error: describeError(err) }
  }
}

function describeError(err: unknown): string {
  if (err instanceof NoSheetError) {
    return 'No inventory workbook selected. Choose your Google Sheet to continue.'
  }
  if (err instanceof GoogleAuthError) {
    return `${err.message} Sign in with Google again to continue.`
  }
  if (err instanceof SheetsError) return err.message
  if (err instanceof Error) return err.message
  return String(err)
}

// ─── Products ─────────────────────────────────────────────────────────────────

export const apiGetProduct = (sku: string) =>
  wrap(async () => {
    const p = await repo.getProduct(sku)
    if (!p) throw new Error(`No product found for SKU "${sku}".`)
    return p
  })

export const apiSearchProducts = (query: string) =>
  wrap(() => repo.searchProducts(query))

export const apiGetAllProducts = () =>
  wrap(() => repo.getAllProducts())

export const apiAddProduct = (
  product: Omit<Product, 'currentStock' | 'lastTransactionDate' | 'lastTransactionType'>
) => wrap(() => repo.addProduct(product as Omit<Product, 'currentStock'>))

export const apiUpdateProduct = (product: Product) =>
  wrap(() => repo.updateProduct(product))

export const apiDeleteProduct = (sku: string) =>
  wrap(() => repo.deleteProduct(sku))

// ─── Transactions ─────────────────────────────────────────────────────────────

export const apiPostTransaction = (
  transaction: Omit<Transaction, 'stockBefore' | 'stockAfter'>
) => wrap(() => repo.postTransaction(transaction))

export const apiGetTransactions = (params?: { sku?: string; from?: string; to?: string }) =>
  wrap(() => repo.getTransactions(params))

/** Rebuild Inventory from the append-only ledger. */
export const apiReconcileInventory = () =>
  wrap(() => repo.reconcileInventory())

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const apiGetDashboard = (): Promise<ApiResponse<DashboardData>> =>
  wrap(() => repo.getDashboard())

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const apiGetSuppliers = (): Promise<ApiResponse<Supplier[]>> =>
  wrap(() => repo.getSuppliers())

export const apiAddSupplier = (supplier: Omit<Supplier, 'supplierId'>) =>
  wrap(() => repo.addSupplier(supplier))

export const apiUpdateSupplier = (supplier: Supplier) =>
  wrap(() => repo.updateSupplier(supplier))

export const apiDeleteSupplier = (supplierId: string) =>
  wrap(() => repo.deleteSupplier(supplierId))

// ─── Customers ────────────────────────────────────────────────────────────────

export const apiGetCustomers = (): Promise<ApiResponse<Customer[]>> =>
  wrap(() => repo.getCustomers())

export const apiAddCustomer = (customer: Omit<Customer, 'customerId'>) =>
  wrap(() => repo.addCustomer(customer))

export const apiUpdateCustomer = (customer: Customer) =>
  wrap(() => repo.updateCustomer(customer))

export const apiDeleteCustomer = (customerId: string) =>
  wrap(() => repo.deleteCustomer(customerId))

// ─── Pre-Orders ───────────────────────────────────────────────────────────────

export const apiGetPreOrders = (): Promise<ApiResponse<PreOrder[]>> =>
  wrap(() => repo.getPreOrders())

export const apiPostPreOrder = (order: Omit<PreOrder, 'orderId' | 'dateEntered'>) =>
  wrap(() => repo.postPreOrder(order))

export const apiUpdatePreOrderStatus = (orderId: string, status: PreOrder['status']) =>
  wrap(() => repo.updatePreOrderStatus(orderId, status))

// ─── BOM ──────────────────────────────────────────────────────────────────────

export const apiGetBOM = (): Promise<ApiResponse<BOMItem[]>> =>
  wrap(() => repo.getBOM())

// ─── Users ────────────────────────────────────────────────────────────────────

export const apiGetUsers = (): Promise<ApiResponse<User[]>> =>
  wrap(() => repo.getUsers())

export const apiAddUser = (user: Omit<User, 'id'>) =>
  wrap(() => repo.addUser(user))

export const apiUpdateUser = (user: User) =>
  wrap(() => repo.updateUser(user))

export const apiDeleteUser = (userId: string) =>
  wrap(() => repo.deleteUser(userId))

/** Look up the signed-in Google account in the Users tab. */
export const apiFindUser = (email: string) =>
  wrap(async () => {
    const u = await repo.findUser(email)
    if (!u) throw new Error(`${email} is not listed in the Users tab of the workbook.`)
    return u
  })
