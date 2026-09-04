import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowLeft, CheckCircle, Loader2, CameraOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiGetProduct } from '@/services/api'
import type { Product } from '@/types'

interface BarcodeScannerProps {
  onProductFound: (product: Product) => void
  onBack: () => void
}

// Native BarcodeDetector API (available on Android Chrome 83+)
declare class BarcodeDetector {
  constructor(options?: { formats: string[] })
  detect(image: HTMLVideoElement | ImageBitmap): Promise<Array<{ rawValue: string }>>
  static getSupportedFormats(): Promise<string[]>
}

type Status = 'requesting' | 'scanning' | 'found' | 'error' | 'loading' | 'denied'

export function BarcodeScanner({ onProductFound, onBack }: BarcodeScannerProps) {
  const videoRef        = useRef<HTMLVideoElement>(null)
  const streamRef       = useRef<MediaStream | null>(null)
  const rafRef          = useRef<number>(0)
  const detectorRef     = useRef<BarcodeDetector | null>(null)
  const containerRef    = useRef<HTMLDivElement>(null)

  const [status, setStatus]       = useState<Status>('requesting')
  const [scannedSku, setScannedSku] = useState('')
  const [product, setProduct]     = useState<Product | null>(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const [useLibrary, setUseLibrary] = useState(false)

  // Stop camera stream helper
  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // Handle a decoded SKU
  const handleSku = useCallback(async (sku: string) => {
    stopStream()
    setScannedSku(sku)
    setStatus('loading')
    const res = await apiGetProduct(sku)
    if (res.success && res.data) {
      setProduct(res.data)
      setStatus('found')
    } else {
      setStatus('error')
      setErrorMsg(`No product found for SKU: "${sku}"`)
    }
  }, [stopStream])

  // Start native camera + BarcodeDetector scan loop
  const startNativeScanner = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream

      const video = videoRef.current
      if (!video) { stopStream(); return }

      video.srcObject = stream
      await video.play()

      // Check if BarcodeDetector is available
      if (typeof BarcodeDetector === 'undefined') {
        // Fall back to html5-qrcode library
        setUseLibrary(true)
        stopStream()
        return
      }

      const formats = await BarcodeDetector.getSupportedFormats()
      detectorRef.current = new BarcodeDetector({ formats })

      const scan = async () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          try {
            const barcodes = await detectorRef.current!.detect(video)
            if (barcodes.length > 0) {
              handleSku(barcodes[0].rawValue)
              return
            }
          } catch {
            // ignore individual frame errors
          }
        }
        rafRef.current = requestAnimationFrame(scan)
      }

      rafRef.current = requestAnimationFrame(scan)
      setStatus('scanning')
    } catch (err: unknown) {
      const error = err as { name?: string }
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setStatus('denied')
      } else {
        // Try library fallback
        setUseLibrary(true)
      }
    }
  }, [handleSku, stopStream])

  // Start html5-qrcode library as fallback
  useEffect(() => {
    if (!useLibrary) return

    let scanner: import('html5-qrcode').Html5QrcodeScanner | null = null

    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      setStatus('scanning')
      scanner = new Html5QrcodeScanner(
        'barcode-reader-lib',
        { fps: 10, qrbox: { width: 250, height: 150 }, rememberLastUsedCamera: true },
        false
      )
      scanner.render(
        (decodedText) => {
          scanner?.clear().catch(() => {})
          handleSku(decodedText)
        },
        () => {}
      )
    })

    return () => { scanner?.clear().catch(() => {}) }
  }, [useLibrary, handleSku])

  // Initial permission + start
  useEffect(() => {
    startNativeScanner()
    return () => stopStream()
  }, [startNativeScanner, stopStream])

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => { stopStream(); onBack() }} className="text-slate-400 hover:text-white -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" />Back
      </Button>

      {status === 'requesting' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
          <p className="text-sm text-slate-400">Requesting camera access…</p>
        </div>
      )}

      {status === 'denied' && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CameraOff className="h-10 w-10 text-red-400" />
            <p className="text-sm font-medium text-red-300">Camera access denied</p>
            <p className="text-xs text-slate-400">
              Allow camera access in your browser settings, then reload.
            </p>
            <p className="text-xs text-slate-500">
              Chrome: tap the lock icon in the address bar → Site settings → Camera → Allow
            </p>
          </div>
          <Button variant="outline" className="w-full border-slate-700" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      )}

      {status === 'scanning' && (
        <div ref={containerRef} className="space-y-2">
          <p className="text-sm text-slate-400">Point the camera at the barcode or QR code.</p>
          {/* Native video feed */}
          {!useLibrary && (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
              {/* Scan guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-28 border-2 border-violet-400 rounded-lg opacity-70" />
              </div>
            </div>
          )}
          {/* Library fallback feed */}
          {useLibrary && <div id="barcode-reader-lib" className="rounded-lg overflow-hidden" />}
        </div>
      )}

      {status === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
          <p className="text-sm text-slate-400">
            Looking up SKU: <span className="text-white font-mono">{scannedSku}</span>
          </p>
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
            <p className="text-sm text-slate-300">
              Stock: {product.currentStock} {product.category === 'filament' ? 'spools' : 'bottles'}
            </p>
          </div>
          <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => onProductFound(product)}>
            Proceed to Transaction
          </Button>
          <Button variant="ghost" className="w-full text-slate-400" onClick={() => {
            setStatus('requesting')
            setProduct(null)
            startNativeScanner()
          }}>
            Scan Again
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-300">{errorMsg}</p>
          </div>
          <Button variant="outline" className="w-full border-slate-700" onClick={() => {
            setStatus('requesting')
            startNativeScanner()
          }}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}
