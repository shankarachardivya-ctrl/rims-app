import { useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiGetProduct } from '@/services/api'
import type { Product } from '@/types'

interface BarcodeScannerProps {
  onProductFound: (product: Product) => void
  onBack: () => void
}

export function BarcodeScanner({ onProductFound, onBack }: BarcodeScannerProps) {
  const scannerRef  = useRef<Html5QrcodeScanner | null>(null)
  const [status, setStatus]   = useState<'scanning' | 'found' | 'error' | 'loading'>('scanning')
  const [scannedSku, setScannedSku] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'barcode-reader',
      { fps: 10, qrbox: { width: 250, height: 150 }, rememberLastUsedCamera: true },
      false
    )

    scanner.render(
      async (decodedText) => {
        await scanner.clear()
        setScannedSku(decodedText)
        setStatus('loading')

        const res = await apiGetProduct(decodedText)
        if (res.success && res.data) {
          setProduct(res.data)
          setStatus('found')
        } else {
          setStatus('error')
          setErrorMsg(`No product found for SKU: "${decodedText}"`)
        }
      },
      () => { /* ignore scan errors */ }
    )

    scannerRef.current = scanner
    return () => { scanner.clear().catch(() => {}) }
  }, [])

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" />Back
      </Button>

      {status === 'scanning' && (
        <>
          <p className="text-sm text-slate-400">Point the camera at the barcode or QR code on the spool/bottle.</p>
          <div id="barcode-reader" className="rounded-lg overflow-hidden" />
        </>
      )}

      {status === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
          <p className="text-sm text-slate-400">Looking up SKU: <span className="text-white font-mono">{scannedSku}</span></p>
        </div>
      )}

      {status === 'found' && product && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Product found!</span>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-white">{product.material} {product.brand} {product.color}</p>
            <p className="text-xs font-mono text-violet-400">{product.sku}</p>
            <p className="text-sm text-slate-300">Stock: {product.currentStock} {product.category === 'filament' ? 'spools' : 'bottles'}</p>
          </div>
          <Button
            className="w-full bg-violet-600 hover:bg-violet-700"
            onClick={() => onProductFound(product)}
          >
            Proceed to Transaction
          </Button>
          <Button variant="ghost" className="w-full text-slate-400" onClick={() => setStatus('scanning')}>
            Scan Again
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-300">{errorMsg}</p>
          </div>
          <Button variant="outline" className="w-full border-slate-700" onClick={() => setStatus('scanning')}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}
