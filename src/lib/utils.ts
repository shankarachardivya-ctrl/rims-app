import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import type { MaterialCategory, TransactionType, UserRole } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy')
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string, timeStr: string): string {
  try {
    return `${format(parseISO(dateStr), 'dd MMM yyyy')} at ${timeStr}`
  } catch {
    return `${dateStr} ${timeStr}`
  }
}

export function nowISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function nowTime(): string {
  return new Date().toTimeString().slice(0, 8)
}

// ─── ID generators ───────────────────────────────────────────────────────────

export function generateTransactionId(): string {
  const date = format(new Date(), 'yyyyMMdd')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `TXN-${date}-${rand}`
}

export function generateOrderId(): string {
  const date = format(new Date(), 'yyyyMMdd')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `ORD-${date}-${rand}`
}

// ─── Label helpers ────────────────────────────────────────────────────────────

export function categoryLabel(cat: MaterialCategory): string {
  return cat === 'filament' ? 'Filament' : 'Resin'
}

export function unitLabel(cat: MaterialCategory): string {
  return cat === 'filament' ? 'spools' : 'bottles'
}

export function transactionLabel(type: TransactionType): string {
  switch (type) {
    case 'stock_in':    return 'Stock In'
    case 'sale':        return 'Sale'
    case 'internal_use': return 'Internal Use'
  }
}

export function transactionColor(type: TransactionType): string {
  switch (type) {
    case 'stock_in':    return 'text-emerald-400'
    case 'sale':        return 'text-blue-400'
    case 'internal_use': return 'text-amber-400'
  }
}

export function transactionBadgeColor(type: TransactionType): string {
  switch (type) {
    case 'stock_in':    return 'bg-emerald-900/50 text-emerald-300 border-emerald-700'
    case 'sale':        return 'bg-blue-900/50 text-blue-300 border-blue-700'
    case 'internal_use': return 'bg-amber-900/50 text-amber-300 border-amber-700'
  }
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':     return 'Admin'
    case 'warehouse': return 'Warehouse Operator'
    case 'sales':     return 'Sales Person'
  }
}

// ─── Stock helpers ────────────────────────────────────────────────────────────

export function isLowStock(current: number, min: number): boolean {
  return current < min
}

export function stockDeficit(current: number, min: number): number {
  return Math.max(0, min - current)
}

// ─── Product name helper ──────────────────────────────────────────────────────

export function productDisplayName(material: string, brand: string, color: string): string {
  return `${material} ${brand} ${color}`.trim()
}
