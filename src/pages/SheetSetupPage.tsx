import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileSpreadsheet, CheckCircle2, Loader2, TriangleAlert, Plus,
  ArrowRight, LogOut, ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSheetStore } from '@/store/sheetStore'
import { useAuthStore } from '@/store/authStore'
import { pickSpreadsheet, extractSpreadsheetId } from '@/services/googlePicker'
import { toast } from '@/hooks/useToast'

export function SheetSetupPage() {
  const navigate = useNavigate()
  const {
    binding, check, isChecking, isCreating, error,
    select, createMissing, verify, setError,
  } = useSheetStore()
  const { googleProfile, authoriseAgainstSheet, logout, isLoading } = useAuthStore()

  const [manualId, setManualId] = useState('')
  const [authNotice, setAuthNotice] = useState<string | null>(null)

  // If a workbook is already bound, confirm it still looks right
  useEffect(() => {
    if (binding && !check) void verify()
  }, [binding, check, verify])

  const handlePick = async () => {
    setError(null)
    setAuthNotice(null)
    try {
      const picked = await pickSpreadsheet()
      if (!picked) return                       // cancelled
      const result = await select(picked)
      if (result) toast({ title: `Connected to ${result.title}`, variant: 'success' })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleManual = async () => {
    const id = extractSpreadsheetId(manualId)
    if (!id) {
      setError('That does not look like a Google Sheets link or ID.')
      return
    }
    setError(null)
    const result = await select({ id, name: 'Selected workbook' })
    if (result) toast({ title: `Connected to ${result.title}`, variant: 'success' })
  }

  const handleContinue = async () => {
    setAuthNotice(null)
    const result = await authoriseAgainstSheet()
    if (result.status === 'ok') {
      navigate('/', { replace: true })
      return
    }
    if (result.status === 'not-listed') {
      setAuthNotice(
        `${result.email} is not in the Users tab of this workbook. Add the email there, then continue.`
      )
    } else if (result.status === 'disabled') {
      setAuthNotice(`${result.email} is listed but Active is 0. An admin can re-enable it.`)
    } else if (result.status === 'needs-sheet') {
      setAuthNotice('Select a workbook first.')
    } else {
      setAuthNotice(result.error)
    }
  }

  const ready = Boolean(binding && check && check.missing.length === 0)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-start justify-center p-4 py-10">
      <div className="w-full max-w-lg space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-600/20 border border-emerald-700 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Connect your inventory workbook</h1>
            <p className="text-sm text-slate-400">
              {googleProfile ? `Signed in as ${googleProfile.email}` : 'Choose the Google Sheet to use'}
            </p>
          </div>
        </div>

        {/* Step 1 — choose the workbook */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">1. Select the workbook</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Only the sheet you pick is shared with this app.
              </p>
            </div>
            {binding && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />}
          </div>

          {binding ? (
            <div className="bg-slate-800 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-white">{check?.title ?? binding.name}</p>
              <p className="text-xs font-mono text-slate-500 break-all">{binding.id}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-violet-600 hover:bg-violet-700 gap-2"
              onClick={handlePick}
              disabled={isChecking}
            >
              {isChecking
                ? <><Loader2 className="h-4 w-4 animate-spin" />Checking…</>
                : <><FileSpreadsheet className="h-4 w-4" />{binding ? 'Choose a different sheet' : 'Browse my Google Sheets'}</>}
            </Button>
          </div>

          <details className="group">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">
              Or paste a link instead
            </summary>
            <div className="mt-2 flex gap-2">
              <Input
                className="bg-slate-800 border-slate-700 text-white text-sm"
                placeholder="https://docs.google.com/spreadsheets/d/…"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
              />
              <Button
                variant="outline" className="border-slate-700 shrink-0"
                onClick={handleManual}
                disabled={!manualId.trim() || isChecking}
              >
                Use
              </Button>
            </div>
            <p className="text-xs text-slate-600 mt-1.5">
              A pasted link only works if you have opened that file through the browser above at
              least once, otherwise Google will refuse access.
            </p>
          </details>
        </section>

        {/* Step 2 — tab check */}
        {binding && check && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">2. Required tabs</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {check.present.length} of {check.present.length + check.missing.length} present
                </p>
              </div>
              {check.missing.length === 0
                ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                : <TriangleAlert className="h-5 w-5 text-amber-400 shrink-0" />}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {check.present.map((t) => (
                <span key={t} className="px-2 py-1 rounded text-xs bg-emerald-900/40 border border-emerald-800 text-emerald-300">
                  {t}
                </span>
              ))}
              {check.missing.map((t) => (
                <span key={t} className="px-2 py-1 rounded text-xs bg-amber-900/30 border border-amber-800 text-amber-300">
                  {t} — missing
                </span>
              ))}
            </div>

            {check.missing.length > 0 && (
              <>
                <p className="text-xs text-slate-400">
                  These can be created for you with the correct headers. Existing tabs and data
                  are not modified.
                </p>
                <Button
                  className="bg-emerald-700 hover:bg-emerald-600 gap-2"
                  onClick={async () => {
                    const ok = await createMissing()
                    toast(ok
                      ? { title: 'Tabs created', variant: 'success' }
                      : { title: 'Could not create all tabs', variant: 'destructive' })
                  }}
                  disabled={isCreating}
                >
                  {isCreating
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</>
                    : <><Plus className="h-4 w-4" />Create {check.missing.length} missing tab{check.missing.length > 1 ? 's' : ''}</>}
                </Button>
              </>
            )}
          </section>
        )}

        {/* Step 3 — authorise this user against the sheet */}
        {ready && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">3. Check your access</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your permissions come from the Users tab of this workbook.
                </p>
              </div>
            </div>

            {authNotice && (
              <div className="bg-amber-900/25 border border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-300">{authNotice}</p>
              </div>
            )}

            <Button
              className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
              onClick={handleContinue}
              disabled={isLoading}
            >
              {isLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Checking…</>
                : <>Continue to RIMS<ArrowRight className="h-4 w-4" /></>}
            </Button>
          </section>
        )}

        {error && (
          <div className="bg-red-900/25 border border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <button
          onClick={() => { void logout().then(() => navigate('/login', { replace: true })) }}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  )
}
