import { useState } from 'react'
import { ScanLine, FileText, Barcode, KeyRound } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { BarcodeScanner } from './BarcodeScanner'
import { OcrScanner } from './OcrScanner'
import { ManualSkuEntry } from './ManualSkuEntry'
import { QuickAddProduct } from './QuickAddProduct'
import type { Product } from '@/types'
import { TransactionDialog } from '@/components/transaction/TransactionDialog'

type ScanMode = 'select' | 'barcode' | 'ocr' | 'manual' | 'quickadd'

interface ScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScannerDialog({ open, onOpenChange }: ScannerDialogProps) {
  const [mode, setMode]                 = useState<ScanMode>('select')
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null)
  const [txOpen, setTxOpen]             = useState(false)
  const [pendingSku, setPendingSku]     = useState('')
  /** Where to return if the user backs out of quick add. */
  const [addOrigin, setAddOrigin]       = useState<ScanMode>('select')

  const handleProductFound = (product: Product) => {
    setScannedProduct(product)
    onOpenChange(false)
    setTxOpen(true)
  }

  /** A scan found a code that is not in the catalogue yet. */
  const handleAddRequest = (sku: string, from: ScanMode) => {
    setPendingSku(sku)
    setAddOrigin(from)
    setMode('quickadd')
  }

  // Newly created products go straight into a Stock In so the opening quantity
  // is recorded as a real transaction rather than an untracked opening balance.
  const handleCreated = (product: Product) => {
    setPendingSku('')
    handleProductFound(product)
  }

  const reset = () => { setMode('select'); setPendingSku('') }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-violet-400" />
              {mode === 'select' && 'Scanner'}
              {mode === 'barcode' && 'Barcode / QR Scanner'}
              {mode === 'ocr'     && 'OCR Text Scanner'}
              {mode === 'manual'  && 'Manual SKU Entry'}
              {mode === 'quickadd' && 'Add New Product'}
            </DialogTitle>
          </DialogHeader>

          {mode === 'select' && (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-slate-400">Choose a scanning method:</p>

              <button
                onClick={() => setMode('barcode')}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-slate-700 hover:border-violet-600 hover:bg-violet-900/20 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-slate-800">
                  <Barcode className="h-6 w-6 text-violet-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Barcode / QR Code</p>
                  <p className="text-xs text-slate-400">Scan the barcode or QR code on the label</p>
                </div>
              </button>

              <button
                onClick={() => setMode('ocr')}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-slate-700 hover:border-cyan-600 hover:bg-cyan-900/20 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-slate-800">
                  <FileText className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">OCR Text Scan</p>
                  <p className="text-xs text-slate-400">Read text from the label using camera</p>
                </div>
              </button>

              <button
                onClick={() => setMode('manual')}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-slate-700 hover:border-amber-600 hover:bg-amber-900/20 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-slate-800">
                  <KeyRound className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Manual SKU Entry</p>
                  <p className="text-xs text-slate-400">Type the SKU code directly</p>
                </div>
              </button>
            </div>
          )}

          {mode === 'barcode' && (
            <BarcodeScanner
              onProductFound={handleProductFound}
              onAddRequest={(sku) => handleAddRequest(sku, 'barcode')}
              onBack={reset}
            />
          )}

          {mode === 'ocr' && (
            <OcrScanner
              onProductFound={handleProductFound}
              onAddRequest={(sku) => handleAddRequest(sku, 'ocr')}
              onBack={reset}
            />
          )}

          {mode === 'manual' && (
            <ManualSkuEntry
              onProductFound={handleProductFound}
              onAddRequest={(sku) => handleAddRequest(sku, 'manual')}
              onBack={reset}
            />
          )}

          {mode === 'quickadd' && (
            <QuickAddProduct
              initialSku={pendingSku}
              onCreated={handleCreated}
              onBack={() => setMode(addOrigin)}
            />
          )}
        </DialogContent>
      </Dialog>

      {scannedProduct && (
        <TransactionDialog
          open={txOpen}
          onOpenChange={setTxOpen}
          product={scannedProduct}
        />
      )}
    </>
  )
}
