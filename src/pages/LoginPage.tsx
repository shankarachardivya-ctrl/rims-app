import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Layers, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/hooks/useToast'
import type { User } from '@/types'

// ─── Demo users for development (remove in production) ───────────────────────
const DEMO_USERS: User[] = [
  {
    id: '1', email: 'admin@real3d.com', name: 'Admin User', role: 'admin',
    canStockIn: true, canStockOut: true, canSell: true, canEdit: true, canDelete: true, active: true,
  },
  {
    id: '2', email: 'warehouse@real3d.com', name: 'Warehouse Op', role: 'warehouse',
    canStockIn: true, canStockOut: true, canSell: false, canEdit: false, canDelete: false, active: true,
  },
  {
    id: '3', email: 'sales@real3d.com', name: 'Sales Person', role: 'sales',
    canStockIn: false, canStockOut: true, canSell: true, canEdit: false, canDelete: false, active: true,
  },
]

export function LoginPage() {
  const { isAuthenticated, setUser, setLoading, isLoading } = useAuthStore()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Demo auth — replace with real API call
    setTimeout(() => {
      const found = DEMO_USERS.find((u) => u.email === email)
      if (found && password === 'demo123') {
        setUser(found, 'demo-token')
        toast({ title: `Welcome, ${found.name}!`, variant: 'success' })
      } else {
        setLoading(false)
        toast({ title: 'Invalid credentials', description: 'Check your email and password.', variant: 'destructive' })
      }
    }, 800)
  }

  const handleGoogleLogin = () => {
    toast({ title: 'Google login', description: 'Configure VITE_GOOGLE_CLIENT_ID to enable.' })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center mb-4">
            <Layers className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Real3D RIMS</h1>
          <p className="text-slate-400 text-sm mt-1">Inventory Management System</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-5">
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300" htmlFor="email">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@real3d.com"
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-slate-900 text-slate-500">or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={handleGoogleLogin}
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </Button>

          {/* Demo hint */}
          <p className="text-center text-xs text-slate-600">
            Demo: admin@real3d.com / demo123
          </p>
        </div>
      </div>
    </div>
  )
}
