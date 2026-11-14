// Edición en lote del librero: reglas puras para cambiar el estado o el
// formato de varios libros a la vez.

import { statusChanges } from './media'
import type { Item, ItemStatus, ItemWrite } from '../types/item'

/** Un cambio a guardar para un libro. */
export interface BatchChange {
  id: string
  changes: ItemWrite
}

/** Agrega el id a la selección si no estaba, o lo saca si estaba. No muta el original. */
export function toggleSelected(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/**
 * Cambios para pasar los libros elegidos a un estado, con las mismas reglas
 * que la ficha (fechas de inicio y fin, páginas al terminar). Los que ya
 * están en ese estado se saltan.
 */
export function batchStatusChanges(books: Item[], status: ItemStatus, today: string): BatchChange[] {
  return books
    .filter((b) => b.status !== status)
    .map((b) => ({ id: b.id, changes: statusChanges(b, status, today) }))
}

/**
 * Cambios para dejar un formato (uno o varios, separados por coma) en los
 * libros elegidos. Los que ya lo tienen igual se saltan; sin formatos se borra.
 */
export function batchFormatChanges(books: Item[], format: string): BatchChange[] {
  const next = format.trim() === '' ? null : format
  return books
    .filter((b) => (b.format || null) !== next)
    .map((b) => ({ id: b.id, changes: { format: next } }))
}
