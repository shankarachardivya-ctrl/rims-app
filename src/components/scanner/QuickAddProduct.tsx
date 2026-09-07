import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, PackagePlus, AlertTriangle, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useProductStore } from '@/store/productStore'
import { useCanStockIn } from '@/store/authStore'
import { isBarcodeNumber } from '@/lib/skuExtract'
import {
  FILAMENT_MATERIALS, RESIN_MATERIALS, COMMON_COLORS,
} from '@/lib/constants'
import { productDisplayName } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import type { Product, MaterialCategory, MaterialType } from '@/types'

interface QuickAddProductProps {
  /** SKU read from the label. Never a retail barcode — callers must filter those out. */
  initialSku: string
  onCreated: (product: Product) => void
  onBack: () => void
}

/**
 * Minimum stock defaults by category.
 *
 * A product created with minStock 0 can never trigger a low-stock alert
 * (isLowStock is `current < min`) and would be invisible to the BOM report,
 * so a sensible non-zero default matters.
 */
const DEFAULT_MIN_STOCK: Record<MaterialCategory, number> = {
  filament: 5,
  resin: 3,
}

export function QuickAddProduct({ initialSku, onCreated, onBack }: QuickAddProductProps) {
  const canStockIn = useCanStockIn()
  const { products, fetchAll, add } = useProductStore()

  const [sku, setSku]             = useState(initialSku.trim().toUpperCase())
  const [category, setCategory]   = useState<MaterialCategory>('filament')
  const [material, setMaterial]   = useState<MaterialType>('PLA')
  const [brand, setBrand]         = useState('')
  const [color, setColor]         = useState('')
  const [warehouse, setWarehouse] = useState('Main')
  const [rack, setRack]           = useState('')
  const [column, setColumn]       = useState('')
  const [bin, setBin]             = useState('')
  const [minStock, setMinStock]   = useState(String(DEFAULT_MIN_STOCK.filament))
  const [purchasePrice, setPurchasePrice] = useState('')
  const [saving, setSaving]       = useState(false)

  // Load the catalogue so we can warn about likely duplicates before creating.
  useEffect(() => { fetchAll() }, [fetchAll])

  const materials = category === 'resin' ? RESIN_MATERIALS : FILAMENT_MATERIALS

  const changeCategory = (next: MaterialCategory) => {
    setCategory(next)
    setMaterial(next === 'resin' ? 'Standard Resin' : 'PLA')
    setMinStock(String(DEFAULT_MIN_STOCK[next]))
  }

  /** Existing product with the same SKU — a hard block. */
  const skuClash = useMemo(
    () => products.find((p) => p.sku.toUpperCase() === sku.trim().toUpperCase()),
    [products, sku]
  )

  /**
   * Existing product with the same material + brand + colour under a different
   * SKU. This is the duplicate case that barcode/SKU mismatches cause, so warn
   * loudly but still allow it — legitimately different SKUs can share these.
   */
  const likelyDuplicate = useMemo(() => {
    if (!brand.trim() || !color.trim()) return undefined
    const key = `${material}|${brand.trim()}|${color.trim()}`.toLowerCase()
    return products.find(
      (p) =>
        p.sku.toUpperCase() !== sku.trim().toUpperCase() &&
        `${p.material}|${p.brand}|${p.color}`.toLowerCase() === key
    )
  }, [products, material, brand, color, sku])

  if (!canStockIn) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
        <div className="text-center py-8 space-y-3">
          <ShieldOff className="h-10 w-10 mx-auto text-slate-600" />
          <p className="font-medium text-white">Not permitted</p>
          <p className="text-sm text-slate-400">
            Your role cannot add new stock. Ask an admin or a warehouse operator to
            create this product.
          </p>
          <p className="text-xs font-mono text-violet-400">{sku}</p>
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    const cleanSku = sku.trim().toUpperCase()

    if (!cleanSku || !brand.trim() || !color.trim()) {
      toast({ title: 'Missing fields', description: 'SKU, brand, and colour are required.', variant: 'destructive' })
      return
    }
    // Guard against the exact failure mode we are trying to prevent.
    if (isBarcodeNumber(cleanSku)) {
      toast({
        title: 'That is a barcode, not a SKU',
        description: 'Enter the SKU printed on the label instead.',
        variant: 'destructive',
      })
      return
    }
    if (skuClash) {
      toast({
        title: 'SKU already exists',
        description: `${productDisplayName(skuClash.material, skuClash.brand, skuClash.color)} already uses ${skuClash.sku}.`,
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    const created = await add({
      sku: cleanSku,
      category,
      material,
      brand: brand.trim(),
      color: color.trim(),
      minStock: parseInt(minStock, 10) || DEFAULT_MIN_STOCK[category],
      warehouse: warehouse.trim() || 'Main',
      rack: rack.trim(),
      column: column.trim(),
      bin: bin.trim(),
      supplierId: '',
      purchasePrice: parseFloat(purchasePrice) || 0,
      sellingPrice: 0,
      status: 'active',
    })
    setSaving(false)

    if (created) {
      toast({ title: 'Product added', description: 'Now record the opening stock.', variant: 'success' })
      onCreated(created)
    } else {
      toast({
        title: 'Could not add product',
        description: 'The inventory backend did not accept the request.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" />Back
      </Button>

      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-emerald-900/40 border border-emerald-800 shrink-0">
          <PackagePlus className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <p className="font-medium text-white text-sm">New product</p>
          <p className="text-xs text-slate-400">
            Enter what is printed on the label. Prices and supplier can be completed later.
          </p>
        </div>
      </div>

      {skuClash && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              SKU <span className="font-mono">{skuClash.sku}</span> already exists as{' '}
              {productDisplayName(skuClash.material, skuClash.brand, skuClash.color)}. Go back and
              scan again to record a transaction against it.
            </span>
          </p>
        </div>
      )}

      {!skuClash && likelyDuplicate && (
        <div className="bg-amber-900/25 border border-amber-800 rounded-lg p-3">
          <p className="text-sm text-amber-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <span className="font-mono">{likelyDuplicate.sku}</span> is already{' '}
              {productDisplayName(likelyDuplicate.material, likelyDuplicate.brand, likelyDuplicate.color)}.
              Make sure this is genuinely a different product.
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU *" className="col-span-2">
          <Input
            className="bg-slate-800 border-slate-700 text-white font-mono uppercase"
            value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
            placeholder="PPNA11KPAL"
          />
        </Field>

        <Field label="Category *">
          <Select value={category} onValueChange={(v) => changeCategory(v as MaterialCategory)}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              <SelectItem value="filament">Filament</SelectItem>
              <SelectItem value="resin">Resin</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Material *">
          <Select value={material} onValueChange={(v) => setMaterial(v as MaterialType)}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white max-h-56">
              {materials.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Brand *">
          <Input className="bg-slate-800 border-slate-700 text-white" value={brand}
            onChange={(e) => setBrand(e.target.value)} placeholder="numakers" />
        </Field>

        <Field label="Colour *">
          <Input className="bg-slate-800 border-slate-700 text-white" value={color}
            onChange={(e) => setColor(e.target.value)} placeholder="Pure White"
            list="quickadd-colors" />
          <datalist id="quickadd-colors">
            {COMMON_COLORS.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>

        <Field label={`Min stock (${category === 'filament' ? 'spools' : 'bottles'})`}>
          <Input type="number" min={0} inputMode="numeric"
            className="bg-slate-800 border-slate-700 text-white" value={minStock}
            onChange={(e) => setMinStock(e.target.value.replace(/[^0-9]/g, ''))} />
        </Field>

        <Field label="Purchase price (₹)">
          <Input type="number" min={0} inputMode="decimal"
            className="bg-slate-800 border-slate-700 text-white" value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)} placeholder="optional" />
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-400">
          Storage location
          <span className="text-slate-600 font-normal"> — record it now while you are shelving it</span>
        </p>
        <div className="grid grid-cols-4 gap-2">
          <Field label="Warehouse">
            <Input className="bg-slate-800 border-slate-700 text-white" value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)} placeholder="Main" />
          </Field>
          <Field label="Rack">
            <Input className="bg-slate-800 border-slate-700 text-white" value={rack}
              onChange={(e) => setRack(e.target.value)} placeholder="A" />
          </Field>
          <Field label="Column">
            <Input className="bg-slate-800 border-slate-700 text-white" value={column}
              onChange={(e) => setColumn(e.target.value)} placeholder="1" />
          </Field>
          <Field label="Bin">
            <Input className="bg-slate-800 border-slate-700 text-white" value={bin}
              onChange={(e) => setBin(e.target.value)} placeholder="B" />
          </Field>
        </div>
      </div>

      <Button
        className="w-full bg-emerald-700 hover:bg-emerald-600"
        onClick={handleSave}
        disabled={saving || !!skuClash || !sku.trim() || !brand.trim() || !color.trim()}
      >
        {saving
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding…</>
          : 'Add Product & Record Stock'}
      </Button>
    </div>
  )
}

function Field({ label, children, className }: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}
