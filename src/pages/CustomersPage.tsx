import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useIsAdmin } from '@/store/authStore'
import { toast } from '@/hooks/useToast'
import { apiGetCustomers, apiAddCustomer, apiUpdateCustomer, apiDeleteCustomer } from '@/services/api'
import type { Customer } from '@/types'

const EMPTY: Omit<Customer, 'customerId'> = {
  name: '', phone: '', email: '', address: '', gstNumber: '',
}

export function CustomersPage() {
  const isAdmin = useIsAdmin()
  const [customers, setCustomers]   = useState<Customer[]>([])
  const [loading, setLoading]       = useState(false)
  const [editOpen, setEditOpen]     = useState(false)
  const [editing, setEditing]       = useState<Omit<Customer, 'customerId'> | null>(null)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [delConfirm, setDelConfirm] = useState<Customer | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await apiGetCustomers()
    if (res.success && res.data) setCustomers(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing({ ...EMPTY }); setEditingId(null); setEditOpen(true) }
  const openEdit = (c: Customer) => {
    const { customerId, ...rest } = c
    setEditing(rest); setEditingId(customerId); setEditOpen(true)
  }

  const handleSave = async () => {
    if (!editing?.name) { toast({ title: 'Name is required', variant: 'destructive' }); return }
    if (!editingId) {
      const res = await apiAddCustomer(editing)
      if (res.success) { load(); setEditOpen(false); toast({ title: 'Customer added', variant: 'success' }) }
    } else {
      const res = await apiUpdateCustomer({ customerId: editingId, ...editing })
      if (res.success) { load(); setEditOpen(false); toast({ title: 'Customer updated', variant: 'success' }) }
    }
  }

  const handleDelete = async () => {
    if (!delConfirm) return
    const res = await apiDeleteCustomer(delConfirm.customerId)
    setDelConfirm(null)
    if (res.success) { load(); toast({ title: 'Customer deleted', variant: 'success' }) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Customers</h2>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-700 gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" />Add Customer
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading…</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No customers yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <Card key={c.customerId} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.phone} · {c.email}</p>
                  {c.gstNumber && <p className="text-xs text-slate-600">GST: {c.gstNumber}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => setDelConfirm(c)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Customer' : 'Add Customer'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              {([ ['name','Name *'], ['phone','Phone'], ['email','Email'], ['gstNumber','GST Number'], ['address','Address'] ] as const).map(([k, label]) => (
                <div key={k} className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">{label}</label>
                  <Input className="bg-slate-800 border-slate-700 text-white"
                    value={(editing as Record<string, string>)[k] ?? ''}
                    onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="text-slate-400" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleSave}>
              {editingId ? 'Save Changes' : 'Add Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!delConfirm} onOpenChange={(v) => { if (!v) setDelConfirm(null) }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Customer?</DialogTitle></DialogHeader>
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
