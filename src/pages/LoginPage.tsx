import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Layers, Loader2, ShieldAlert, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { isGoogleConfigured } from '@/lib/constants'
import { getSpreadsheetId } from '@/services/sheetConfig'

function GoogleMark() {
  return (
    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, signInWithGoogle, restore, isLoading } = useAuthStore()

  const [notice, setNotice] = useState<{
    kind: 'error' | 'warn'
    title: string
    detail?: string
  } | null>(null)
  const [restoring, setRestoring] = useState(true)

  // Try to resume a previous session without showing any Google UI.
  useEffect(() => {
    let cancelled = false
    restore()
      .catch(() => false)
      .finally(() => { if (!cancelled) setRestoring(false) })
    return () => { cancelled = true }
  }, [restore])

  if (isAuthenticated) {
    return <Navigate to={getSpreadsheetId() ? '/' : '/setup'} replace />
  }

  const handleSignIn = async () => {
    setNotice(null)
    const result = await signInWithGoogle()

    switch (result.status) {
      case 'ok':
        navigate('/', { replace: true })
        break
      case 'needs-sheet':
        // Signed into Google, but no workbook chosen yet
        navigate('/setup', { replace: true })
        break
      case 'not-listed':
        setNotice({
          kind: 'warn',
          title: `${result.email} is not in the Users tab`,
          detail: 'Ask an admin to add this email to the Users tab of the inventory workbook, then try again.',
        })
        break
      case 'disabled':
        setNotice({
          kind: 'warn',
          title: 'This account is deactivated',
          detail: `${result.email} is listed but Active is set to 0. An admin can re-enable it.`,
        })
        break
      case 'failed':
        setNotice({
          kind: 'error',
          title: 'Google sign-in failed',
          detail: result.error,
        })
        break
    }
  }

  const configured = isGoogleConfigured()

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center mb-4">
            <Layers className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Real3D RIMS</h1>
          <p className="text-slate-400 text-sm mt-1">Inventory Management System</p>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-5">
          {restoring ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-6 w-6 text-violet-400 animate-spin" />
              <p className="text-sm text-slate-400">Restoring your session…</p>
            </div>
          ) : !configured ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-amber-300">
                <TriangleAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">Google sign-in is not configured</p>
              </div>
              <p className="text-xs text-slate-400">
                Set <span className="font-mono text-slate-300">VITE_GOOGLE_CLIENT_ID</span> and{' '}
                <span className="font-mono text-slate-300">VITE_GOOGLE_API_KEY</span> in your
                deployment environment, then reload.
              </p>
              <p className="text-xs text-slate-500">
                Inventory data lives in your Google Sheet, so the app cannot run without it.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 text-center">
                <p className="text-sm text-slate-300">Sign in with your Google account</p>
                <p className="text-xs text-slate-500">
                  You will then choose the inventory workbook to use.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full border-slate-700 text-slate-200 hover:bg-slate-800"
                onClick={handleSignIn}
                disabled={isLoading}
              >
                {isLoading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in…</>
                  : <><GoogleMark />Sign in with Google</>}
              </Button>

              {notice && (
                <div className={[
                  'rounded-lg border p-3 space-y-1',
                  notice.kind === 'error'
                    ? 'bg-red-900/25 border-red-800'
                    : 'bg-amber-900/25 border-amber-800',
                ].join(' ')}>
                  <p className={[
                    'text-sm font-medium flex items-start gap-2',
                    notice.kind === 'error' ? 'text-red-300' : 'text-amber-300',
                  ].join(' ')}>
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                    {notice.title}
                  </p>
                  {notice.detail && (
                    <p className="text-xs text-slate-400 pl-6">{notice.detail}</p>
                  )}
                </div>
              )}

              <p className="text-center text-xs text-slate-600">
                Access is granted only to the workbook you select.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
