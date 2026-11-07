import { useCallback, useEffect, useState } from 'react'
import { ensureSession, supabase } from '../lib/supabaseClient'
import type { Goal, GoalKind } from '../lib/goals'
import type { TrackerId } from '../trackers/trackers'

// Metas por año: se pintan al instante desde acá y se revalidan al montar.
type GoalsState = { goals: Goal[]; available: boolean | null; pages: boolean }
const cache = new Map<number, GoalsState>()
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') cache.clear()
})

/**
 * Metas de un año. `available` es falso si la tabla `goals` todavía no existe
 * (migración 0012 sin aplicar) o no se pudo leer: la UI de metas se oculta.
 * `pages` es falso si falta la migración 0014 (la meta de páginas).
 */
export function useGoals(year: number) {
  const [state, setState] = useState<GoalsState>(
    () => cache.get(year) ?? { goals: [], available: null, pages: false }
  )

  useEffect(() => {
    let cancelled = false
    ensureSession()
      .then(async () => {
        const withKind = await supabase.from('goals').select('tracker, year, target, kind').eq('year', year)
        if (!withKind.error) return { rows: withKind.data, ok: true, pages: true }
        // Sin la migración 0014 no existe `kind`: se leen las metas de siempre.
        const legacy = await supabase.from('goals').select('tracker, year, target').eq('year', year)
        return { rows: legacy.data, ok: !legacy.error, pages: false }
      })
      .then(({ rows, ok, pages }) => {
        if (cancelled) return
        const goals = ((rows as (Omit<Goal, 'kind'> & { kind?: GoalKind })[] | null) ?? []).map((g) => ({
          ...g,
          kind: g.kind ?? 'items',
        }))
        const next = { goals: ok ? goals : [], available: ok, pages: ok && pages }
        cache.set(year, next)
        setState(next)
      })
    return () => {
      cancelled = true
    }
  }, [year])

  /** Guarda la meta de un tracker (de libros leídos o de páginas); `null` la quita. */
  const setGoal = useCallback(
    async (tracker: TrackerId, target: number | null, kind: GoalKind = 'items') => {
      const current = cache.get(year)
      const hasKind = current?.pages ?? false
      const others = (current?.goals ?? []).filter((g) => !(g.tracker === tracker && g.kind === kind))
      let goals: Goal[]
      if (target == null) {
        let query = supabase.from('goals').delete().eq('tracker', tracker).eq('year', year)
        if (hasKind) query = query.eq('kind', kind)
        const { error } = await query
        if (error) throw error
        goals = others
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error('No hay sesión activa')
        const { data, error } = await supabase
          .from('goals')
          .upsert(
            {
              user_id: user.id,
              tracker,
              year,
              target,
              ...(hasKind ? { kind } : {}),
              updated_at: new Date().toISOString(),
            },
            { onConflict: hasKind ? 'user_id,tracker,year,kind' : 'user_id,tracker,year' }
          )
          .select(hasKind ? 'tracker, year, target, kind' : 'tracker, year, target')
          .single()
        if (error) throw error
        goals = [...others, { ...(data as unknown as Goal), kind }]
      }
      const next = { goals, available: true, pages: hasKind }
      cache.set(year, next)
      setState(next)
    },
    [year]
  )

  return { goals: state.goals, available: state.available, pagesAvailable: state.pages, setGoal }
}
