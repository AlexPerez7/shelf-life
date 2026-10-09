import { useEffect, useState } from 'react'
import { ensureSession, supabase } from '../lib/supabaseClient'
import type { ActivityRow } from '../lib/stats'
import type { MediaType } from '../types/item'

// Última respuesta de cada consulta: al volver a una pantalla se pinta al
// instante y se revalida en segundo plano (como las bibliotecas).
const cache = new Map<string, ActivityRow[]>()
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') cache.clear()
})

/**
 * Actividad de los últimos `months` meses de ciertos tipos (sesiones de
 * juego, episodios y películas vistas, páginas leídas), para las
 * estadísticas, el historial y el inicio; con `months` = null, toda. `null`
 * solo la primera vez, mientras carga; si falla, queda vacía.
 */
export function useActivity(types: MediaType[], months: number | null = 12) {
  const typesKey = types.join(',')
  const key = `${typesKey}|${months ?? 'all'}`
  const [state, setState] = useState<{ key: string; rows: ActivityRow[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    ensureSession().then(() => {
      let query = supabase
        .from('activity_log')
        .select('id, item_id, occurred_at, duration_minutes, progress_delta, items!inner(media_type)')
        .in('items.media_type', typesKey.split(','))
      if (months != null) {
        const since = new Date()
        since.setMonth(since.getMonth() - months, 1)
        query = query.gte('occurred_at', since.toISOString())
      }
      return query.order('occurred_at', { ascending: true }).then(({ data, error }) => {
        if (cancelled) return
        // Un error no borra lo que ya había en cache.
        const rows = error ? (cache.get(key) ?? []) : ((data as ActivityRow[] | null) ?? [])
        if (!error) cache.set(key, rows)
        setState({ key, rows })
      })
    })
    return () => {
      cancelled = true
    }
  }, [key, typesKey, months])

  return (state?.key === key ? state.rows : null) ?? cache.get(key) ?? null
}
