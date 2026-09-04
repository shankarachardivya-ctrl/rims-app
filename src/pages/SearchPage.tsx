import { useState, useCallback } from 'react'
import { Search, Layers, Package, MapPin, Clock, AlertTriangle, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useProductStore } from '@/store/productStore'
import { unitLabel, formatDate, isLowStock } from '@/lib/utils'
import type { Product } from '@/types'
import { TransactionDialog } from '@/components/transaction/TransactionDialog'

function FilamentIcon() {
  return (
    <div className="w-12 h-12 rounded-xl bg-violet-900/50 border border-violet-700 flex items-center justify-center shrink-0">
      <Layers className="h-6 w-6 text-violet-400" />
    </div>
  )
}

function ResinIcon() {
  return (
    <div className="w-12 h-12 rounded-xl bg-cyan-900/50 border border-cyan-700 flex items-center justify-center shrink-0">
      <Package className="h-6 w-6 text-cyan-400" />
    </div>
  )
}

function ProductInfoCard({ product, onTransact }: { product: Product; onTransact: (p: Product) => void }) {
  const unit = unitLabel(product.category)
  const low  = isLowStock(product.currentStock, product.minStock)

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {product.category === 'filament' ? <FilamentIcon /> : <ResinIcon />}

          <div className="flex-1 min-w-0">
            {/* Heading */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <h2 className="font-semibold text-white text-base leading-tight">
                {product.material} {product.brand} {product.color}
              </h2>
              {low && (
                <Badge variant="warning" className="shrink-0 gap-1">
                  <AlertTriangle className="h-3 w-3" />Low
                </Badge>
              )}
            </div>

            {/* SKU subheading */}
            <p className="text-xs font-mono text-violet-400 mb-3">{product.sku}</p>

            {/* Body info */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Current Stock</p>
                <p className="font-semibold text-white">{product.currentStock} <span className="text-slate-400 font-normal">{unit}</span></p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Min. Stock</p>
                <p className="font-semibold text-white">{product.minStock} <span className="text-slate-400 font-normal">{unit}</span></p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Purchase Price</p>
                <p className="font-semibold text-white">₹{product.purchasePrice}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Selling Price</p>
                <p className="font-semibold text-white">₹{product.sellingPrice}</p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>{product.warehouse} → Rack {product.rack} → {product.column}/{product.bin}</span>
            </div>

            {/* Last transaction */}
            {product.lastTransactionDate && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
                <Clock className="h-3 w-3 shrink-0" />
                <span>Last transaction: {formatDate(product.lastTransactionDate)}</span>
              </div>
            )}

            <Button
              size="sm"
              className="mt-3 w-full bg-violet-700 hover:bg-violet-600 gap-2"
              onClick={() => onTransact(product)}
            >
              Record Transaction
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function SearchPage() {
  const { searchResults, search, isSearching, clearSearch } = useProductStore()
  const [query, setQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [txOpen, setTxOpen] = useState(false)

  const handleSearch = useCallback(() => {
    if (query.trim()) search(query)
    else clearSearch()
  }, [query, search, clearSearch])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleTransact = (p: Product) => {
    setSelectedProduct(p)
    setTxOpen(true)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Material Search</h2>
        <p className="text-sm text-slate-400">Search by name, SKU, material, brand, or color.</p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="e.g. PLA Pro Nuclear Red or PLA-A11-KPAH"
            className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={isSearching}
          className="bg-violet-600 hover:bg-violet-700 shrink-0"
        >
          {isSearching ? 'Searching…' : 'Search'}
        </Button>
      </div>

      {/* Results */}
      {isSearching && (
        <div className="text-center py-8 text-slate-500">Searching inventory…</div>
      )}

      {!isSearching && searchResults.length === 0 && query && (
        <div className="text-center py-8 text-slate-500">
          No products found for "{query}"
        </div>
      )}

      {!isSearching && searchResults.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">{searchResults.length} result{searchResults.length > 1 ? 's' : ''} found</p>
          {searchResults.map((product) => (
            <ProductInfoCard key={product.sku} product={product} onTransact={handleTransact} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!query && searchResults.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Start typing to search your inventory</p>
        </div>
      )}

      {selectedProduct && (
        <TransactionDialog
          open={txOpen}
          onOpenChange={setTxOpen}
          product={selectedProduct}
        />
      )}
    </div>
  )
}
