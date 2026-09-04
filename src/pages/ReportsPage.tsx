import { useEffect, useState } from 'react'
import { FileDown, Plus, AlertTriangle, ShoppingCart, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { apiGetBOM, apiGetPreOrders, apiPostPreOrder, apiUpdatePreOrderStatus } from '@/services/api'
import { useIsAdmin } from '@/store/authStore'
import { nowISO } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import type { BOMItem, PreOrder } from '@/types'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Papa from 'papaparse'

// ─── PDF export ───────────────────────────────────────────────────────────────
function exportPDF(items: BOMItem[], preOrders: PreOrder[]) {
  const doc = new jsPDF()
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  doc.setFontSize(16)
  doc.text('Real3D Enterprises — Bill of Materials', 14, 18)
  doc.setFontSize(10)
  doc.text(`Generated: ${today}`, 14, 26)

  doc.setFontSize(12)
  doc.text('Low Stock Requirements', 14, 38)

  autoTable(doc, {
    startY: 42,
    head: [['SKU', 'Product', 'Material', 'Color', 'In Stock', 'Min Stock', 'Deficit']],
    body: items.filter((i) => i.deficit > 0).map((i) => [
      i.sku, i.productName, i.material, i.color,
      String(i.currentStock), String(i.minStock), String(i.deficit),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [109, 40, 217] },
  })

  const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 80

  if (preOrders.filter((p) => p.status === 'pending').length > 0) {
    doc.setFontSize(12)
    doc.text('Pre-Order Requirements', 14, lastY + 12)

    autoTable(doc, {
      startY: lastY + 16,
      head: [['Order ID', 'Customer', 'SKU', 'Product', 'Quantity']],
      body: preOrders.filter((p) => p.status === 'pending').map((p) => [
        p.orderId, p.customerName, p.sku, p.productName, String(p.quantityRequired),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [14, 165, 233] },
    })
  }

  doc.save(`BOM-Real3D-${nowISO()}.pdf`)
  toast({ title: 'PDF exported', variant: 'success' })
}

// ─── CSV export ───────────────────────────────────────────────────────────────
function exportCSV(items: BOMItem[]) {
  const rows = items.map((i) => ({
    SKU: i.sku,
    Product: i.productName,
    Material: i.material,
    Color: i.color,
    Category: i.category,
    'Current Stock': i.currentStock,
    'Min Stock': i.minStock,
    Deficit: i.deficit,
    'Pre-Order Qty': i.preOrderQty,
    'Total Required': i.totalRequired,
    'To Order': i.toOrder,
  }))
  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `BOM-Real3D-${nowISO()}.csv`; a.click()
  URL.revokeObjectURL(url)
  toast({ title: 'CSV exported', variant: 'success' })
}

// ─── Pre-Order form ───────────────────────────────────────────────────────────
interface PreOrderFormProps {
  onAdd: (order: Omit<PreOrder, 'orderId' | 'dateEntered'>) => void
}

function PreOrderForm({ onAdd }: PreOrderFormProps) {
  const [customerName, setCustomerName] = useState('')
  const [sku, setSku]                   = useState('')
  const [productName, setProductName]   = useState('')
  const [qty, setQty]                   = useState('')

  const submit = () => {
    if (!customerName || !sku || !qty) {
      toast({ title: 'Fill in all required fields', variant: 'destructive' }); return
    }
    onAdd({ customerName, sku: sku.toUpperCase(), productName, quantityRequired: parseInt(qty), status: 'pending' })
    setCustomerName(''); setSku(''); setProductName(''); setQty('')
  }

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 space-y-3 border border-slate-700">
      <p className="text-sm font-medium text-slate-300">Add Pre-Order</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-500">Customer Name *</label>
          <Input className="bg-slate-800 border-slate-700 text-white h-9 text-sm" value={customerName}
            onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer A" />
        </div>
        <div>
          <label className="text-xs text-slate-500">SKU *</label>
          <Input className="bg-slate-800 border-slate-700 text-white h-9 text-sm font-mono uppercase" value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())} placeholder="PLA-B-BLK" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Product Name</label>
          <Input className="bg-slate-800 border-slate-700 text-white h-9 text-sm" value={productName}
            onChange={(e) => setProductName(e.target.value)} placeholder="PLA Bambu Black" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Quantity *</label>
          <Input type="number" min={1} className="bg-slate-800 border-slate-700 text-white h-9 text-sm" value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))} placeholder="10" />
        </div>
      </div>
      <Button size="sm" className="bg-sky-700 hover:bg-sky-600 gap-2" onClick={submit}>
        <Plus className="h-4 w-4" />Add to Pre-Orders
      </Button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function ReportsPage() {
  const isAdmin = useIsAdmin()
  const [bomItems, setBomItems]     = useState<BOMItem[]>([])
  const [preOrders, setPreOrders]   = useState<PreOrder[]>([])
  const [loading, setLoading]       = useState(false)
  const [tab, setTab]               = useState<'bom' | 'preorders'>('bom')

  const load = async () => {
    setLoading(true)
    const [bomRes, poRes] = await Promise.all([apiGetBOM(), apiGetPreOrders()])
    if (bomRes.success && bomRes.data)  setBomItems(bomRes.data)
    if (poRes.success  && poRes.data)  setPreOrders(poRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAddPreOrder = async (order: Omit<PreOrder, 'orderId' | 'dateEntered'>) => {
    const res = await apiPostPreOrder(order)
    if (res.success) { load(); toast({ title: 'Pre-order added', variant: 'success' }) }
    else toast({ title: 'Failed to add pre-order', variant: 'destructive' })
  }

  const handleFulfill = async (orderId: string) => {
    await apiUpdatePreOrderStatus(orderId, 'fulfilled')
    load()
  }

  const lowStockItems = bomItems.filter((i) => i.deficit > 0)
  const pendingOrders = preOrders.filter((p) => p.status === 'pending')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-white">Reports & Bill of Materials</h2>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 gap-2"
              onClick={() => exportCSV(bomItems)}>
              <FileDown className="h-4 w-4" />CSV
            </Button>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 gap-2"
              onClick={() => exportPDF(bomItems, preOrders)}>
              <FileText className="h-4 w-4" />Export PDF
            </Button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className={`bg-slate-900 border-slate-800 ${lowStockItems.length > 0 ? 'border-amber-800/50' : ''}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-white">{lowStockItems.length}</p>
              <p className="text-xs text-slate-400">Low Stock Items</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-sky-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-white">{pendingOrders.length}</p>
              <p className="text-xs text-slate-400">Pending Pre-Orders</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800">
        {(['bom', 'preorders'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'bom' ? 'Bill of Materials' : 'Pre-Orders'}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-12 text-slate-500">Loading…</div>}

      {/* BOM Tab */}
      {!loading && tab === 'bom' && (
        <div className="space-y-2">
          {lowStockItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>All stock levels are above minimum thresholds.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500">{lowStockItems.length} items need to be ordered</p>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="text-left py-2 px-3">SKU</th>
                      <th className="text-left py-2 px-3">Product</th>
                      <th className="text-left py-2 px-3">Color</th>
                      <th className="text-center py-2 px-3">In Stock</th>
                      <th className="text-center py-2 px-3">Min</th>
                      <th className="text-center py-2 px-3">Deficit</th>
                      <th className="text-center py-2 px-3">Pre-Orders</th>
                      <th className="text-center py-2 px-3 text-amber-400">To Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.map((item) => (
                      <tr key={item.sku} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-mono text-violet-400 text-xs">{item.sku}</td>
                        <td className="py-2.5 px-3 text-white">{item.productName}</td>
                        <td className="py-2.5 px-3 text-slate-300">{item.color}</td>
                        <td className="py-2.5 px-3 text-center text-slate-300">{item.currentStock}</td>
                        <td className="py-2.5 px-3 text-center text-slate-400">{item.minStock}</td>
                        <td className="py-2.5 px-3 text-center"><Badge variant="warning">-{item.deficit}</Badge></td>
                        <td className="py-2.5 px-3 text-center text-sky-400">{item.preOrderQty || '—'}</td>
                        <td className="py-2.5 px-3 text-center font-semibold text-white">{item.toOrder}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {lowStockItems.map((item) => (
                  <Card key={item.sku} className="bg-slate-900 border-slate-800">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-white">{item.productName}</p>
                          <p className="text-xs font-mono text-violet-400">{item.sku}</p>
                        </div>
                        <Badge variant="warning" className="text-sm font-bold">Order: {item.toOrder}</Badge>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-slate-400">
                        <span>Have: {item.currentStock}</span>
                        <span>Min: {item.minStock}</span>
                        <span>Deficit: {item.deficit}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Pre-Orders Tab */}
      {!loading && tab === 'preorders' && (
        <div className="space-y-4">
          <PreOrderForm onAdd={handleAddPreOrder} />

          {preOrders.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No pre-orders yet. Add one above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {preOrders.map((po) => (
                <Card key={po.orderId} className="bg-slate-900 border-slate-800">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white text-sm">{po.customerName}</p>
                      <p className="text-xs text-slate-400">{po.productName} · <span className="font-mono text-violet-400">{po.sku}</span></p>
                      <p className="text-xs text-slate-500">{po.orderId} · {po.dateEntered}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-white font-semibold">×{po.quantityRequired}</span>
                      {po.status === 'pending' ? (
                        <Button size="sm" variant="outline" className="border-emerald-700 text-emerald-400 h-7 text-xs"
                          onClick={() => handleFulfill(po.orderId)}>
                          Fulfill
                        </Button>
                      ) : (
                        <Badge variant="success">Fulfilled</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
