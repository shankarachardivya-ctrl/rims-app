import { useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiGetProduct } from '@/services/api'
import { skuVariants } from '@/lib/skuExtract'
import type { Product } from '@/types'

interface ManualSkuEntryProps {
  onProductFound: (product: Product) => void
  onBack: () => void
}

export function ManualSkuEntry({ onProductFound, onBack }: ManualSkuEntryProps) {
  const [sku, setSku]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const lookup = async () => {
    const value = sku.trim().toUpperCase()
    if (!value) return
    setLoading(true)
    setError('')

    // Retry OCR/typing confusion variants (O/0, I/1, S/5, B/8, Z/2)
    for (const attempt of skuVariants(value)) {
      const res = await apiGetProduct(attempt)
      if (res.success && res.data) {
        setLoading(false)
        onProductFound(res.data)
        return
      }
    }
    setLoading(false)
    setError(`No product found for SKU: "${value}"`)
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" />Back
      </Button>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300" htmlFor="sku-input">
          Enter SKU Code
        </label>
        <Input
          id="sku-input"
          placeholder="e.g. PPNA11KPAL"
          className="bg-slate-800 border-slate-700 text-white font-mono uppercase placeholder:text-slate-500"
          value={sku}
          onChange={(e) => { setSku(e.target.value.toUpperCase()); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') lookup() }}
          autoFocus
        />
        <p className="text-xs text-slate-500">
          Uppercase letters and numbers, e.g. PPNA11KPAL. Dashes are optional.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <Button
        className="w-full bg-amber-600 hover:bg-amber-700"
        onClick={lookup}
        disabled={!sku.trim() || loading}
      >
        {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Looking up…</> : 'Look Up Product'}
      </Button>
    </div>
  )
}
