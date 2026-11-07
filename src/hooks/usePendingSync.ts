import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  addPendingOp,
  applyPendingOps,
  isNetworkError,
  overlayPending,
  pendingActivities,
  pendingFor,
  pendingKey,
  pendingTrash,
  readPending,
  withoutItem,
  writePending,
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

  /** Manda un cambio a la base y devuelve la fila como quedó (`null` si se borró). */
  const run = useCallback(async (op: PendingOp): Promise<Item | null> => {
    if (op.type === 'delete') {
      // Borrar algo que ya no está no es un error.
      const { error } = op.trash
        ? await supabase.from('items').update({ deleted_at: op.deletedAt }).eq('id', op.itemId)
        : await supabase.from('items').delete().eq('id', op.itemId)
      if (error) throw error
      return null
    }
    if (op.type === 'create') {
      // Con el id generado en el dispositivo: si ya estaba (reintento), no se duplica.
      // `updated_at` lo pone la base.
      const row: Record<string, unknown> = { ...op.item }
      delete row.updated_at
      const { error } = await supabase.from('items').upsert(row, { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw error
      const { data, error: readError } = await supabase.from('items').select('*').eq('id', op.itemId).single()
      if (readError) throw readError
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
          if (saved) {
            const rest = pendingFor(opsRef.current, op.itemId)
            setItems((prev) => prev.map((i) => (i.id === op.itemId ? applyPendingOps(saved, rest) : i)))
          }
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
          // Editar y registrar actividad siempre devuelven la fila.
          return run(op) as Promise<Item>
        })
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

  /** Usuario con la sesión abierta (se sabe sin conexión, a diferencia de `auth.getUser()`). */
  const getUserId = useCallback(() => userRef.current, [])

  /** Suma un cambio a la cola y trata de mandarla. */
  const queueOp = useCallback(
    (op: PendingOp) => {
      persist(addPendingOp(opsRef.current, op, inFlightRef.current))
      void flush()
    },
    [flush, persist]
  )

  /**
   * Alta optimista: el título se ve al instante con su id ya generado y se
   * guarda en segundo plano; sin conexión queda en la cola (se puede abrir y
   * editar mientras tanto). Si la base lo rechaza, se saca y el error sube.
   */
  const create = useCallback(
    async (item: Item): Promise<Item> => {
      const id = item.id
      setItems((prev) => [item, ...prev])
      const op: PendingOp = { type: 'create', itemId: id, item }
      try {
        const saved = await enqueue(id, async () => (await run(op)) as Item)
        // Lo que el usuario cambió mientras se guardaba (si quedó en la cola) va encima.
        const rest = pendingFor(opsRef.current, id)
        setItems((prev) => prev.map((i) => (i.id === id ? applyPendingOps(saved, rest) : i)))
        return saved
      } catch (err) {
        if (isNetworkError(err)) {
          persist(addPendingOp(opsRef.current, op, inFlightRef.current))
          return item
        }
        setItems((prev) => prev.filter((i) => i.id !== id))
        throw err
      }
    },
    [enqueue, persist, run, setItems]
  )

  /**
   * Borra (o manda a la papelera) un título: sale al instante y se guarda en
   * segundo plano. Sin conexión queda en la cola. Si el título se agregó sin
   * conexión y todavía no salió, simplemente se descarta: la base no se entera.
   */
  const remove = useCallback(
    async (id: string, mode: { trash: boolean }): Promise<void> => {
      const created = opsRef.current.find((o) => o.type === 'create' && o.itemId === id)
      if (created && created !== inFlightRef.current) {
        persist(withoutItem(opsRef.current, id))
        setItems((prev) => prev.filter((i) => i.id !== id))
        return
      }
      const previous = itemsRef.current.find((i) => i.id === id)
      const op: PendingOp = {
        type: 'delete',
        itemId: id,
        trash: mode.trash,
        deletedAt: new Date().toISOString(),
        // Sin el ítem en memoria (ej. uno que ya estaba en la papelera) no hay qué deshacer: alcanza el id.
        item: previous ?? ({ id } as Item),
      }
      setItems((prev) => prev.filter((i) => i.id !== id))
      if (pendingFor(opsRef.current, id).length > 0) {
        queueOp(op)
        return
      }
      try {
        await enqueue(id, () => {
          if (pendingFor(opsRef.current, id).length > 0) throw new QueuedBehind()
          return run(op)
        })
      } catch (err) {
        if (err instanceof QueuedBehind || isNetworkError(err)) {
          queueOp(op)
          return
        }
        if (previous) setItems((prev) => (prev.some((i) => i.id === id) ? prev : [previous, ...prev]))
        throw err
      }
    },
    [enqueue, itemsRef, persist, queueOp, run, setItems]
  )

  /**
   * Deshace una papelera que todavía no llegó a la base: el título vuelve tal
   * como estaba. `null` si ya no está en la cola (entonces se restaura en la base).
   */
  const cancelTrash = useCallback(
    (id: string): Item | null => {
      const op = pendingTrash(opsRef.current, id)
      if (!op || op === inFlightRef.current || !op.item.title) return null
      persist(opsRef.current.filter((o) => o !== op))
      setItems((prev) => (prev.some((i) => i.id === id) ? prev : [op.item, ...prev]))
      return op.item
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
    create,
    remove,
    cancelTrash,
    getUserId,
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
