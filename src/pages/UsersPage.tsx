import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Users as UsersIcon, ShieldCheck } from 'lucide-react'
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
import { useIsAdmin, useAuthStore } from '@/store/authStore'
import { toast } from '@/hooks/useToast'
import { roleLabel } from '@/lib/utils'
import { apiGetUsers, apiAddUser, apiUpdateUser, apiDeleteUser } from '@/services/api'
import type { User, UserRole } from '@/types'

// Default permission sets per role
const ROLE_DEFAULTS: Record<UserRole, Omit<User, 'id' | 'email' | 'name' | 'role'>> = {
  admin:     { canStockIn: true,  canStockOut: true,  canSell: true,  canEdit: true,  canDelete: true,  active: true },
  warehouse: { canStockIn: true,  canStockOut: true,  canSell: false, canEdit: false, canDelete: false, active: true },
  sales:     { canStockIn: false, canStockOut: true,  canSell: true,  canEdit: false, canDelete: false, active: true },
}

const EMPTY: Omit<User, 'id'> = {
  email: '', name: '', role: 'warehouse', ...ROLE_DEFAULTS.warehouse,
}

type PermissionKey = 'canStockIn' | 'canStockOut' | 'canSell' | 'canEdit' | 'canDelete' | 'active'

const PERMISSION_FIELDS: Array<{ key: PermissionKey; label: string }> = [
  { key: 'canStockIn',  label: 'Stock In' },
  { key: 'canStockOut', label: 'Stock Out' },
  { key: 'canSell',     label: 'Sell' },
  { key: 'canEdit',     label: 'Edit' },
  { key: 'canDelete',   label: 'Delete' },
  { key: 'active',      label: 'Active' },
]

export function UsersPage() {
  const isAdmin        = useIsAdmin()
  const currentUser    = useAuthStore((s) => s.user)
  const [users, setUsers]           = useState<User[]>([])
  const [loading, setLoading]       = useState(false)
  const [editOpen, setEditOpen]     = useState(false)
  const [editing, setEditing]       = useState<Omit<User, 'id'> | null>(null)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [delConfirm, setDelConfirm] = useState<User | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await apiGetUsers()
    if (res.success && res.data) setUsers(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Non-admins should not see this page at all
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-3">
        <ShieldCheck className="h-12 w-12 mx-auto text-slate-600" />
        <h2 className="text-lg font-semibold text-white">Admins only</h2>
        <p className="text-sm text-slate-400">
          You do not have permission to manage users.
        </p>
      </div>
    )
  }

  const openNew = () => {
    setEditing({ ...EMPTY })
    setEditingId(null)
    setEditOpen(true)
  }

  const openEdit = (u: User) => {
    const { id, ...rest } = u
    setEditing(rest)
    setEditingId(id)
    setEditOpen(true)
  }

  // Changing role resets permissions to that role's defaults
  const changeRole = (role: UserRole) => {
    if (!editing) return
    setEditing({ ...editing, role, ...ROLE_DEFAULTS[role] })
  }

  const handleSave = async () => {
    if (!editing) return
    if (!editing.name.trim() || !editing.email.trim()) {
      toast({ title: 'Missing fields', description: 'Name and email are required.', variant: 'destructive' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email)) {
      toast({ title: 'Invalid email', description: 'Enter a valid email address.', variant: 'destructive' })
      return
    }

    if (!editingId) {
      const res = await apiAddUser(editing)
      if (res.success) { load(); setEditOpen(false); toast({ title: 'User added', variant: 'success' }) }
      else toast({ title: 'Failed to add user', description: res.error, variant: 'destructive' })
    } else {
      const res = await apiUpdateUser({ id: editingId, ...editing })
      if (res.success) { load(); setEditOpen(false); toast({ title: 'User updated', variant: 'success' }) }
      else toast({ title: 'Failed to update user', description: res.error, variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!delConfirm) return
    const res = await apiDeleteUser(delConfirm.id)
    setDelConfirm(null)
    if (res.success) { load(); toast({ title: 'User deleted', variant: 'success' }) }
    else toast({ title: 'Failed to delete user', description: res.error, variant: 'destructive' })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">User Management</h2>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-700 gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" />Add User
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <UsersIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No users found.</p>
          <p className="text-xs mt-1 text-slate-600">
            Users are stored in the Users tab of your Google Sheet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-white text-sm truncate">{u.name}</p>
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                      {roleLabel(u.role)}
                    </Badge>
                    {!u.active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    {u.id === currentUser?.id && (
                      <span className="text-xs text-violet-400">(you)</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {PERMISSION_FIELDS
                      .filter((f) => f.key !== 'active' && u[f.key])
                      .map((f) => f.label)
                      .join(' · ') || 'No permissions'}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white"
                    onClick={() => openEdit(u)} aria-label={`Edit ${u.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-400"
                    onClick={() => setDelConfirm(u)}
                    disabled={u.id === currentUser?.id}
                    aria-label={`Delete ${u.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400" htmlFor="user-name">Name *</label>
                <Input id="user-name" className="bg-slate-800 border-slate-700 text-white"
                  value={editing.name} placeholder="Jane Doe"
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400" htmlFor="user-email">Email *</label>
                <Input id="user-email" type="email" className="bg-slate-800 border-slate-700 text-white"
                  value={editing.email} placeholder="jane@real3d.com"
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Role</label>
                <Select value={editing.role} onValueChange={(v) => changeRole(v as UserRole)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="warehouse">Warehouse Operator</SelectItem>
                    <SelectItem value="sales">Sales Person</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-600">Changing role resets permissions to that role's defaults.</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400">Permissions</p>
                <div className="grid grid-cols-2 gap-2">
                  {PERMISSION_FIELDS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-violet-600"
                        checked={Boolean(editing[key])}
                        onChange={(e) => setEditing({ ...editing, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="text-slate-400" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleSave}>
              {editingId ? 'Save Changes' : 'Add User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!delConfirm} onOpenChange={(v) => { if (!v) setDelConfirm(null) }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete User?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-300">
            Delete <strong>{delConfirm?.name}</strong>? This cannot be undone.
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
