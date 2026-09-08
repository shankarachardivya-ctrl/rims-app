import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { SheetSetupPage } from '@/pages/SheetSetupPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SearchPage } from '@/pages/SearchPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { TransactionsPage } from '@/pages/TransactionsPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { UsersPage } from '@/pages/UsersPage'
import { useAuthStore } from '@/store/authStore'
import { getSpreadsheetId } from '@/services/sheetConfig'

/**
 * Requires a signed-in, authorised user AND a bound workbook.
 * Without a workbook there is nothing to read, so we send the user to setup.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!getSpreadsheetId()) return <Navigate to="/setup" replace />
  return <>{children}</>
}

/** Sign-in is required to reach setup, but a workbook is not. */
function SignedInRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const googleProfile = useAuthStore((s) => s.googleProfile)
  if (!isAuthenticated && !googleProfile) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  const restore = useAuthStore((s) => s.restore)
  const [booted, setBooted] = useState(false)

  // Silently re-establish the Google token before any route renders, so a
  // reload does not bounce an already-signed-in user back to the login screen.
  useEffect(() => {
    let cancelled = false
    restore()
      .catch(() => false)
      .finally(() => { if (!cancelled) setBooted(true) })
    return () => { cancelled = true }
  }, [restore])

  if (!booted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/setup"
          element={
            <SignedInRoute>
              <SheetSetupPage />
            </SignedInRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index               element={<DashboardPage />} />
          <Route path="search"       element={<SearchPage />} />
          <Route path="products"     element={<ProductsPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="suppliers"    element={<SuppliersPage />} />
          <Route path="customers"    element={<CustomersPage />} />
          <Route path="reports"      element={<ReportsPage />} />
          <Route path="users"        element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
