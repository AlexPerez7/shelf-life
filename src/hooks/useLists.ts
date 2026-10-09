import { useCallback, useEffect, useState } from 'react'
import { supabase, ensureSession } from '../lib/supabaseClient'

// La lista de listas se comparte a nivel de app (ver ListsProvider). Las
// listas son comunes a los tres trackers: `list_items` apunta a `items`.
export { useLists } from '../contexts/ListsContext'

export function useItemListIds(itemId: string | undefined) {
  const [listIds, setListIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const fetchListIds = useCallback(async () => {
    if (!itemId) return
    setLoading(true)
    await ensureSession()
    const { data, error } = await supabase
      .from('list_items')
      .select('list_id')
      .eq('item_id', itemId)

    if (!error) setListIds(new Set(data.map((row) => row.list_id as string)))
    setLoading(false)
  }, [itemId])

  useEffect(() => {
    fetchListIds()
  }, [fetchListIds])

  /** Optimista: el chip cambia al instante; si falla, vuelve atrás. */
  const toggle = useCallback(
    async (listId: string) => {
      if (!itemId) return
      const removing = listIds.has(listId)
      const apply = (add: boolean) =>
        setListIds((prev) => {
          const next = new Set(prev)
          if (add) next.add(listId)
          else next.delete(listId)
          return next
        })
      apply(!removing)
      const { error } = removing
        ? await supabase.from('list_items').delete().eq('list_id', listId).eq('item_id', itemId)
        : await supabase.from('list_items').insert({ list_id: listId, item_id: itemId })
      if (error) {
        apply(removing)
        throw error
      }
    },
    [itemId, listIds]
  )

  return { listIds, loading, toggle }
}

export function useListItemIds(listId: string | undefined) {
  const [itemIds, setItemIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItemIds = useCallback(async () => {
    if (!listId) return
    setLoading(true)
    await ensureSession()
    const { data, error } = await supabase
      .from('list_items')
      .select('item_id')
      .eq('list_id', listId)
      .order('added_at', { ascending: false })

    if (!error) setItemIds(data.map((row) => row.item_id as string))
    setLoading(false)
  }, [listId])

  useEffect(() => {
    fetchItemIds()
  }, [fetchItemIds])

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!listId) return
      const { error } = await supabase
        .from('list_items')
        .delete()
        .eq('list_id', listId)
        .eq('item_id', itemId)
      if (error) throw error
      setItemIds((prev) => prev.filter((id) => id !== itemId))
    },
    [listId]
  )

  /** Vuelve a agregar un ítem quitado (para "Deshacer"), en su posición. */
  const restoreItem = useCallback(
    async (itemId: string, index: number) => {
      if (!listId) return
      const { error } = await supabase
        .from('list_items')
        .insert({ list_id: listId, item_id: itemId })
      if (error) throw error
      setItemIds((prev) => {
        if (prev.includes(itemId)) return prev
        const next = [...prev]
        next.splice(Math.min(index, next.length), 0, itemId)
        return next
      })
    },
    [listId]
  )

  return { itemIds, loading, removeItem, restoreItem }
}
