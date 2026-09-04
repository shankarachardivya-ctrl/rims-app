import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search, Package, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useProductStore } from '@/store/productStore'
import { useIsAdmin } from '@/store/authStore'
import { unitLabel, isLowStock, productDisplayName } from '@/lib/utils'
import { FILAMENT_MATERIALS, RESIN_MATERIALS } from '@/lib/constants'
import { toast } from '@/hooks/useToast'
import type { Product, MaterialCategory } from '@/types'

const EMPTY: Omit<Product, 'currentStock' | 'lastTransactionDate' | 'lastTransactionType'> = {
  sku: '', category: 'filament', material: 'PLA', brand: '', color: '',
  minStock: 5, warehouse: 'Main', rack: '', column: '', bin: '',
  supplierId: '', purchasePrice: 0, sellingPrice: 0, status: 'active',
}

export function ProductsPage() {
  const { products, fetchAll, add, update, remove, isLoading } = useProductStore()
  const isAdmin = useIsAdmin()
  const [filter, setFilter]   = useState('')
  const [catFilter, setCatFilter] = useState<'all' | MaterialCategory>('all')
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing]   = useState<typeof EMPTY | null>(null)
  const [isNew, setIsNew]       = useState(false)
  const [delConfirm, setDelConfirm] = useState<Product | null>(null)

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = products.filter((p) => {
    const matchCat = catFilter === 'all' || p.category === catFilter
    const q = filter.toLowerCase()
    const matchQ = !q || productDisplayName(p.material, p.brand, p.color).toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    return matchCat && matchQ
  })

  const openNew = () => {
    setEditing({ ...EMPTY })
    setIsNew(true)
    setEditOpen(true)
  }

  const openEdit = (p: Product) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { currentStock, lastTransactionDate, lastTransactionType, supplierName, ...rest } = p as Product & { supplierName?: string }
    setEditing(rest)
    setIsNew(false)
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!editing) return
    if (!editing.sku || !editing.brand || !editing.color) {
      toast({ title: 'Missing fields', description: 'SKU, brand, and color are required.', variant: 'destructive' })
      return
    }
    if (isNew) {
      const ok = await add(editing)
      if (ok) { toast({ title: 'Product added', variant: 'success' }); setEditOpen(false) }
      else toast({ title: 'Failed to add product', variant: 'destructive' })
    } else {
      const existing = products.find((p) => p.sku === editing.sku)!
      const ok = await update({ ...existing, ...editing })
      if (ok) { toast({ title: 'Product updated', variant: 'success' }); setEditOpen(false) }
      else toast({ title: 'Failed to update', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!delConfirm) return
    const ok = await remove(delConfirm.sku)
    setDelConfirm(null)
    if (ok) toast({ title: 'Product deleted', variant: 'success' })
    else toast({ title: 'Failed to delete', variant: 'destructive' })
  }

  const materials = editing?.category === 'resin' ? RESIN_MATERIALS : FILAMENT_MATERIALS

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Products</h2>
        {isAdmin && (
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 gap-2" onClick={openNew}>
            <Plus className="h-4 w-4" />Add Product
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by name or SKU…"
            className="pl-10 bg-slate-900 border-slate-700 text-white"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'filament', 'resin'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                catFilter === c ? 'bg-violet-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {c === 'all' ? 'All' : c === 'filament' ? 'Filaments' : 'Resins'}
            </button>
          ))}
        </div>
      </div>

      {/* Product list */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading products…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{products.length === 0 ? 'No products yet. Add your first product.' : 'No products match your search.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const low = isLowStock(p.currentStock, p.minStock)
            return (
              <Card key={p.sku} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${p.category === 'filament' ? 'bg-violet-900/40' : 'bg-cyan-900/40'}`}>
                      {p.category === 'filament'
                        ? <Layers className="h-5 w-5 text-violet-400" />
                        : <Package className="h-5 w-5 text-cyan-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white text-sm">{productDisplayName(p.material, p.brand, p.color)}</span>
                        {low && <Badge variant="warning" className="text-xs">Low Stock</Badge>}
                        {p.status === 'inactive' && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                      </div>
                      <p className="text-xs font-mono text-violet-400">{p.sku}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Stock: {p.currentStock} {unitLabel(p.category)} · Min: {p.minStock} · {p.warehouse} Rack {p.rack}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => setDelConfirm(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add Product' : 'Edit Product'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3 py-2">
              <Field label="SKU *">
                <Input className="bg-slate-800 border-slate-700 text-white font-mono uppercase" value={editing.sku}
                  onChange={(e) => setEditing({ ...editing, sku: e.target.value.toUpperCase() })} disabled={!isNew} placeholder="PLA-B-RED" />
              </Field>
              <Field label="Category *">
                <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v as MaterialCategory, material: v === 'resin' ? 'Standard Resin' : 'PLA' })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="filament">Filament</SelectItem>
                    <SelectItem value="resin">Resin</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Material *">
                <Select value={editing.material} onValueChange={(v) => setEditing({ ...editing, material: v as typeof editing.material })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    {materials.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Brand *">
                <Input className="bg-slate-800 border-slate-700 text-white" value={editing.brand}
                  onChange={(e) => setEditing({ ...editing, brand: e.target.value })} placeholder="e.g. Bambu" />
              </Field>
              <Field label="Color *">
                <Input className="bg-slate-800 border-slate-700 text-white" value={editing.color}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })} placeholder="e.g. Nuclear Red" />
              </Field>
              <Field label="Min Stock">
                <Input type="number" min={0} className="bg-slate-800 border-slate-700 text-white" value={editing.minStock}
                  onChange={(e) => setEditing({ ...editing, minStock: parseInt(e.target.value) || 0 })} />
              </Field>
              <Field label="Purchase Price (₹)">
                <Input type="number" min={0} className="bg-slate-800 border-slate-700 text-white" value={editing.purchasePrice}
                  onChange={(e) => setEditing({ ...editing, purchasePrice: parseFloat(e.target.value) || 0 })} />
              </Field>
              <Field label="Selling Price (₹)">
                <Input type="number" min={0} className="bg-slate-800 border-slate-700 text-white" value={editing.sellingPrice}
                  onChange={(e) => setEditing({ ...editing, sellingPrice: parseFloat(e.target.value) || 0 })} />
              </Field>
              <Field label="Warehouse">
                <Input className="bg-slate-800 border-slate-700 text-white" value={editing.warehouse}
                  onChange={(e) => setEditing({ ...editing, warehouse: e.target.value })} placeholder="Main" />
              </Field>
              <Field label="Rack">
                <Input className="bg-slate-800 border-slate-700 text-white" value={editing.rack}
                  onChange={(e) => setEditing({ ...editing, rack: e.target.value })} placeholder="A" />
              </Field>
              <Field label="Column">
                <Input className="bg-slate-800 border-slate-700 text-white" value={editing.column}
                  onChange={(e) => setEditing({ ...editing, column: e.target.value })} placeholder="1" />
              </Field>
              <Field label="Bin">
                <Input className="bg-slate-800 border-slate-700 text-white" value={editing.bin}
                  onChange={(e) => setEditing({ ...editing, bin: e.target.value })} placeholder="B" />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="text-slate-400" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleSave}>
              {isNew ? 'Add Product' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!delConfirm} onOpenChange={(v) => { if (!v) setDelConfirm(null) }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Product?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-300">
            Are you sure you want to delete <strong>{delConfirm && productDisplayName(delConfirm.material, delConfirm.brand, delConfirm.color)}</strong>?
            This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" className="text-slate-400" onClick={() => setDelConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}
