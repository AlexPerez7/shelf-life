import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { haptic } from '../../lib/haptics'
import { barcodeDetector } from '../../lib/barcode'

/** Un EAN-13 de libro es un ISBN-13: empieza con 978 o 979. */
const isIsbn = (code: string) => /^97[89]\d{10}$/.test(code)

/**
 * Cámara a pantalla completa que busca el código de barras de un libro y
 * devuelve su ISBN. Se cierra sola al encontrarlo.
 */
export function IsbnScanner({ onDetected, onClose }: { onDetected: (isbn: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    const Ctor = barcodeDetector()
    if (!Ctor) return
    let stream: MediaStream | null = null
    let timer: number | undefined
    let stopped = false
    const detector = new Ctor({ formats: ['ean_13'] })

    async function scan() {
      const video = videoRef.current
      if (stopped || !video) return
      try {
        if (video.readyState >= 2) {
          const codes = await detector.detect(video)
          const code = codes.map((c) => c.rawValue).find(Boolean)
          if (code && isIsbn(code)) {
            haptic([10, 40, 10])
            onDetected(code)
            return
          }
          if (code) setHint('Ese código no es de un libro. Busca el que empieza con 978 o 979.')
        }
      } catch {
        /* un cuadro que no se pudo leer: se sigue intentando */
      }
      timer = window.setTimeout(scan, 250)
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const video = videoRef.current
        if (!video) return
        video.srcObject = s
        video.play().catch(() => {})
        scan()
      })
      .catch(() => setError('No se pudo abrir la cámara. Revisa el permiso de cámara del navegador.'))

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onDetected])

  return (
    <div className="fade-in fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-label="Escanear ISBN">
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />

      {/* Guía: una franja horizontal donde poner el código. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-32 w-[80%] max-w-sm rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ring-2 ring-white/80" />
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar la cámara"
        className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white"
        style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <X size={22} />
      </button>

      <p
        className="absolute inset-x-6 text-center text-sm text-white"
        style={{ bottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}
      >
        {error ?? hint ?? 'Apunta al código de barras de la contratapa'}
      </p>
    </div>
  )
}
