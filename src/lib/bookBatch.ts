// Edición en lote del librero: qué cambia en cada libro seleccionado.

import { statusChanges } from './media'
import type { Item, ItemStatus, ItemWrite } from '../types/item'

/** Agrega o saca un id de la selección (devuelve un conjunto nuevo). */
export function toggleSelected(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/** Todos los libros visibles están seleccionados (y hay al menos uno). */
export function allSelected(visible: Item[], selected: ReadonlySet<string>): boolean {
  return visible.length > 0 && visible.every((b) => selected.has(b.id))
}

/**
 * Los libros seleccionados que siguen existiendo (si uno se borró o salió de
 * la vista por un cambio, deja de contar).
 */
export function selectedBooks(books: Item[], selected: ReadonlySet<string>): Item[] {
  return books.filter((b) => selected.has(b.id))
}

/**
 * Cambio de estado de un libro dentro de un lote: las mismas reglas que en la
 * ficha (`statusChanges`: fechas y páginas). Los que ya tienen ese estado no
 * cambian (null).
 */
export function batchStatusChanges(item: Item, status: ItemStatus, today: string): ItemWrite | null {
  if (item.status === status) return null
  return statusChanges(item, status, today)
}

/** Cambio de formato de un libro dentro de un lote; sin formatos, lo deja vacío. null si ya es igual. */
export function batchFormatChanges(item: Item, formats: string[]): ItemWrite | null {
  const format = formats.length ? formats.join(', ') : null
  if ((item.format ?? null) === format) return null
  return { format }
}
