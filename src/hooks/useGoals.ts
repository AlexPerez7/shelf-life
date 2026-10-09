import { useCallback, useEffect, useState } from 'react'
import { ensureSession, supabase } from '../lib/supabaseClient'
import type { Goal } from '../lib/goals'
import type { TrackerId } from '../trackers/trackers'

// Metas por año: se pintan al instante desde acá y se revalidan al montar.
const cache = new Map<number, { goals: Goal[]; available: boolean }>()
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') cache.clear()
})

/**
 * Metas de un año. `available` es falso si la tabla `goals` todavía no existe
 * (migración 0012 sin aplicar) o no se pudo leer: la UI de metas se oculta.
 */
export function useGoals(year: number) {
  const [state, setState] = useState(() => cache.get(year) ?? { goals: [] as Goal[], available: null as boolean | null })

  useEffect(() => {
    let cancelled = false
    ensureSession().then(() =>
      supabase
        .from('goals')
        .select('tracker, year, target')
        .eq('year', year)
        .then(({ data, error }) => {
          if (cancelled) return
          const next = { goals: error ? [] : ((data as Goal[] | null) ?? []), available: !error }
          cache.set(year, next)
          setState(next)
        })
    )
    return () => {
      cancelled = true
    }
  }, [year])

  /** Guarda la meta de un tracker; `null` la quita. */
  const setGoal = useCallback(
    async (tracker: TrackerId, target: number | null) => {
      let goals: Goal[]
      if (target == null) {
        const { error } = await supabase.from('goals').delete().eq('tracker', tracker).eq('year', year)
        if (error) throw error
        goals = (cache.get(year)?.goals ?? []).filter((g) => g.tracker !== tracker)
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error('No hay sesión activa')
        const { data, error } = await supabase
          .from('goals')
          .upsert(
            { user_id: user.id, tracker, year, target, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,tracker,year' }
          )
          .select('tracker, year, target')
          .single()
        if (error) throw error
        goals = [...(cache.get(year)?.goals ?? []).filter((g) => g.tracker !== tracker), data as Goal]
      }
      const next = { goals, available: true }
      cache.set(year, next)
      setState(next)
    },
    [year]
  )

  return { goals: state.goals, available: state.available, setGoal }
}
