import { useCallback, useEffect, useState } from 'react'
import { ensureSession, supabase } from '../lib/supabaseClient'
import type { Goal } from '../lib/goals'
import type { TrackerId } from '../trackers/trackers'

/**
 * Metas de un año. `available` es falso si la tabla `goals` todavía no existe
 * (migración 0012 sin aplicar) o no se pudo leer: la UI de metas se oculta.
 */
export function useGoals(year: number) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    ensureSession().then(() =>
      supabase
        .from('goals')
        .select('tracker, year, target')
        .eq('year', year)
        .then(({ data, error }) => {
          if (cancelled) return
          setAvailable(!error)
          setGoals(error ? [] : ((data as Goal[] | null) ?? []))
        })
    )
    return () => {
      cancelled = true
    }
  }, [year])

  /** Guarda la meta de un tracker; `null` la quita. */
  const setGoal = useCallback(
    async (tracker: TrackerId, target: number | null) => {
      if (target == null) {
        const { error } = await supabase.from('goals').delete().eq('tracker', tracker).eq('year', year)
        if (error) throw error
        setGoals((prev) => prev.filter((g) => g.tracker !== tracker))
        return
      }
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
      setGoals((prev) => [...prev.filter((g) => g.tracker !== tracker), data as Goal])
    },
    [year]
  )

  return { goals, available, setGoal }
}
