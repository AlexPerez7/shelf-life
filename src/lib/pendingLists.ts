// Cambios sin guardar de las listas: crear, renombrar o borrar una lista y
// agregar o quitar títulos. Funciona como la cola de los títulos
// (`pendingChanges.ts`), pero en una sola fila para todo, porque los cambios
// de listas se afectan entre sí (no se puede agregar un título a una lista
// que todavía no existe).
//
// Reglas:
//   - Los cambios se mandan en el orden en que se hicieron.
//   - Lo que se deshace antes de mandarse se cancela: agregar y quitar el
//     mismo título, o borrar una lista que todavía no se creó en la base.
//   - Las listas y sus títulos llevan el id generado acá, así un reintento
//     después de que la base ya lo guardó no duplica nada.

import type { GameList } from '../types/game'

export type ListChanges = Partial<Pick<GameList, 'name' | 'is_public'>>

export type ListOp =
  | { type: 'create'; listId: string; list: GameList }
  | { type: 'update'; listId: string; changes: ListChanges }
  | { type: 'delete'; listId: string }
  | { type: 'add'; listId: string; itemId: string }
  | { type: 'remove'; listId: string; itemId: string }

const sameEntry = (a: ListOp, b: ListOp) =>
  (a.type === 'add' || a.type === 'remove') &&
  (b.type === 'add' || b.type === 'remove') &&
  a.listId === b.listId &&
  a.itemId === b.itemId

/**
 * Suma un cambio al final de la cola, cancelando lo que se deshace.
 * `inFlight` es el que se está mandando ahora: ese no se toca.
 */
export function addListOp(ops: ListOp[], op: ListOp, inFlight?: ListOp | null): ListOp[] {
  switch (op.type) {
    case 'delete': {
      // Una lista que todavía no está en la base: no hay nada que borrar allá.
      const create = ops.find((o) => o.type === 'create' && o.listId === op.listId)
      if (create && create !== inFlight) return ops.filter((o) => o.listId !== op.listId)
      // Lo demás de esa lista ya no sirve (en la base se borra en cascada).
      return [...ops.filter((o) => o.listId !== op.listId || o === inFlight), op]
    }
    case 'update': {
      for (let i = ops.length - 1; i >= 0; i--) {
        const prev = ops[i]
        if (prev.listId !== op.listId || prev === inFlight) continue
        if (prev.type === 'create') {
          const merged: ListOp = { ...prev, list: { ...prev.list, ...op.changes } }
          return [...ops.slice(0, i), merged, ...ops.slice(i + 1)]
        }
        if (prev.type === 'update') {
          const merged: ListOp = { ...prev, changes: { ...prev.changes, ...op.changes } }
          return [...ops.slice(0, i), merged, ...ops.slice(i + 1)]
        }
        break
      }
      return [...ops, op]
    }
    case 'add':
    case 'remove': {
      const opposite = op.type === 'add' ? 'remove' : 'add'
      const i = ops.findIndex((o) => o !== inFlight && o.type === opposite && sameEntry(o, op))
      if (i >= 0) return [...ops.slice(0, i), ...ops.slice(i + 1)]
      if (ops.some((o) => o.type === op.type && sameEntry(o, op))) return ops
      return [...ops, op]
    }
    default:
      return [...ops, op]
  }
}

/** Las listas como quedan con lo pendiente (las nuevas primero, las borradas fuera). */
export function overlayLists(lists: GameList[], ops: ListOp[]): GameList[] {
  if (ops.length === 0) return lists
  let out = lists
  for (const op of ops) {
    if (op.type === 'create') {
      if (!out.some((l) => l.id === op.listId)) out = [op.list, ...out]
    } else if (op.type === 'update') {
      out = out.map((l) => (l.id === op.listId ? { ...l, ...op.changes } : l))
    } else if (op.type === 'delete') {
      out = out.filter((l) => l.id !== op.listId)
    }
  }
  return out
}

/** Los títulos de una lista como quedan con lo pendiente (lo agregado, primero). */
export function overlayListItemIds(ids: string[], listId: string, ops: ListOp[]): string[] {
  let out = ids
  for (const op of ops) {
    if (op.listId !== listId) continue
    if (op.type === 'add' && !out.includes(op.itemId)) out = [op.itemId, ...out]
    else if (op.type === 'remove') out = out.filter((id) => id !== op.itemId)
  }
  return out
}

/** Las listas de un título como quedan con lo pendiente. */
export function overlayItemListIds(ids: ReadonlySet<string>, itemId: string, ops: ListOp[]): Set<string> {
  const out = new Set(ids)
  for (const op of ops) {
    if ((op.type !== 'add' && op.type !== 'remove') || op.itemId !== itemId) continue
    if (op.type === 'add') out.add(op.listId)
    else out.delete(op.listId)
  }
  return out
}

// ---------------------------------------------------------------------------
// Guardado en el dispositivo
// ---------------------------------------------------------------------------

/** Prefijo de la cache local de listas (la lista de listas y los títulos de cada una). */
export const LISTS_CACHE_PREFIX = 'shelflife_lists_v1:'

export const listQueueKey = (userId: string) => `shelflife_pending_v1:lists:${userId}`

function isListOp(value: unknown): value is ListOp {
  if (typeof value !== 'object' || value == null) return false
  const op = value as Record<string, unknown>
  if (typeof op.listId !== 'string') return false
  switch (op.type) {
    case 'create':
      return typeof op.list === 'object' && op.list != null && typeof (op.list as GameList).name === 'string'
    case 'update':
      return typeof op.changes === 'object' && op.changes != null
    case 'delete':
      return true
    case 'add':
    case 'remove':
      return typeof op.itemId === 'string'
    default:
      return false
  }
}

export function readListOps(key: string): ListOp[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isListOp) : []
  } catch {
    return []
  }
}

export function writeListOps(key: string, ops: ListOp[]) {
  try {
    if (ops.length === 0) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(ops))
  } catch {
    /* sin espacio o sin acceso: la cola queda solo en memoria */
  }
}
