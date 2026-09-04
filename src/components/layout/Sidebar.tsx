import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Search, Package, Users,
  Truck, FileSpreadsheet, Settings, LogOut, Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore, useIsAdmin } from '@/store/authStore'
import { Avatar } from './Avatar'

const navItems = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/search',     icon: Search,          label: 'Search'    },
  { to: '/products',   icon: Package,         label: 'Products'  },
  { to: '/transactions', icon: Layers,        label: 'Transactions' },
  { to: '/suppliers',  icon: Truck,           label: 'Suppliers' },
  { to: '/customers',  icon: Users,           label: 'Customers' },
  { to: '/reports',    icon: FileSpreadsheet, label: 'Reports / BOM' },
]

const adminItems = [
  { to: '/users',    icon: Settings, label: 'User Management' },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const isAdmin = useIsAdmin()

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-slate-900 border-r border-slate-800 px-4 py-6">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white text-sm">
          R3D
        </div>
        <div>
          <p className="font-semibold text-white text-sm">Real3D</p>
          <p className="text-xs text-slate-400">Inventory System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</p>
            </div>
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-800 pt-4 mt-4">
        <div className="flex items-center gap-3 px-2 mb-3">
          <Avatar name={user?.name ?? ''} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
