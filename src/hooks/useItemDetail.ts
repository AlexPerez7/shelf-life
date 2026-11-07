import { useEffect, useState } from 'react'

/**
 * Pide el detalle de un ítem (sinopsis, notas y reseña) al abrir su ficha, si
 * todavía no está cargado (ver `lib/itemDetail.ts`). `failed` es que no se
 * pudo (sin conexión): se reintenta solo cuando vuelve la señal.
 */
export function useItemDetail(id: string | undefined, ready: boolean, load: (id: string) => Promise<void>) {
  const [failedId, setFailedId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!id || ready) return
    let cancelled = false
    load(id).catch(() => {
      if (!cancelled) setFailedId(id)
    })
    return () => {
      cancelled = true
    }
  }, [id, ready, load, attempt])

  useEffect(() => {
    const retry = () => {
      setFailedId(null)
      setAttempt((n) => n + 1)
    }
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])

  return { ready, failed: !ready && failedId === id }
}
