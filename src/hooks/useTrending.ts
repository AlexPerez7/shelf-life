import { useEffect, useState } from 'react'
import { trendingMedia } from '../lib/media'
import type { MediaSearchResult, ScreenType } from '../types/item'

// Una vez por tipo y por sesión de la app: las tendencias cambian por semana.
const cache = new Map<ScreenType, MediaSearchResult[]>()

/**
 * Tendencias de un tipo de Pantalla. `null` mientras carga; si falla (por
 * ejemplo, con la Edge Function sin el modo `trending` desplegado), lista
 * vacía y la pantalla sigue como antes.
 */
export function useTrending(type: ScreenType) {
  const [state, setState] = useState<{ type: ScreenType; results: MediaSearchResult[] } | null>(() => {
    const cached = cache.get(type)
    return cached ? { type, results: cached } : null
  })

  useEffect(() => {
    if (cache.has(type)) return
    let cancelled = false
    trendingMedia(type)
      .catch(() => [] as MediaSearchResult[])
      .then((results) => {
        cache.set(type, results)
        if (!cancelled) setState({ type, results })
      })
    return () => {
      cancelled = true
    }
  }, [type])

  const cached = cache.get(type)
  if (cached) return cached
  return state?.type === type ? state.results : null
}
