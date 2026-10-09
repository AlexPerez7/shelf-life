import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, ensureSession } from '../lib/supabaseClient'
import { readCache, removeCacheByPrefix, writeCache } from '../lib/localCache'
import type { Item, ItemWrite } from '../types/item'

interface Activity {
  duration_minutes?: number | null
  progress_delta?: number | null
}

interface MediaContextValue {
  /** Todo lo que no es juego (películas, series, anime; después libros). */
  items: Item[]
  loading: boolean
  error: string | null
  addItem: (item: ItemWrite & Pick<Item, 'media_type' | 'title'>) => Promise<Item>
  /**
   * Alta en lote (importaciones): un insert cada 200, avisando el avance.
   * Acepta `created_at` para conservar la fecha en que se agregó en otra app.
   */
  addItems: (
    items: (ItemWrite & Pick<Item, 'media_type' | 'title'> & { created_at?: string })[],
    onProgress?: (done: number) => void
  ) => Promise<Item[]>
  updateItem: (id: string, changes: ItemWrite) => Promise<Item>
  deleteItem: (id: string) => Promise<void>
  /**
   * Registra actividad (película vista, episodios) en `activity_log` y aplica
   * `changes` al ítem. El tiempo invertido lo suma el trigger de la DB; el
   * update posterior devuelve la fila ya con ese tiempo.
   */
  logActivity: (id: string, activity: Activity, changes: ItemWrite) => Promise<Item>
}

const MediaContext = createContext<MediaContextValue | null>(null)

const CACHE_PREFIX = 'shelflife_media_v1:'

/**
 * Biblioteca de las secciones que no son juegos. Mismo esquema que
 * GamesProvider: cache local para pintar al instante y revalidación contra la
 * DB al iniciar sesión.
 */
export function MediaProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoaded = useRef(false)
  const userIdRef = useRef<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true)
    await ensureSession()
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .neq('media_type', 'game')
      .order('created_at', { ascending: false })

    if (error) {
      if (!hasLoaded.current) setError(error.message)
    } else {
      setItems(data as Item[])
      setError(null)
      hasLoaded.current = true
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // Ver GamesProvider: mismos eventos y mismas razones.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        hasLoaded.current = false
        userIdRef.current = null
        removeCacheByPrefix(CACHE_PREFIX)
        setItems([])
        setError(null)
        setLoading(false)
        return
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (userIdRef.current !== session.user.id) {
          userIdRef.current = session.user.id
          const cached = readCache<Item[]>(CACHE_PREFIX + session.user.id)
          if (cached) {
            setItems(cached.data)
            setLoading(false)
            hasLoaded.current = true
          }
        }
        setTimeout(fetchItems, 0)
      }
    })
    return () => subscription.unsubscribe()
  }, [fetchItems])

  useEffect(() => {
    if (hasLoaded.current && userIdRef.current) {
      writeCache(CACHE_PREFIX + userIdRef.current, items)
    }
  }, [items])

  const addItem = useCallback<MediaContextValue['addItem']>(async (item) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('No hay sesión activa')

    const { data, error } = await supabase
      .from('items')
      .insert({ ...item, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    setItems((prev) => [data as Item, ...prev])
    return data as Item
  }, [])

  const addItems = useCallback<MediaContextValue['addItems']>(async (newItems, onProgress) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('No hay sesión activa')

    const created: Item[] = []
    for (let i = 0; i < newItems.length; i += 200) {
      const rows = newItems.slice(i, i + 200).map((item) => ({ ...item, user_id: user.id }))
      const { data, error } = await supabase.from('items').insert(rows).select()
      if (error) throw error
      created.push(...(data as Item[]))
      // Por tandas, para que se vea el avance.
      setItems((prev) => [...(data as Item[]), ...prev])
      onProgress?.(created.length)
    }
    return created
  }, [])

  // Último cambio pedido por ítem: solo la respuesta del último actualiza el
  // estado (las anteriores ya quedaron superadas por el cambio optimista).
  const updateSeq = useRef(new Map<string, number>())
  // Guardados en fila por ítem: con dos toques rápidos ("+1", "+1") la base
  // recibe los cambios en el mismo orden en que se hicieron.
  const queues = useRef(new Map<string, Promise<unknown>>())
  const enqueue = useCallback(<T,>(id: string, task: () => Promise<T>): Promise<T> => {
    const next = (queues.current.get(id) ?? Promise.resolve()).catch(() => {}).then(task)
    queues.current.set(id, next.catch(() => {}))
    return next
  }, [])
  // Estado actual, para tener el "antes" de un cambio optimista.
  const itemsRef = useRef<Item[]>([])
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  /**
   * Aplica `local` al instante, guarda con `write` (en fila) y deja la fila
   * que devuelve la base. Si falla, vuelve a como estaba y el error sube.
   */
  const optimistic = useCallback(
    async (id: string, local: (item: Item) => Item, write: () => Promise<Item>) => {
      const seq = (updateSeq.current.get(id) ?? 0) + 1
      updateSeq.current.set(id, seq)
      const previous = itemsRef.current.find((i) => i.id === id)
      setItems((prev) => prev.map((i) => (i.id === id ? local(i) : i)))
      try {
        const saved = await enqueue(id, write)
        if (updateSeq.current.get(id) === seq) setItems((prev) => prev.map((i) => (i.id === id ? saved : i)))
        return saved
      } catch (err) {
        if (updateSeq.current.get(id) === seq && previous) {
          setItems((prev) => prev.map((i) => (i.id === id ? previous : i)))
        }
        throw err
      }
    },
    [enqueue]
  )

  /**
   * Optimista: el cambio se ve al instante y se guarda en segundo plano (la
   * ida y vuelta a Supabase en el teléfono puede tardar segundos).
   */
  const updateItem = useCallback<MediaContextValue['updateItem']>(
    (id, changes) =>
      optimistic(
        id,
        (i) => ({ ...i, ...changes }) as Item,
        async () => {
          const { data, error } = await supabase.from('items').update(changes).eq('id', id).select().single()
          if (error) throw error
          return data as Item
        }
      ),
    [optimistic]
  )

  const deleteItem = useCallback<MediaContextValue['deleteItem']>(async (id) => {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) throw error
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  /**
   * También optimista: el avance (y el tiempo, que en la base suma un
   * trigger) se ve al instante; el registro y el cambio se guardan en fila.
   */
  const logActivity = useCallback<MediaContextValue['logActivity']>(
    (id, activity, changes) =>
      optimistic(
        id,
        (i) =>
          ({
            ...i,
            ...changes,
            time_spent_minutes: i.time_spent_minutes + (activity.duration_minutes || 0),
          }) as Item,
        async () => {
          const { error } = await supabase.from('activity_log').insert({
            item_id: id,
            duration_minutes: activity.duration_minutes || null,
            progress_delta: activity.progress_delta ?? null,
          })
          if (error) throw error
          // Aunque no haya cambios propios, el select trae el tiempo actualizado.
          const { data, error: updateError } =
            Object.keys(changes).length > 0
              ? await supabase.from('items').update(changes).eq('id', id).select().single()
              : await supabase.from('items').select('*').eq('id', id).single()
          if (updateError) throw updateError
          return data as Item
        }
      ),
    [optimistic]
  )

  const value = useMemo<MediaContextValue>(
    () => ({ items, loading, error, addItem, addItems, updateItem, deleteItem, logActivity }),
    [items, loading, error, addItem, addItems, updateItem, deleteItem, logActivity]
  )

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>
}

export function useMedia() {
  const ctx = useContext(MediaContext)
  if (!ctx) throw new Error('useMedia debe usarse dentro de <MediaProvider>')
  return ctx
}
