import { create } from 'zustand'
import type { Transaction } from '@/types'
import { apiPostTransaction, apiGetTransactions } from '@/services/api'

interface TransactionState {
  transactions: Transaction[]
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  lastSubmitted: Transaction | null
  fetchAll: (params?: { sku?: string; from?: string; to?: string }) => Promise<void>
  submit: (transaction: Parameters<typeof apiPostTransaction>[0]) => Promise<boolean>
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  isLoading: false,
  isSubmitting: false,
  error: null,
  lastSubmitted: null,

  fetchAll: async (params) => {
    set({ isLoading: true, error: null })
    const res = await apiGetTransactions(params)
    if (res.success && res.data) {
      set({ transactions: res.data, isLoading: false })
    } else {
      set({ isLoading: false, error: res.error ?? 'Failed to load transactions' })
    }
  },

  submit: async (transaction) => {
    set({ isSubmitting: true, error: null })
    const res = await apiPostTransaction(transaction)
    if (res.success && res.data) {
      set((state) => ({
        transactions: [res.data!, ...state.transactions],
        isSubmitting: false,
        lastSubmitted: res.data!,
      }))
      return true
    }
    set({ isSubmitting: false, error: res.error ?? 'Transaction failed' })
    return false
  },
}))
