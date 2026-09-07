import { useRef, useState } from 'react'
import { createWorker } from 'tesseract.js'
import { Camera, ArrowLeft, Loader2, Tag, RotateCw, Search, PackagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiGetProduct } from '@/services/api'
import {
  extractSkuCandidates, skuVariants, onlyFoundBarcode, isBarcodeNumber,
  type SkuCandidate,
} from '@/lib/skuExtract'
import type { Product } from '@/types'

interface OcrScannerProps {
  onProductFound: (product: Product) => void
  /** Raised when a SKU was read from the label but is not in the catalogue. */
  onAddRequest: (sku: string) => void
  onBack: () => void
}

type Phase = 'idle' | 'camera' | 'processing' | 'results' | 'loading' | 'error'

/**
 * Draw the source canvas rotated by `deg` into a new canvas.
 * Labels are frequently photographed sideways, and Tesseract is poor at
 * reading rotated text, so we OCR several orientations and keep the best.
 */
function rotateCanvas(src: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  const out = document.createElement('canvas')
  const swap = deg === 90 || deg === 270
  out.width  = swap ? src.height : src.width
  out.height = swap ? src.width  : src.height
  const ctx = out.getContext('2d')!
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  return out
}

/**
 * Grayscale + contrast stretch + upscale. Small text on glossy labels reads
 * far more reliably after this than from the raw camera frame.
 */
function preprocess(src: HTMLCanvasElement, scale = 2): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width  = src.width * scale
  out.height = src.height * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, out.width, out.height)

  const img = ctx.getImageData(0, 0, out.width, out.height)
  const d = img.data

  // Grayscale + track min/max for contrast stretch
  let min = 255, max = 0
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0
    d[i] = d[i + 1] = d[i + 2] = g
    if (g < min) min = g
    if (g > max) max = g
  }
  const range = Math.max(1, max - min)
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) / range) * 255
    const c = v < 0 ? 0 : v > 255 ? 255 : v
    d[i] = d[i + 1] = d[i + 2] = c
  }
  ctx.putImageData(img, 0, 0)
  return out
}

export function OcrScanner({ onProductFound, onAddRequest, onBack }: OcrScannerProps) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase]         = useState<Phase>('idle')
  const [ocrText, setOcrText]     = useState('')
  const [candidates, setCandidates] = useState<SkuCandidate[]>([])
  const [errorMsg, setErrorMsg]   = useState('')
  const [progress, setProgress]   = useState(0)
  const [manualSku, setManualSku] = useState('')
  /** True when the only thing recognised was a retail barcode number. */
  const [barcodeOnly, setBarcodeOnly] = useState(false)
  /** SKU that was read but not found, offered for creation. */
  const [addableSku, setAddableSku]   = useState<string | null>(null)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const startCamera = async () => {
    setPhase('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve()
        setTimeout(resolve, 3000)
      })
      await video.play()
    } catch {
      setErrorMsg('Camera access denied. Allow camera permission and try again.')
      setPhase('error')
    }
  }

  const capture = async () => {
    const video  = videoRef.current!
    const canvas = canvasRef.current!
    canvas.width  = video.videoWidth  || 1280
    canvas.height = video.videoHeight || 720
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    stopCamera()
    setPhase('processing')
    setProgress(0)

    try {
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100))
        },
      })

      // Restrict the charset — label SKUs are uppercase alnum. This markedly
      // reduces glyph confusion versus the default full charset.
      await worker.setParameters({
        tessedit_char_whitelist:
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:+-.,/ ',
      })

      const base = preprocess(canvas, 2)

      // Try each orientation, keep whichever yields the strongest SKU candidate.
      let bestText = ''
      let bestCands: SkuCandidate[] = []
      let bestScore = -1

      for (const deg of [0, 90, 270, 180]) {
        const target = deg === 0 ? base : rotateCanvas(base, deg)
        const { data } = await worker.recognize(target)
        const text = data.text ?? ''
        // Retail barcode numbers are deliberately excluded: on many labels the
        // barcode differs from the SKU, and offering it invites duplicates.
        const cands = extractSkuCandidates(text, { includeBarcodes: false })
        const top = cands.length > 0 ? cands[0].score : 0

        if (top > bestScore) {
          bestScore = top
          bestText = text
          bestCands = cands
        }
        // A captioned SKU match is conclusive — stop rotating.
        if (cands.length > 0 && cands[0].kind === 'labelled') break
      }

      await worker.terminate()
      setOcrText(bestText)
      setCandidates(bestCands)
      setBarcodeOnly(bestCands.length === 0 && onlyFoundBarcode(bestText))
      setPhase('results')
    } catch (err) {
      setErrorMsg(`OCR failed: ${err instanceof Error ? err.message : 'unknown error'}`)
      setPhase('error')
    }
  }

  /** Look up a SKU, retrying OCR-confusion variants before giving up. */
  const lookup = async (raw: string) => {
    const sku = raw.trim().toUpperCase()
    if (!sku) return

    if (isBarcodeNumber(sku)) {
      setAddableSku(null)
      setErrorMsg(
        `${sku} is a retail barcode, not a SKU. Enter the SKU printed on the label instead.`
      )
      setPhase('error')
      return
    }

    setPhase('loading')
    for (const attempt of skuVariants(sku)) {
      const res = await apiGetProduct(attempt)
      if (res.success && res.data) {
        onProductFound(res.data)
        return
      }
    }
    setAddableSku(sku)
    setErrorMsg(`No product in the list matches "${sku}".`)
    setPhase('error')
  }

  const reset = () => {
    stopCamera()
    setPhase('idle')
    setOcrText('')
    setCandidates([])
    setErrorMsg('')
    setProgress(0)
    setManualSku('')
    setBarcodeOnly(false)
    setAddableSku(null)
  }

  return (
    <div className="space-y-4">
      <Button
        variant="ghost" size="sm"
        onClick={() => { reset(); onBack() }}
        className="text-slate-400 hover:text-white -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />Back
      </Button>

      {/* Video kept mounted so the ref is valid the moment the stream starts */}
      <div className={phase === 'camera' ? 'space-y-3' : 'hidden'}>
        <p className="text-sm text-slate-400">
          Fill the frame with the label and hold steady, then Capture.
        </p>
        <div className="rounded-lg overflow-hidden bg-black">
          <video ref={videoRef} className="w-full max-h-72 object-cover" playsInline muted autoPlay />
        </div>
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <RotateCw className="h-3 w-3 shrink-0" />
          Sideways labels are fine — all orientations are checked automatically.
        </p>
        <Button className="w-full bg-cyan-700 hover:bg-cyan-600" onClick={capture}>
          Capture &amp; Read Text
        </Button>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {phase === 'idle' && (
        <div className="text-center space-y-4 py-4">
          <div className="w-16 h-16 rounded-full bg-cyan-900/40 border border-cyan-700 flex items-center justify-center mx-auto">
            <Camera className="h-8 w-8 text-cyan-400" />
          </div>
          <div>
            <p className="font-medium text-white">OCR Text Scanner</p>
            <p className="text-sm text-slate-400 mt-1">
              Reads the printed text on the label and pulls out the SKU.
            </p>
          </div>
          <Button className="w-full bg-cyan-700 hover:bg-cyan-600" onClick={startCamera}>
            Start Camera
          </Button>
        </div>
      )}

      {phase === 'processing' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-slate-400">Reading label…{progress > 0 ? ` ${progress}%` : ''}</p>
          <p className="text-xs text-slate-600">Checking all orientations</p>
        </div>
      )}

      {phase === 'results' && (
        <div className="space-y-4">
          {candidates.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-slate-300 mb-2">
                Tap the correct code:
              </p>
              <div className="flex flex-wrap gap-2">
                {candidates.slice(0, 8).map((c) => (
                  <button
                    key={c.value}
                    onClick={() => lookup(c.value)}
                    className={[
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-mono transition-colors',
                      c.kind === 'labelled'
                        ? 'bg-emerald-900/50 border-emerald-600 text-emerald-300 hover:bg-emerald-800/50'
                        : 'bg-violet-900/50 border-violet-700 text-violet-300 hover:bg-violet-800/50',
                    ].join(' ')}
                  >
                    <Tag className="h-3 w-3" />
                    {c.value}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Green = found next to a “SKU” caption · Violet = matched SKU pattern.
                Barcode numbers are ignored on purpose.
              </p>
            </div>
          ) : barcodeOnly ? (
            <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-300">Only a barcode number was recognised.</p>
              <p className="text-xs text-amber-400/70 mt-1">
                That barcode is not the SKU. Re-aim at the line on the label that reads
                “SKU”, or type it below.
              </p>
            </div>
          ) : (
            <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-300">No SKU detected in the label text.</p>
              <p className="text-xs text-amber-400/70 mt-1">
                Try again with more light and the label filling the frame, or type it below.
              </p>
            </div>
          )}

          {/* Always offer a manual override */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400" htmlFor="ocr-manual">
              Or enter the SKU yourself
            </label>
            <div className="flex gap-2">
              <Input
                id="ocr-manual"
                className="bg-slate-800 border-slate-700 text-white font-mono uppercase"
                placeholder="e.g. PPNA11KPAL"
                value={manualSku}
                onChange={(e) => setManualSku(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') lookup(manualSku) }}
              />
              <Button
                className="bg-violet-600 hover:bg-violet-700 shrink-0"
                onClick={() => lookup(manualSku)}
                disabled={!manualSku.trim()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <details className="group">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">
              Show raw recognised text
            </summary>
            <div className="mt-2 bg-slate-800 rounded-lg p-3 text-xs text-slate-400 font-mono whitespace-pre-wrap max-h-40 overflow-auto">
              {ocrText || '(no text detected)'}
            </div>
          </details>

          <Button variant="outline" className="w-full border-slate-700 text-slate-300" onClick={reset}>
            Scan Again
          </Button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
          <p className="text-sm text-slate-400">Looking up product…</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-4">
          <div className={[
            'rounded-lg p-4 border',
            addableSku ? 'bg-amber-900/25 border-amber-800' : 'bg-red-900/30 border-red-800',
          ].join(' ')}>
            <p className={`text-sm ${addableSku ? 'text-amber-300' : 'text-red-300'}`}>
              {errorMsg}
            </p>
          </div>

          {addableSku && (
            <Button
              className="w-full bg-emerald-700 hover:bg-emerald-600 gap-2"
              onClick={() => onAddRequest(addableSku)}
            >
              <PackagePlus className="h-4 w-4" />
              Add {addableSku} as a new product
            </Button>
          )}

          {candidates.length > 0 && (
            <Button variant="outline" className="w-full border-slate-700 text-slate-300"
              onClick={() => { setAddableSku(null); setPhase('results') }}>
              Back to Results
            </Button>
          )}
          <Button variant="outline" className="w-full border-slate-700" onClick={reset}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}
