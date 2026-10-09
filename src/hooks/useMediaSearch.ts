import { useEffect, useState } from 'react'
import { searchMedia } from '../lib/media'
import type { MediaSearchResult, NonGameType } from '../types/item'

const SEARCH_DELAY_MS = 350

/**
 * Búsqueda de películas, series, anime o libros mientras se escribe (con
 * debounce; una respuesta vieja no pisa a una más nueva). Si la última
 * respuesta no es de la búsqueda actual, se está buscando: así el efecto no
 * toca el estado de forma síncrona. Mientras tanto quedan los resultados
 * anteriores, para no vaciar la pantalla en cada tecla.
 */
export function useMediaSearch(type: NonGameType, query: string) {
  const text = query.trim()
  const key = `${type}:${text}`
  const active = text.length >= 2
  const [response, setResponse] = useState<{
    key: string
    results: MediaSearchResult[]
    error: string | null
  } | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const timer = setTimeout(() => {
      searchMedia(type, text)
        .then((results) => !cancelled && setResponse({ key, results, error: null }))
        .catch((err) => {
          if (cancelled) return
          setResponse({ key, results: [], error: err instanceof Error ? err.message : 'No se pudo buscar' })
        })
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [active, type, text, key])

  return {
    /** Hay texto suficiente para buscar. */
    active,
    results: active ? (response?.results ?? []) : [],
    error: active && response?.key === key ? response.error : null,
    searching: active && response?.key !== key,
  }
}
