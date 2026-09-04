import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTransactionStore } from '@/store/transactionStore'
import { useAuthStore } from '@/store/authStore'
import { useDashboardStore } from '@/store/dashboardStore'
import { generateTransactionId, nowISO, nowTime, unitLabel, transactionLabel } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import type { Product, TransactionType } from '@/types'

interface TransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product
}

export function TransactionDialog({ open, onOpenChange, product }: TransactionDialogProps) {
  const { submit, isSubmitting } = useTransactionStore()
  const { user }                 = useAuthStore()
  const { fetch: refetchDash }   = useDashboardStore()

  const [txType, setTxType]     = useState<TransactionType>('stock_in')
  const [quantity, setQuantity] = useState('')
  const [remarks, setRemarks]   = useState('')
  const [done, setDone]         = useState(false)

  const unit = unitLabel(product.category)

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow whole positive integers
    const val = e.target.value.replace(/[^0-9]/g, '')
    setQuantity(val)
  }

  const handleSubmit = async () => {
    const qty = parseInt(quantity, 10)
    if (!qty || qty <= 0) {
      toast({ title: 'Invalid quantity', description: 'Enter a whole number greater than 0.', variant: 'destructive' })
      return
    }

    // Prevent stock going negative
    if ((txType === 'sale' || txType === 'internal_use') && qty > product.currentStock) {
      toast({ title: 'Insufficient stock', description: `Only ${product.currentStock} ${unit} available.`, variant: 'destructive' })
      return
    }

    const txId = generateTransactionId()
    const ok = await submit({
      transactionId: txId,
      date: nowISO(),
      time: nowTime(),
      sku: product.sku,
      productName: `${product.material} ${product.brand} ${product.color}`,
      transactionType: txType,
      quantity: qty,
      userId: user?.id ?? 'unknown',
      userName: user?.name ?? 'Unknown',
      remarks,
    })

    if (ok) {
      setDone(true)
      refetchDash()
      // Reset after delay
      setTimeout(() => {
        setDone(false)
        setQuantity('')
        setRemarks('')
        setTxType('stock_in')
        onOpenChange(false)
      }, 1800)
    } else {
      toast({ title: 'Transaction failed', description: 'Could not save to Google Sheets. Try again.', variant: 'destructive' })
    }
  }

  if (done) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-900/50 border border-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="text-lg font-semibold text-white">Transaction Recorded!</p>
            <p className="text-sm text-slate-400 text-center">
              {transactionLabel(txType)} of {quantity} {unit} for {product.material} {product.color} saved to Google Sheets.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Record Transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scanned product info — read only */}
          <div className="bg-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">SKU</span>
              <span className="text-xs font-mono text-violet-400">{product.sku}</span>
            </div>
            <p className="font-semibold text-white">{product.material} {product.brand} {product.color}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Current stock</span>
              <span className="font-medium text-white">{product.currentStock} {unit}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Transaction ID</span>
              <span className="font-mono text-slate-400">{generateTransactionId()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Date / Time</span>
              <span className="text-slate-400">{new Date().toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Transaction type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Transaction Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['stock_in', 'sale', 'internal_use'] as TransactionType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setTxType(type)}
                  className={`py-2.5 px-2 rounded-lg border text-xs font-medium transition-colors ${
                    txType === type
                      ? type === 'stock_in'
                        ? 'bg-emerald-900/60 border-emerald-600 text-emerald-300'
                        : type === 'sale'
                        ? 'bg-blue-900/60 border-blue-600 text-blue-300'
                        : 'bg-amber-900/60 border-amber-600 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {transactionLabel(type)}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300" htmlFor="tx-qty">
              Quantity <span className="text-slate-500 font-normal text-xs">(whole numbers only)</span>
            </label>
            <Input
              id="tx-qty"
              type="text"
              inputMode="numeric"
              placeholder={`Number of ${unit}`}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              value={quantity}
              onChange={handleQuantityChange}
            />
          </div>

          {/* Remarks */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300" htmlFor="tx-remarks">
              Remarks <span className="text-slate-500 font-normal text-xs">(optional)</span>
            </label>
            <textarea
              id="tx-remarks"
              rows={2}
              placeholder="Add any notes about this transaction…"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-600 resize-none"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" className="text-slate-400" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            className="bg-violet-600 hover:bg-violet-700"
            onClick={handleSubmit}
            disabled={isSubmitting || !quantity}
          >
            {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Submit Transaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
