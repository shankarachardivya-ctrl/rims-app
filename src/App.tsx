import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SearchPage } from '@/pages/SearchPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { TransactionsPage } from '@/pages/TransactionsPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { useAuthStore } from '@/store/authStore'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index        element={<DashboardPage />} />
          <Route path="search"        element={<SearchPage />} />
          <Route path="products"      element={<ProductsPage />} />
          <Route path="transactions"  element={<TransactionsPage />} />
          <Route path="suppliers"     element={<SuppliersPage />} />
          <Route path="customers"     element={<CustomersPage />} />
          <Route path="reports"       element={<ReportsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
