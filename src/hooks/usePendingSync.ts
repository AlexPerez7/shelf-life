import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  addPendingOp,
  applyPendingOps,
  isNetworkError,
  itemFromInsert,
  newInsertOp,
  overlayPending,
  pendingActivities,
  pendingFor,
  pendingKey,
  readPending,
  withoutItem,
  writePending,
  type NewItemRow,
  type PendingOp,
} from '../lib/pendingChanges'
import type { Item } from '../types/item'

/** Un cambio de un ítem que tiene otros esperando en la cola: va detrás. */
class QueuedBehind extends Error {}

const RETRY_MS = 30_000

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String((err as { message?: string } | null)?.message ?? err)

/**
 * Guardado optimista con cola sin conexión, para GamesProvider y
 * MediaProvider (cada uno con su `scope` y su estado de ítems):
 *   - `save` aplica el cambio al instante y lo manda a la base, en fila por
 *     ítem. Si no hay red, queda en la cola (guardada en el dispositivo) y el
 *     cambio se sigue viendo; si la base lo rechaza, vuelve atrás y el error sube.
 *   - La cola se manda sola al abrir la app, al volver la conexión o la app
 *     al frente, y cada 30 s mientras quede algo.
 *   - `overlay` pone lo pendiente encima de lo que trae la base.
 */
export function usePendingSync(
  scope: string,
  setItems: Dispatch<SetStateAction<Item[]>>,
  itemsRef: MutableRefObject<Item[]>
) {
  const userRef = useRef<string | null>(null)
  const opsRef = useRef<PendingOp[]>([])
  const inFlightRef = useRef<PendingOp | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  /** Un cambio pendiente que la base rechazó al reintentar (se descarta). */
  const [syncError, setSyncError] = useState<{ message: string; at: number } | null>(null)

  const persist = useCallback((ops: PendingOp[]) => {
    opsRef.current = ops
    setPendingCount(ops.length)
    if (userRef.current) writePending(pendingKey(scope, userRef.current), ops)
  }, [scope])

  // Último cambio pedido por ítem: solo la respuesta del último actualiza el
  // estado (las anteriores ya quedaron superadas por el cambio optimista).
  const seqRef = useRef(new Map<string, number>())
  // Guardados en fila por ítem: con dos toques rápidos ("+1", "+1") la base
  // recibe los cambios en el mismo orden en que se hicieron.
  const chains = useRef(new Map<string, Promise<unknown>>())
  const enqueue = useCallback(<T,>(id: string, task: () => Promise<T>): Promise<T> => {
    const next = (chains.current.get(id) ?? Promise.resolve()).catch(() => {}).then(task)
    chains.current.set(id, next.catch(() => {}))
    return next
  }, [])

  /** Manda un cambio a la base y devuelve la fila como quedó (`null` si el ítem se borró). */
  const run = useCallback(async (op: PendingOp): Promise<Item | null> => {
    if (op.type === 'delete') {
      // Borrar es idempotente: si ya no estaba, está bien.
      const { error } = await supabase.from('items').delete().eq('id', op.itemId)
      if (error) throw error
      return null
    }
    if (op.type === 'trash') {
      const { error } = await supabase.from('items').update({ deleted_at: op.deletedAt }).eq('id', op.itemId)
      if (error) throw error
      return null
    }
    if (op.type === 'insert') {
      // Con el id generado en el dispositivo: si un reintento llega cuando la base
      // ya la guardó, se queda con la misma fila en vez de duplicarla.
      const { data, error } = await supabase
        .from('items')
        .upsert({ ...op.row, id: op.itemId, user_id: op.userId }, { onConflict: 'id' })
        .select()
        .single()
      if (error) throw error
      return data as Item
    }
    if (op.type === 'activity') {
      // Con el id generado en el dispositivo: si ya estaba (reintento), no se duplica.
      const { error } = await supabase.from('activity_log').upsert(
        {
          id: op.activity.id,
          item_id: op.itemId,
          duration_minutes: op.activity.duration_minutes || null,
          progress_delta: op.activity.progress_delta ?? null,
          occurred_at: op.activity.occurred_at,
          notes: op.activity.notes ?? null,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      if (error) throw error
    }
    // Aunque no haya cambios propios, el select trae el tiempo actualizado.
    const { data, error } =
      Object.keys(op.changes).length > 0
        ? await supabase.from('items').update(op.changes).eq('id', op.itemId).select().single()
        : await supabase.from('items').select('*').eq('id', op.itemId).single()
    if (error) throw error
    return data as Item
  }, [])

  const flushing = useRef<Promise<void> | null>(null)
  const flushOnce = useCallback((): Promise<void> => {
    if (flushing.current) return flushing.current
    if (opsRef.current.length === 0 || !userRef.current || !navigator.onLine) return Promise.resolve()
    const user = userRef.current
    flushing.current = (async () => {
      while (opsRef.current.length > 0 && userRef.current === user) {
        const op = opsRef.current[0]
        inFlightRef.current = op
        try {
          const saved = await enqueue(op.itemId, () => run(op))
          if (userRef.current !== user) break
          persist(opsRef.current.filter((o) => o !== op))
          if (!saved) continue
          const rest = pendingFor(opsRef.current, op.itemId)
          setItems((prev) => prev.map((i) => (i.id === op.itemId ? applyPendingOps(saved, rest) : i)))
        } catch (err) {
          if (isNetworkError(err)) break
          // La base lo rechazó (ej. el ítem ya no existe): se descarta y el
          // ítem vuelve a como está en la base, con lo demás pendiente encima.
          persist(opsRef.current.filter((o) => o !== op))
          setSyncError({ message: errorMessage(err), at: Date.now() })
          const { data, error } = await supabase.from('items').select('*').eq('id', op.itemId).maybeSingle()
          if (error) continue
          if (!data) {
            persist(withoutItem(opsRef.current, op.itemId))
            setItems((prev) => prev.filter((i) => i.id !== op.itemId))
            continue
          }
          const rest = pendingFor(opsRef.current, op.itemId)
          setItems((prev) => prev.map((i) => (i.id === op.itemId ? applyPendingOps(data as Item, rest) : i)))
        } finally {
          inFlightRef.current = null
        }
      }
    })().finally(() => {
      flushing.current = null
    })
    return flushing.current
  }, [enqueue, persist, run, setItems])

  /** Manda lo pendiente (si hay conexión) y devuelve cuántos cambios quedan sin guardar. */
  const flush = useCallback(async () => {
    await flushOnce()
    return opsRef.current.length
  }, [flushOnce])

  /**
   * Optimista: `local` se ve al instante y `op` se guarda en segundo plano.
   * Sin conexión queda en la cola y devuelve el ítem como se ve.
   */
  const save = useCallback(
    async (op: PendingOp, local: (item: Item) => Item): Promise<Item> => {
      const id = op.itemId
      const seq = (seqRef.current.get(id) ?? 0) + 1
      seqRef.current.set(id, seq)
      const previous = itemsRef.current.find((i) => i.id === id)
      const shown = previous ? local(previous) : null
      setItems((prev) => prev.map((i) => (i.id === id ? local(i) : i)))

      const queue = () => {
        persist(addPendingOp(opsRef.current, op, inFlightRef.current))
        return shown ?? (previous as Item)
      }
      if (pendingFor(opsRef.current, id).length > 0) {
        const result = queue()
        void flush()
        return result
      }
      try {
        const saved = await enqueue(id, () => {
          // Si mientras esperaba su turno algo de este ítem quedó en la cola, va detrás.
          if (pendingFor(opsRef.current, id).length > 0) throw new QueuedBehind()
          return run(op)
        })
        if (!saved) return previous as Item
        if (seqRef.current.get(id) === seq) setItems((prev) => prev.map((i) => (i.id === id ? saved : i)))
        return saved
      } catch (err) {
        if (err instanceof QueuedBehind || isNetworkError(err)) return queue()
        if (seqRef.current.get(id) === seq && previous) {
          setItems((prev) => prev.map((i) => (i.id === id ? previous : i)))
        }
        throw err
      }
    },
    [enqueue, flush, itemsRef, persist, run, setItems]
  )

  /**
   * Alta optimista: el título se ve ya (con id generado acá) y se guarda en
   * segundo plano; sin conexión queda en la cola. Si la base lo rechaza, sale
   * de la lista y el error sube.
   */
  const insert = useCallback(
    async (row: NewItemRow): Promise<Item> => {
      const userId = userRef.current
      if (!userId) throw new Error('No hay sesión activa')
      const op = newInsertOp(crypto.randomUUID(), userId, row)
      if (op.type !== 'insert') throw new Error('unreachable')
      const local = itemFromInsert(op)
      setItems((prev) => [local, ...prev])
      try {
        const saved = await enqueue(op.itemId, () => run(op))
        if (!saved) return local
        setItems((prev) => prev.map((i) => (i.id === op.itemId ? applyPendingOps(saved, pendingFor(opsRef.current, op.itemId)) : i)))
        return saved
      } catch (err) {
        if (isNetworkError(err)) {
          persist(addPendingOp(opsRef.current, op, inFlightRef.current))
          return local
        }
        setItems((prev) => prev.filter((i) => i.id !== op.itemId))
        throw err
      }
    },
    [enqueue, persist, run, setItems]
  )

  // Lo que se mandó a la papelera sin conexión, por si se deshace antes de guardarse.
  const trashedRef = useRef(new Map<string, Item>())

  /**
   * Borra un ítem de la lista al instante. `'delete'` lo elimina; `'trash'` lo
   * manda a la papelera. Sin conexión queda en la cola; si la base lo rechaza,
   * el ítem vuelve y el error sube.
   */
  const remove = useCallback(
    async (id: string, kind: 'delete' | 'trash'): Promise<void> => {
      const previous = itemsRef.current.find((i) => i.id === id)
      const op: PendingOp =
        kind === 'trash'
          ? { type: 'trash', itemId: id, deletedAt: new Date().toISOString(), changes: {} }
          : { type: 'delete', itemId: id, changes: {} }
      setItems((prev) => prev.filter((i) => i.id !== id))
      if (kind === 'trash' && previous) trashedRef.current.set(id, previous)
      const queue = () => persist(addPendingOp(opsRef.current, op, inFlightRef.current))
      if (pendingFor(opsRef.current, id).length > 0) {
        queue()
        void flush()
        return
      }
      try {
        await enqueue(id, () => {
          if (pendingFor(opsRef.current, id).length > 0) throw new QueuedBehind()
          return run(op)
        })
        trashedRef.current.delete(id)
      } catch (err) {
        if (err instanceof QueuedBehind || isNetworkError(err)) return queue()
        trashedRef.current.delete(id)
        if (previous) setItems((prev) => (prev.some((i) => i.id === id) ? prev : [previous, ...prev]))
        throw err
      }
    },
    [enqueue, flush, itemsRef, persist, run, setItems]
  )

  /**
   * Deshace una papelera que todavía no se mandó: saca el cambio de la cola y
   * devuelve el ítem. `null` si ya llegó a la base (entonces hay que restaurarlo allá).
   */
  const cancelTrash = useCallback(
    (id: string): Item | null => {
      const op = opsRef.current.find((o) => o.type === 'trash' && o.itemId === id)
      const item = trashedRef.current.get(id)
      if (!op || op === inFlightRef.current || !item) return null
      persist(opsRef.current.filter((o) => o !== op))
      trashedRef.current.delete(id)
      setItems((prev) =>
        prev.some((i) => i.id === id)
          ? prev
          : [...prev, item].sort((a, b) => b.created_at.localeCompare(a.created_at))
      )
      return item
    },
    [persist, setItems]
  )

  /** Usuario dueño de la cola (al iniciar sesión, `null` al cerrarla). */
  const setUser = useCallback(
    (userId: string | null) => {
      if (userRef.current === userId) return
      userRef.current = userId
      opsRef.current = userId ? readPending(pendingKey(scope, userId)) : []
      setPendingCount(opsRef.current.length)
      if (userId) setTimeout(() => void flush(), 0)
    },
    [flush, scope]
  )

  const overlay = useCallback((items: Item[]) => overlayPending(items, opsRef.current), [])

  /** Un ítem borrado: lo suyo en la cola ya no tiene sentido. */
  const dropItem = useCallback((itemId: string) => persist(withoutItem(opsRef.current, itemId)), [persist])

  /** Actividades de un ítem que esperan en la cola (ej. sesiones hechas sin conexión). */
  const pendingActivitiesFor = useCallback((itemId: string) => pendingActivities(opsRef.current, itemId), [])

  /**
   * Saca de la cola una actividad que todavía no se mandó (borrar una sesión
   * hecha sin conexión) y descuenta su tiempo. `false` si ya no está en la
   * cola (se guardó o se está mandando): entonces se borra en la base.
   */
  const cancelActivity = useCallback(
    (activityId: string) => {
      const op = opsRef.current.find((o) => o.type === 'activity' && o.activity.id === activityId)
      if (!op || op.type !== 'activity' || op === inFlightRef.current) return false
      persist(opsRef.current.filter((o) => o !== op))
      const minutes = op.activity.duration_minutes ?? 0
      if (minutes) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === op.itemId ? { ...i, time_spent_minutes: Math.max(0, i.time_spent_minutes - minutes) } : i
          )
        )
      }
      return true
    },
    [persist, setItems]
  )

  /** Descarta todo lo pendiente (al cerrar sesión, si el usuario lo acepta). */
  const discard = useCallback(() => persist([]), [persist])

  // Reintentos: al volver la conexión, al volver la app al frente y cada 30 s.
  useEffect(() => {
    const retry = () => void flush()
    const onVisible = () => document.visibilityState === 'visible' && retry()
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [flush])
  useEffect(() => {
    if (pendingCount === 0) return
    const timer = setInterval(() => void flush(), RETRY_MS)
    return () => clearInterval(timer)
  }, [pendingCount, flush])

  return {
    save,
    insert,
    remove,
    cancelTrash,
    flush,
    setUser,
    overlay,
    dropItem,
    discard,
    pendingActivitiesFor,
    cancelActivity,
    pendingCount,
    syncError,
  }
}
