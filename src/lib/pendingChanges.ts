// Cambios sin guardar: lo que se hizo sin conexión (o con la red caída) queda
// en una cola por usuario, guardada en el dispositivo, y se manda a Supabase
// cuando vuelve la señal. Mientras tanto la app muestra los cambios igual.
//
// Reglas:
//   - Los cambios de un mismo ítem se aplican en el orden en que se hicieron.
//     Si un ítem tiene algo en la cola, lo nuevo va detrás aunque haya señal.
//   - Dos ediciones seguidas del mismo ítem se juntan en una (la segunda pisa
//     los campos que repite), salvo que la primera ya se esté mandando.
//   - Cada actividad (episodio, páginas, sesión) lleva su propio id, generado
//     acá: si se reintenta después de que la base ya la guardó, no se duplica
//     (ni se vuelve a sumar su tiempo).

import type { Item, ItemWrite } from '../types/item'

export interface PendingActivity {
  /** Id de la fila de `activity_log`, generado en el dispositivo. */
  id: string
  duration_minutes: number | null
  progress_delta: number | null
  /** Cuándo pasó (no cuándo se guardó). */
  occurred_at: string
}

export type PendingOp =
  | { type: 'update'; itemId: string; changes: ItemWrite }
  | { type: 'activity'; itemId: string; activity: PendingActivity; changes: ItemWrite }

export const pendingFor = (ops: PendingOp[], itemId: string) => ops.filter((o) => o.itemId === itemId)

export const withoutItem = (ops: PendingOp[], itemId: string) => ops.filter((o) => o.itemId !== itemId)

/**
 * Suma un cambio al final de la cola. Una edición se junta con la anterior
 * del mismo ítem si esa también es una edición y es lo último del ítem (y no
 * es `inFlight`, la que se está mandando en este momento).
 */
export function addPendingOp(ops: PendingOp[], op: PendingOp, inFlight?: PendingOp | null): PendingOp[] {
  if (op.type === 'update') {
    for (let i = ops.length - 1; i >= 0; i--) {
      const prev = ops[i]
      if (prev.itemId !== op.itemId) continue
      if (prev.type === 'update' && prev !== inFlight) {
        const merged: PendingOp = { ...prev, changes: { ...prev.changes, ...op.changes } }
        return [...ops.slice(0, i), merged, ...ops.slice(i + 1)]
      }
      break
    }
  }
  return [...ops, op]
}

/** El ítem como queda con sus cambios pendientes (para mostrarlo así mientras tanto). */
export function applyPendingOps(item: Item, ops: PendingOp[]): Item {
  let out = item
  for (const op of ops) {
    if (op.itemId !== item.id) continue
    out = { ...out, ...op.changes } as Item
    if (op.type === 'activity' && op.activity.duration_minutes) {
      // En la base el tiempo lo suma un trigger al guardar la actividad.
      out = { ...out, time_spent_minutes: out.time_spent_minutes + op.activity.duration_minutes }
    }
  }
  return out
}

/** Lo que trae la base, con los cambios que todavía no llegaron encima. */
export function overlayPending(items: Item[], ops: PendingOp[]): Item[] {
  if (ops.length === 0) return items
  const ids = new Set(ops.map((o) => o.itemId))
  return items.map((i) => (ids.has(i.id) ? applyPendingOps(i, ops) : i))
}

/**
 * ¿El error es por falta de conexión (y conviene reintentar), o la base
 * rechazó el cambio? supabase-js no lanza: devuelve el error del `fetch`
 * como mensaje ("Failed to fetch" en Chrome, "Load failed" en Safari...).
 */
export function isNetworkError(err: unknown, online = typeof navigator === 'undefined' || navigator.onLine) {
  if (!online) return true
  const message =
    err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String(err.message) : ''
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed|network error/i.test(message)
}

// ---------------------------------------------------------------------------
// Guardado en el dispositivo
// ---------------------------------------------------------------------------

export const pendingKey = (scope: string, userId: string) => `shelflife_pending_v1:${scope}:${userId}`

function isOp(value: unknown): value is PendingOp {
  if (typeof value !== 'object' || value == null) return false
  const op = value as Record<string, unknown>
  if (typeof op.itemId !== 'string' || typeof op.changes !== 'object' || op.changes == null) return false
  if (op.type === 'update') return true
  const a = op.activity as Record<string, unknown> | undefined
  return op.type === 'activity' && typeof a?.id === 'string' && typeof a.occurred_at === 'string'
}

export function readPending(key: string): PendingOp[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isOp) : []
  } catch {
    return []
  }
}

export function writePending(key: string, ops: PendingOp[]) {
  try {
    if (ops.length === 0) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(ops))
  } catch {
    /* sin espacio o sin acceso: la cola queda solo en memoria */
  }
}
