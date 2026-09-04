/**
 * API Service — communicates with Google Apps Script web app endpoints.
 * All requests go through the deployed Apps Script URL via HTTP GET/POST.
 */

import { APPS_SCRIPT_URL } from '@/lib/constants'
import type {
  ApiResponse,
  Product,
  Transaction,
  DashboardData,
  Supplier,
  Customer,
  PreOrder,
  BOMItem,
  User,
} from '@/types'

async function get<T>(action: string, params: Record<string, string> = {}): Promise<ApiResponse<T>> {
  try {
    const url = new URL(APPS_SCRIPT_URL)
    url.searchParams.set('action', action)
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    return json as ApiResponse<T>
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

async function post<T>(action: string, body: unknown): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action }, body as object)),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    return json as ApiResponse<T>
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ─── Products ─────────────────────────────────────────────────────────────────

export const apiGetProduct = (sku: string) =>
  get<Product>('getProduct', { sku })

export const apiSearchProducts = (query: string) =>
  get<Product[]>('searchProducts', { query })

export const apiGetAllProducts = () =>
  get<Product[]>('getAllProducts')

export const apiAddProduct = (product: Omit<Product, 'currentStock' | 'lastTransactionDate' | 'lastTransactionType'>) =>
  post<Product>('addProduct', { product })

export const apiUpdateProduct = (product: Product) =>
  post<Product>('updateProduct', { product })

export const apiDeleteProduct = (sku: string) =>
  post<void>('deleteProduct', { sku })

// ─── Transactions ─────────────────────────────────────────────────────────────

export const apiPostTransaction = (transaction: Omit<Transaction, 'stockBefore' | 'stockAfter'>) =>
  post<Transaction>('postTransaction', { transaction })

export const apiGetTransactions = (params?: { sku?: string; from?: string; to?: string }) =>
  get<Transaction[]>('getTransactions', params as Record<string, string>)

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const apiGetDashboard = () =>
  get<DashboardData>('getDashboard')

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const apiGetSuppliers = () =>
  get<Supplier[]>('getSuppliers')

export const apiAddSupplier = (supplier: Omit<Supplier, 'supplierId'>) =>
  post<Supplier>('addSupplier', { supplier })

export const apiUpdateSupplier = (supplier: Supplier) =>
  post<Supplier>('updateSupplier', { supplier })

export const apiDeleteSupplier = (supplierId: string) =>
  post<void>('deleteSupplier', { supplierId })

// ─── Customers ────────────────────────────────────────────────────────────────

export const apiGetCustomers = () =>
  get<Customer[]>('getCustomers')

export const apiAddCustomer = (customer: Omit<Customer, 'customerId'>) =>
  post<Customer>('addCustomer', { customer })

export const apiUpdateCustomer = (customer: Customer) =>
  post<Customer>('updateCustomer', { customer })

export const apiDeleteCustomer = (customerId: string) =>
  post<void>('deleteCustomer', { customerId })

// ─── Pre-Orders ───────────────────────────────────────────────────────────────

export const apiGetPreOrders = () =>
  get<PreOrder[]>('getPreOrders')

export const apiPostPreOrder = (order: Omit<PreOrder, 'orderId' | 'dateEntered'>) =>
  post<PreOrder>('postPreOrder', { order })

export const apiUpdatePreOrderStatus = (orderId: string, status: PreOrder['status']) =>
  post<void>('updatePreOrderStatus', { orderId, status })

// ─── BOM ──────────────────────────────────────────────────────────────────────

export const apiGetBOM = () =>
  get<BOMItem[]>('getBOM')

// ─── Users ────────────────────────────────────────────────────────────────────

export const apiGetUsers = () =>
  get<User[]>('getUsers')

export const apiAddUser = (user: Omit<User, 'id'>) =>
  post<User>('addUser', { user })

export const apiUpdateUser = (user: User) =>
  post<User>('updateUser', { user })

export const apiDeleteUser = (userId: string) =>
  post<void>('deleteUser', { userId })
