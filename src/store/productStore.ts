import { create } from 'zustand'
import type { Product } from '@/types'
import {
  apiGetAllProducts,
  apiAddProduct,
  apiUpdateProduct,
  apiDeleteProduct,
  apiSearchProducts,
} from '@/services/api'

interface ProductState {
  products: Product[]
  searchResults: Product[]
  isLoading: boolean
  isSearching: boolean
  error: string | null
  fetchAll: () => Promise<void>
  search: (query: string) => Promise<void>
  /** Returns the created product (truthy) or null on failure. */
  add: (product: Parameters<typeof apiAddProduct>[0]) => Promise<Product | null>
  update: (product: Product) => Promise<boolean>
  remove: (sku: string) => Promise<boolean>
  clearSearch: () => void
}

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  searchResults: [],
  isLoading: false,
  isSearching: false,
  error: null,

  fetchAll: async () => {
    set({ isLoading: true, error: null })
    const res = await apiGetAllProducts()
    if (res.success && res.data) {
      set({ products: res.data, isLoading: false })
    } else {
      set({ isLoading: false, error: res.error ?? 'Failed to load products' })
    }
  },

  search: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [] })
      return
    }
    set({ isSearching: true })
    const res = await apiSearchProducts(query)
    if (res.success && res.data) {
      set({ searchResults: res.data, isSearching: false })
    } else {
      set({ isSearching: false, searchResults: [] })
    }
  },

  add: async (product) => {
    const res = await apiAddProduct(product)
    if (res.success && res.data) {
      const created = res.data
      set((state) => ({ products: [...state.products, created] }))
      return created
    }
    return null
  },

  update: async (product) => {
    const res = await apiUpdateProduct(product)
    if (res.success) {
      set((state) => ({
        products: state.products.map((p) => (p.sku === product.sku ? product : p)),
      }))
      return true
    }
    return false
  },

  remove: async (sku) => {
    const res = await apiDeleteProduct(sku)
    if (res.success) {
      set((state) => ({ products: state.products.filter((p) => p.sku !== sku) }))
      return true
    }
    return false
  },

  clearSearch: () => set({ searchResults: [] }),
}))
