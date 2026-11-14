import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, ensureSession } from '../lib/supabaseClient'
import { useLists } from '../contexts/ListsContext'
import { readCache, writeCache } from '../lib/localCache'
import { LISTS_CACHE_PREFIX, overlayItemListIds, overlayListItemIds } from '../lib/pendingLists'

// La lista de listas se comparte a nivel de app (ver ListsProvider). Las
// listas son comunes a los tres trackers: `list_items` apunta a `items`.
export { useLists } from '../contexts/ListsContext'

// Los cambios (agregar o quitar un título de una lista) se ven al instante,
// van a la base por `mutate` (con cola sin conexión) y la última lectura se
// guarda en el dispositivo para verse también sin señal.

export function useItemListIds(itemId: string | undefined) {
  const { userId, mutate, pendingOps, rejectedCount } = useLists()
  const cacheKey = userId && itemId ? `${LISTS_CACHE_PREFIX}item:${userId}:${itemId}` : null
  const [listIds, setListIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  /** Ítem de quien son los datos que hay en pantalla (para no guardar en la cache los de otro). */
  const loadedFor = useRef<string | undefined>(undefined)

  const fetchListIds = useCallback(async () => {
    if (!itemId) return
    if (loadedFor.current !== itemId) setLoading(true)
    await ensureSession()
    const { data, error } = await supabase
      .from('list_items')
      .select('list_id')
      .eq('item_id', itemId)

    if (!error) {
      setListIds(overlayItemListIds(new Set(data.map((row) => row.list_id as string)), itemId, pendingOps()))
      loadedFor.current = itemId
    }
    setLoading(false)
  }, [itemId, pendingOps])

  // Primero lo último que se vio (sirve sin señal) y después lo de la base.
  useEffect(() => {
    if (cacheKey && loadedFor.current !== itemId) {
      const cached = readCache<string[]>(cacheKey)
      if (cached) {
        setListIds(new Set(cached.data))
        setLoading(false)
        loadedFor.current = itemId
      }
    }
    fetchListIds()
  }, [cacheKey, itemId, fetchListIds, rejectedCount])

  useEffect(() => {
    if (cacheKey && loadedFor.current === itemId) writeCache(cacheKey, [...listIds])
  }, [cacheKey, itemId, listIds])

  /** Optimista: el chip cambia al instante; si la base lo rechaza, vuelve atrás. */
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
      try {
        await mutate({ type: removing ? 'remove' : 'add', listId, itemId })
      } catch (err) {
        apply(removing)
        throw err
      }
    },
    [itemId, listIds, mutate]
  )

  return { listIds, loading, toggle }
}

export function useListItemIds(listId: string | undefined) {
  const { userId, mutate, pendingOps, rejectedCount } = useLists()
  const cacheKey = userId && listId ? `${LISTS_CACHE_PREFIX}list:${userId}:${listId}` : null
  const [itemIds, setItemIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const loadedFor = useRef<string | undefined>(undefined)

  const fetchItemIds = useCallback(async () => {
    if (!listId) return
    if (loadedFor.current !== listId) setLoading(true)
    await ensureSession()
    const { data, error } = await supabase
      .from('list_items')
      .select('item_id')
      .eq('list_id', listId)
      .order('added_at', { ascending: false })

    if (!error) {
      setItemIds(overlayListItemIds(data.map((row) => row.item_id as string), listId, pendingOps()))
      loadedFor.current = listId
    }
    setLoading(false)
  }, [listId, pendingOps])

  useEffect(() => {
    if (cacheKey && loadedFor.current !== listId) {
      const cached = readCache<string[]>(cacheKey)
      if (cached) {
        setItemIds(cached.data)
        setLoading(false)
        loadedFor.current = listId
      }
    }
    fetchItemIds()
  }, [cacheKey, listId, fetchItemIds, rejectedCount])

  useEffect(() => {
    if (cacheKey && loadedFor.current === listId) writeCache(cacheKey, itemIds)
  }, [cacheKey, listId, itemIds])

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!listId) return
      const previous = itemIds
      setItemIds((prev) => prev.filter((id) => id !== itemId))
      try {
        await mutate({ type: 'remove', listId, itemId })
      } catch (err) {
        setItemIds(previous)
        throw err
      }
    },
    [itemIds, listId, mutate]
  )

  /** Vuelve a agregar un ítem quitado (para "Deshacer"), en su posición. */
  const restoreItem = useCallback(
    async (itemId: string, index: number) => {
      if (!listId) return
      const insertAt = (prev: string[]) => {
        if (prev.includes(itemId)) return prev
        const next = [...prev]
        next.splice(Math.min(index, next.length), 0, itemId)
        return next
      }
      setItemIds(insertAt)
      try {
        await mutate({ type: 'add', listId, itemId })
      } catch (err) {
        setItemIds((prev) => prev.filter((id) => id !== itemId))
        throw err
      }
    },
    [listId, mutate]
  )

  return { itemIds, loading, removeItem, restoreItem }
}
