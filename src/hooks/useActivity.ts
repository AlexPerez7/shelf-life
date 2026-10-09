import { useEffect, useState } from 'react'
import { ensureSession, supabase } from '../lib/supabaseClient'
import type { ActivityRow } from '../lib/stats'
import type { NonGameType } from '../types/item'

/**
 * Actividad de los últimos `months` meses de ciertos tipos (episodios y
 * películas vistas, páginas leídas), para las estadísticas y el historial;
 * con `months` = null, toda. `null` mientras carga; si falla, queda vacía.
 */
export function useActivity(types: NonGameType[], months: number | null = 12) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  const typesKey = types.join(',')

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
      return query
        .order('occurred_at', { ascending: true })
        .then(({ data }) => {
          if (!cancelled) setRows((data as ActivityRow[] | null) ?? [])
        })
    })
    return () => {
      cancelled = true
    }
  }, [typesKey, months])

  return rows
}
