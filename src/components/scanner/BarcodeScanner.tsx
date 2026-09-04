import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowLeft, CheckCircle, Loader2, CameraOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiGetProduct } from '@/services/api'
import type { Product } from '@/types'

interface BarcodeScannerProps {
  onProductFound: (product: Product) => void
  onBack: () => void
}

// Native BarcodeDetector API (Android Chrome 83+)
declare class BarcodeDetector {
  constructor(options?: { formats: string[] })
  detect(image: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
  static getSupportedFormats(): Promise<string[]>
}

type Status = 'requesting' | 'scanning' | 'found' | 'error' | 'loading' | 'denied'

export function BarcodeScanner({ onProductFound, onBack }: BarcodeScannerProps) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const rafRef      = useRef<number>(0)
  const scanningRef = useRef(false)

  const [status, setStatus]         = useState<Status>('requesting')
  const [scannedSku, setScannedSku] = useState('')
  const [product, setProduct]       = useState<Product | null>(null)
  const [errorMsg, setErrorMsg]     = useState('')

  const stopStream = useCallback(() => {
    scanningRef.current = false
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

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

  const startScanner = useCallback(async () => {
    setStatus('requesting')
    stopStream()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      })
      streamRef.current = stream

      // Video element is always mounted — attach stream directly
      const video = videoRef.current!
      video.srcObject = stream

      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = reject
        setTimeout(resolve, 3000) // fallback timeout
      })

      await video.play()
      setStatus('scanning')
      scanningRef.current = true

      // Use native BarcodeDetector if available
      if (typeof BarcodeDetector !== 'undefined') {
        const formats = await BarcodeDetector.getSupportedFormats()
        const detector = new BarcodeDetector({ formats })

        const scan = async () => {
          if (!scanningRef.current) return
          if (video.readyState >= video.HAVE_CURRENT_DATA) {
            try {
              const results = await detector.detect(video)
              if (results.length > 0) {
                handleSku(results[0].rawValue)
                return
              }
            } catch {
              // ignore per-frame errors
            }
          }
          rafRef.current = requestAnimationFrame(scan)
        }
        rafRef.current = requestAnimationFrame(scan)
      } else {
        // BarcodeDetector not available — load html5-qrcode into the overlay div
        // Stop native stream first since html5-qrcode manages its own
        stopStream()
        const { Html5QrcodeScanner } = await import('html5-qrcode')
        const scanner = new Html5QrcodeScanner(
          'barcode-reader-lib',
          { fps: 10, qrbox: { width: 250, height: 150 }, rememberLastUsedCamera: true },
          false
        )
        scanner.render(
          (decodedText) => {
            scanner.clear().catch(() => {})
            handleSku(decodedText)
          },
          () => {}
        )
      }
    } catch (err: unknown) {
      const name = (err as { name?: string }).name
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setStatus('denied')
      } else {
        setStatus('error')
        setErrorMsg('Could not start camera. Please try again.')
      }
    }
  }, [handleSku, stopStream])

  // Start on mount
  useEffect(() => {
    startScanner()
    return () => stopStream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <Button
        variant="ghost" size="sm"
        onClick={() => { stopStream(); onBack() }}
        className="text-slate-400 hover:text-white -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />Back
      </Button>

      {/* Video element always in DOM so ref is always available */}
      <div className={[
        'relative rounded-lg overflow-hidden bg-black',
        status === 'scanning' ? 'block' : 'hidden',
      ].join(' ')}>
        <video
          ref={videoRef}
          className="w-full max-h-64 object-cover"
          playsInline
          muted
          autoPlay
        />
        {/* Scan guide overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-52 h-32 border-2 border-violet-400 rounded-lg opacity-80" />
        </div>
      </div>

      {/* html5-qrcode fallback container */}
      {status === 'scanning' && (
        <div id="barcode-reader-lib" />
      )}

      {status === 'requesting' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
          <p className="text-sm text-slate-400">Starting camera…</p>
        </div>
      )}

      {status === 'scanning' && (
        <p className="text-sm text-slate-400 text-center">
          Point the camera at the barcode or QR code on the spool/bottle.
        </p>
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
              Chrome: tap the lock icon → Site settings → Camera → Allow
            </p>
          </div>
          <Button variant="outline" className="w-full border-slate-700" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
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
            <p className="font-semibold text-white">
              {product.material} {product.brand} {product.color}
            </p>
            <p className="text-xs font-mono text-violet-400">{product.sku}</p>
            <p className="text-sm text-slate-300">
              Stock: {product.currentStock}{' '}
              {product.category === 'filament' ? 'spools' : 'bottles'}
            </p>
          </div>
          <Button
            className="w-full bg-violet-600 hover:bg-violet-700"
            onClick={() => onProductFound(product)}
          >
            Proceed to Transaction
          </Button>
          <Button
            variant="ghost"
            className="w-full text-slate-400"
            onClick={() => { setProduct(null); startScanner() }}
          >
            Scan Again
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-300">{errorMsg}</p>
          </div>
          <Button
            variant="outline"
            className="w-full border-slate-700"
            onClick={() => startScanner()}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}
