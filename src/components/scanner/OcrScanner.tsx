import { useRef, useState } from 'react'
import { createWorker } from 'tesseract.js'
import { Camera, ArrowLeft, Loader2, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiGetProduct } from '@/services/api'
import type { Product } from '@/types'

interface OcrScannerProps {
  onProductFound: (product: Product) => void
  onBack: () => void
}

// Extract likely SKU tokens from OCR text
// SKU pattern: uppercase letters and digits with dashes, e.g. PLA-A11-KPAH
function extractTokens(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const skuPattern = /\b[A-Z]{2,}[-][A-Z0-9]{1,}([-][A-Z0-9]{1,})*/g
  const tokens = new Set<string>()
  for (const line of lines) {
    const matches = line.match(skuPattern)
    if (matches) matches.forEach((m) => tokens.add(m))
  }
  return Array.from(tokens)
}

type Phase = 'idle' | 'camera' | 'processing' | 'results' | 'loading' | 'error'

export function OcrScanner({ onProductFound, onBack }: OcrScannerProps) {
  // Always keep video + canvas in DOM so refs are available immediately
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase]       = useState<Phase>('idle')
  const [ocrText, setOcrText]   = useState('')
  const [tokens, setTokens]     = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const startCamera = async () => {
    setPhase('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
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
      setErrorMsg('Camera access denied. Please allow camera permission and try again.')
      setPhase('error')
    }
  }

  const capture = async () => {
    const video  = videoRef.current!
    const canvas = canvasRef.current!
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    stopCamera()
    setPhase('processing')

    try {
      const worker = await createWorker('eng')
      const { data } = await worker.recognize(canvas)
      await worker.terminate()
      const text = data.text
      setOcrText(text)
      const found = extractTokens(text)
      setTokens(found)
      setPhase('results')
    } catch {
      setErrorMsg('OCR failed. Please try again.')
      setPhase('error')
    }
  }

  const selectToken = async (token: string) => {
    setPhase('loading')
    const res = await apiGetProduct(token)
    if (res.success && res.data) {
      onProductFound(res.data)
    } else {
      setErrorMsg(`No product found for SKU: "${token}"`)
      setPhase('error')
    }
  }

  const reset = () => {
    stopCamera()
    setPhase('idle')
    setOcrText('')
    setTokens([])
    setErrorMsg('')
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

      {/* Video always in DOM — hidden unless in camera phase */}
      <div className={phase === 'camera' ? 'space-y-3' : 'hidden'}>
        <p className="text-sm text-slate-400">Point at the label, then press Capture.</p>
        <div className="rounded-lg overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="w-full max-h-64 object-cover"
            playsInline
            muted
            autoPlay
          />
        </div>
        <Button className="w-full bg-cyan-700 hover:bg-cyan-600" onClick={capture}>
          Capture &amp; Read Text
        </Button>
      </div>

      {/* Canvas always in DOM for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {phase === 'idle' && (
        <div className="text-center space-y-4 py-4">
          <div className="w-16 h-16 rounded-full bg-cyan-900/40 border border-cyan-700 flex items-center justify-center mx-auto">
            <Camera className="h-8 w-8 text-cyan-400" />
          </div>
          <div>
            <p className="font-medium text-white">OCR Text Scanner</p>
            <p className="text-sm text-slate-400 mt-1">
              The camera will read all text on the label and extract the SKU for you.
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
          <p className="text-sm text-slate-400">Reading text from label…</p>
        </div>
      )}

      {phase === 'results' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-300 mb-2">Recognised text:</p>
            <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400 font-mono whitespace-pre-wrap max-h-28 overflow-auto">
              {ocrText || '(no text detected)'}
            </div>
          </div>

          {tokens.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-slate-300 mb-2">Tap the SKU to look up:</p>
              <div className="flex flex-wrap gap-2">
                {tokens.map((token) => (
                  <button
                    key={token}
                    onClick={() => selectToken(token)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-900/50 border border-violet-700 text-violet-300 text-sm font-mono hover:bg-violet-800/50 transition-colors"
                  >
                    <Tag className="h-3 w-3" />
                    {token}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No SKU patterns detected. Try again or use manual entry.
            </p>
          )}

          <Button
            variant="outline"
            className="w-full border-slate-700 text-slate-300"
            onClick={reset}
          >
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
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-300">{errorMsg}</p>
          </div>
          <Button variant="outline" className="w-full border-slate-700" onClick={reset}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}
