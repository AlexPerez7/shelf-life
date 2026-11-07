import { useCallback, useEffect, useState } from 'react'
import { ensureSession, supabase } from '../lib/supabaseClient'
import type { Item } from '../types/item'

// Lo que hay en la papelera de libros: se pinta al instante desde acá y se
// revalida al montar (como useGoals y useActivity).
let cache: Item[] | null = null
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') cache = null
})

/**
 * Libros en la papelera, el más reciente primero. `items` es `null` mientras
 * carga por primera vez. Con `enabled` en falso (la base no tiene la
 * migración 0015) no pide nada.
 */
export function useTrash(enabled = true) {
  const [items, setItems] = useState<Item[] | null>(cache)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ensureSession()
      .then(() =>
        supabase
          .from('items')
          .select('*')
          .eq('media_type', 'book')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false })
      )
      .then(({ data, error }) => {
        if (cancelled) return
        setFailed(error != null)
        if (error) return
        cache = data as Item[]
        setItems(cache)
      })
    return () => {
      cancelled = true
    }
  }, [enabled])

  /** Saca un libro de la lista (ya restaurado o eliminado). */
  const forget = useCallback((id: string) => {
    cache = (cache ?? []).filter((i) => i.id !== id)
    setItems((prev) => (prev ? prev.filter((i) => i.id !== id) : prev))
  }, [])

  /** Elimina para siempre todo lo que hay en la papelera. */
  const empty = useCallback(async () => {
    const { error } = await supabase.from('items').delete().eq('media_type', 'book').not('deleted_at', 'is', null)
    if (error) throw error
    cache = []
    setItems([])
  }, [])

  return { items: enabled ? items : [], failed, forget, empty }
}
