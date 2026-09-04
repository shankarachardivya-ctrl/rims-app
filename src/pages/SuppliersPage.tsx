import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useIsAdmin } from '@/store/authStore'
import { toast } from '@/hooks/useToast'
import { apiGetSuppliers, apiAddSupplier, apiUpdateSupplier, apiDeleteSupplier } from '@/services/api'
import type { Supplier } from '@/types'

const EMPTY: Omit<Supplier, 'supplierId'> = {
  name: '', contactPerson: '', phone: '', email: '',
  address: '', gstNumber: '', materialsSupplied: [],
}

export function SuppliersPage() {
  const isAdmin = useIsAdmin()
  const [suppliers, setSuppliers]   = useState<Supplier[]>([])
  const [loading, setLoading]       = useState(false)
  const [editOpen, setEditOpen]     = useState(false)
  const [editing, setEditing]       = useState<Omit<Supplier, 'supplierId'> | null>(null)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [delConfirm, setDelConfirm] = useState<Supplier | null>(null)
  const [materialsInput, setMaterialsInput] = useState('')

  const load = async () => {
    setLoading(true)
    const res = await apiGetSuppliers()
    if (res.success && res.data) setSuppliers(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing({ ...EMPTY })
    setEditingId(null)
    setMaterialsInput('')
    setEditOpen(true)
  }

  const openEdit = (s: Supplier) => {
    const { supplierId, ...rest } = s
    setEditing(rest)
    setEditingId(supplierId)
    setMaterialsInput(s.materialsSupplied.join(', '))
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!editing || !editing.name) {
      toast({ title: 'Name is required', variant: 'destructive' }); return
    }
    const data = { ...editing, materialsSupplied: materialsInput.split(',').map((m) => m.trim()).filter(Boolean) }
    if (!editingId) {
      const res = await apiAddSupplier(data)
      if (res.success) { load(); setEditOpen(false); toast({ title: 'Supplier added', variant: 'success' }) }
      else toast({ title: 'Failed to add', variant: 'destructive' })
    } else {
      const res = await apiUpdateSupplier({ supplierId: editingId, ...data })
      if (res.success) { load(); setEditOpen(false); toast({ title: 'Supplier updated', variant: 'success' }) }
      else toast({ title: 'Failed to update', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!delConfirm) return
    const res = await apiDeleteSupplier(delConfirm.supplierId)
    setDelConfirm(null)
    if (res.success) { load(); toast({ title: 'Supplier deleted', variant: 'success' }) }
    else toast({ title: 'Failed to delete', variant: 'destructive' })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Suppliers</h2>
        {isAdmin && (
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 gap-2" onClick={openNew}>
            <Plus className="h-4 w-4" />Add Supplier
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading…</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No suppliers yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <Card key={s.supplierId} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.contactPerson} · {s.phone} · {s.email}</p>
                    {s.materialsSupplied.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1">Materials: {s.materialsSupplied.join(', ')}</p>
                    )}
                    {s.gstNumber && <p className="text-xs text-slate-600">GST: {s.gstNumber}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => setDelConfirm(s)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              {([ ['name','Company Name *','e.g. Bambu Lab India'], ['contactPerson','Contact Person',''], ['phone','Phone',''], ['email','Email',''], ['gstNumber','GST Number',''], ['address','Address',''] ] as [keyof typeof editing, string, string][]).map(([k, label, placeholder]) => (
                <div key={k} className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">{label}</label>
                  <Input className="bg-slate-800 border-slate-700 text-white"
                    value={String((editing as Record<string, unknown>)[k] ?? '')}
                    placeholder={placeholder}
                    onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Materials Supplied (comma-separated)</label>
                <Input className="bg-slate-800 border-slate-700 text-white" value={materialsInput}
                  placeholder="PLA, PETG, ABS" onChange={(e) => setMaterialsInput(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="text-slate-400" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleSave}>
              {editingId ? 'Save Changes' : 'Add Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!delConfirm} onOpenChange={(v) => { if (!v) setDelConfirm(null) }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Supplier?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-300">Delete <strong>{delConfirm?.name}</strong>? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" className="text-slate-400" onClick={() => setDelConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
