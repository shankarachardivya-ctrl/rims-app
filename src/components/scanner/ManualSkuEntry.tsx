import { useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiGetProduct } from '@/services/api'
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
    if (!sku.trim()) return
    setLoading(true)
    setError('')
    const res = await apiGetProduct(sku.trim().toUpperCase())
    setLoading(false)
    if (res.success && res.data) {
      onProductFound(res.data)
    } else {
      setError(`No product found for SKU: "${sku.trim().toUpperCase()}"`)
    }
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
          placeholder="e.g. PLA-A11-KPAH"
          className="bg-slate-800 border-slate-700 text-white font-mono uppercase placeholder:text-slate-500"
          value={sku}
          onChange={(e) => { setSku(e.target.value.toUpperCase()); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') lookup() }}
          autoFocus
        />
        <p className="text-xs text-slate-500">SKU codes are uppercase letters and numbers separated by dashes.</p>
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
