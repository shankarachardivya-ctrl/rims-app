import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ScanLine, Bell, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScannerDialog } from '@/components/scanner/ScannerDialog'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from './Avatar'
import { MobileNav } from './MobileNav'

const PAGE_TITLES: Record<string, string> = {
  '/':             'Dashboard',
  '/search':       'Material Search',
  '/products':     'Products',
  '/transactions': 'Transactions',
  '/suppliers':    'Suppliers',
  '/customers':    'Customers',
  '/reports':      'Reports & BOM',
  '/users':        'User Management',
}

export function Topbar() {
  const location = useLocation()
  const { user } = useAuthStore()
  const [scannerOpen, setScannerOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const title = PAGE_TITLES[location.pathname] ?? 'RIMS'

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center h-14 px-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm gap-3">
        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-slate-400 hover:text-white"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Page title */}
        <h1 className="flex-1 text-base font-semibold text-white">{title}</h1>

        {/* Scan button — always visible */}
        <Button
          size="sm"
          variant="outline"
          className="gap-2 border-violet-700 text-violet-300 hover:bg-violet-900/30"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-4 w-4" />
          <span className="hidden sm:inline">Scan</span>
        </Button>

        {/* Notifications placeholder */}
        <button className="text-slate-400 hover:text-white relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </button>

        {/* Avatar */}
        <Avatar name={user?.name ?? 'U'} size="sm" />
      </header>

      <ScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} />
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    </>
  )
}
