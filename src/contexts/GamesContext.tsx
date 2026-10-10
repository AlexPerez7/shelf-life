import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, ensureSession } from '../lib/supabaseClient'
import { readCache, removeCacheByPrefix, writeCache } from '../lib/localCache'
import { usePendingSync } from '../hooks/usePendingSync'
import { gameChangesToItem, itemToGame, newGameToItem } from '../lib/gameItem'
import type { Game, NewGame } from '../types/game'
import type { Item } from '../types/item'

interface GamesContextValue {
  games: Game[]
  loading: boolean
  error: string | null
  addGame: (game: NewGame) => Promise<Game>
  /** Alta en lote (importación masiva): un insert por cada 200 juegos. */
  addGames: (games: NewGame[]) => Promise<Game[]>
  updateGame: (id: string, changes: Partial<Game>) => Promise<Game>
  deleteGame: (id: string) => Promise<void>
  /** Relee un juego de la DB (ej. después de que un trigger lo modificó). */
  refreshGame: (id: string) => Promise<void>
  refetch: () => Promise<void>
  /** Cambios hechos sin conexión que todavía no llegaron a la base. */
  pendingCount: number
  /** Un cambio pendiente que la base rechazó al reintentar. */
  syncError: { message: string; at: number } | null
  /** Intenta mandar ya lo pendiente; devuelve cuántos cambios quedan. */
  flushPending: () => Promise<number>
  /** Descarta lo pendiente (al cerrar sesión). */
  discardPending: () => void
}

const GamesContext = createContext<GamesContextValue | null>(null)

// La DB guarda `items` (multimedia); las pantallas de juegos ven `Game`.
// El estado guarda los Item crudos (hacen falta para combinar `metadata`) y
// expone los juegos ya traducidos.
const CACHE_PREFIX = 'shelflife_items_v1:'

export function GamesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const games = useMemo(() => items.map(itemToGame), [items])
  const itemsRef = useRef<Item[]>([])
  itemsRef.current = items
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Una vez que hay datos, las recargas son silenciosas (sin esqueletos).
  const hasLoaded = useRef(false)
  // Usuario dueño de los datos en memoria (para la cache local).
  const userIdRef = useRef<string | null>(null)
  const sync = usePendingSync('games', setItems, itemsRef)
  const { overlay, setUser, save, dropItem, pendingCount, syncError, flush, discard } = sync

  const fetchGames = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true)
    await ensureSession()
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('media_type', 'game')
      .order('created_at', { ascending: false })

    if (error) {
      // Si ya hay datos (de la cache o de antes), un fallo de red no borra
      // la biblioteca ni muestra error: se sigue viendo lo último conocido.
      if (!hasLoaded.current) setError(error.message)
    } else {
      // Lo hecho sin conexión que todavía no llegó se sigue viendo.
      setItems(overlay(data as Item[]))
      setError(null)
      hasLoaded.current = true
    }
    setLoading(false)
  }, [overlay])

  useEffect(() => {
    // onAuthStateChange dispara INITIAL_SESSION apenas nos suscribimos (con la
    // sesión ya restaurada o null), así que no hace falta un fetch aparte al
    // montar. SIGNED_IN cubre el caso en que el provider ya estaba montado sin
    // sesión cuando el usuario hace login.
    //
    // Se ignoran TOKEN_REFRESHED y USER_UPDATED: en mobile el token se renueva
    // cada vez que la PWA vuelve del segundo plano, y recargar ahí hacía
    // parpadear toda la app con esqueletos.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        hasLoaded.current = false
        userIdRef.current = null
        setUser(null)
        removeCacheByPrefix(CACHE_PREFIX)
        setItems([])
        setError(null)
        setLoading(false)
        return
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        // Pintar al instante la última biblioteca conocida de este usuario y
        // revalidar contra la DB en segundo plano.
        if (userIdRef.current !== session.user.id) {
          userIdRef.current = session.user.id
          setUser(session.user.id)
          const cached = readCache<Item[]>(CACHE_PREFIX + session.user.id)
          if (cached) {
            setItems(cached.data)
            setLoading(false)
            hasLoaded.current = true
          }
        }
        // Diferido: no se debe llamar a otros métodos de supabase dentro del
        // callback de onAuthStateChange (puede bloquearse esperando el lock).
        setTimeout(fetchGames, 0)
      }
    })
    return () => subscription.unsubscribe()
  }, [fetchGames, setUser])

  // Mantener la cache local al día con cada cambio (alta, edición, borrado).
  useEffect(() => {
    if (hasLoaded.current && userIdRef.current) {
      writeCache(CACHE_PREFIX + userIdRef.current, items)
    }
  }, [items])

  const addGame = useCallback(async (game: NewGame) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('No hay sesión activa')

    const { data, error } = await supabase
      .from('items')
      .insert({ ...newGameToItem(game), user_id: user.id })
      .select()
      .single()

    if (error) throw error
    setItems((prev) => [data as Item, ...prev])
    return itemToGame(data as Item)
  }, [])

  const addGames = useCallback(async (newGames: NewGame[]) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('No hay sesión activa')

    const created: Game[] = []
    for (let i = 0; i < newGames.length; i += 200) {
      const rows = newGames
        .slice(i, i + 200)
        .map((g) => ({ ...newGameToItem(g), user_id: user.id }))
      const { data, error } = await supabase.from('items').insert(rows).select()
      if (error) throw error
      created.push(...(data as Item[]).map(itemToGame))
      // Actualizar por tandas para que se vea el avance.
      setItems((prev) => [...(data as Item[]), ...prev])
    }
    return created
  }, [])

  /** Optimista, como en MediaContext: se ve al instante; sin conexión queda en la cola. */
  const updateGame = useCallback(
    async (id: string, changes: Partial<Game>) => {
      const current = itemsRef.current.find((i) => i.id === id)
      const write = gameChangesToItem(changes, current?.metadata)
      const saved = await save({ type: 'update', itemId: id, changes: write }, (i) => ({ ...i, ...write }) as Item)
      return itemToGame(saved)
    },
    [save]
  )

  const deleteGame = useCallback(async (id: string) => {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) throw error
    dropItem(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [dropItem])

  const refreshGame = useCallback(async (id: string) => {
    const { data, error } = await supabase.from('items').select('*').eq('id', id).single()
    if (error) throw error
    setItems((prev) => prev.map((i) => (i.id === id ? overlay([data as Item])[0] : i)))
  }, [overlay])

  const value = useMemo<GamesContextValue>(
    () => ({
      games,
      loading,
      error,
      addGame,
      addGames,
      updateGame,
      deleteGame,
      refreshGame,
      refetch: fetchGames,
      pendingCount,
      syncError,
      flushPending: flush,
      discardPending: discard,
    }),
    [
      games,
      loading,
      error,
      addGame,
      addGames,
      updateGame,
      deleteGame,
      refreshGame,
      fetchGames,
      pendingCount,
      syncError,
      flush,
      discard,
    ]
  )

  return <GamesContext.Provider value={value}>{children}</GamesContext.Provider>
}

export function useGames() {
  const ctx = useContext(GamesContext)
  if (!ctx) throw new Error('useGames debe usarse dentro de <GamesProvider>')
  return ctx
}
